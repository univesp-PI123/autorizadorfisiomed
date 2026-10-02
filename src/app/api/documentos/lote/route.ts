import type { Prisma, TipoDocumento } from "@prisma/client";
import { z } from "zod";
import { ErroHttp, json, rota } from "@/lib/api/http";
import { lerPdfEnviado } from "@/lib/arquivos";
import { exigirSessao } from "@/lib/auth/sessao";
import { lerPlano, type PlanoTerapeutico } from "@/lib/documentos/plano";
import { gravarDocumento, indicePacientes, pastaDoPaciente, type ResultadoDocumento } from "@/lib/documentos/salvar";
import { prisma } from "@/lib/prisma";

const MAX_POR_ENVIO = 10;
const TIPOS: TipoDocumento[] = ["pedido_medico", "plano_terapeutico", "relatorio", "outro"];

type Resultado = ResultadoDocumento | { arquivo: string; status: "erro" | "ignorado"; motivo: string };

type ResumoLote = {
  vinculados: number;
  semPaciente: number;
  duplicados: number;
  ignorados: number;
  erros: number;
  pedidosCriados: number;
  arquivos: Resultado[];
};

const esquemaIgnorados = z.array(z.object({ arquivo: z.string().max(500), motivo: z.string().max(200) })).max(5000);

// Envio em lote de PDFs (planos terapêuticos, pedidos, relatórios). O navegador
// manda os arquivos em partes de até 10 — os de uma mesma pasta juntos — e
// todas as partes de um mesmo envio somam no mesmo registro de importação.
export const POST = rota(async (req) => {
  const usuario = await exigirSessao(req, ["admin", "recepcionista"]);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ErroHttp(400, "Envie os arquivos como formulário (multipart/form-data).");
  }
  const arquivos = form.getAll("arquivos").filter((a): a is File => a instanceof File && a.size > 0);
  const caminhos = form.getAll("caminhos").map((c) => (typeof c === "string" ? c : ""));
  if (!arquivos.length) throw new ErroHttp(422, "Selecione os PDFs.");
  if (arquivos.length > MAX_POR_ENVIO) throw new ErroHttp(422, `Envie no máximo ${MAX_POR_ENVIO} arquivos por vez.`);
  const tipoPadrao = (form.get("tipoPadrao") as TipoDocumento | null) ?? "pedido_medico";
  if (!TIPOS.includes(tipoPadrao)) throw new ErroHttp(422, "Tipo de documento inválido.");
  let deFora: Resultado[] = [];
  const ignoradosNoNavegador = form.get("ignorados");
  if (typeof ignoradosNoNavegador === "string" && ignoradosNoNavegador) {
    let lista;
    try {
      lista = esquemaIgnorados.safeParse(JSON.parse(ignoradosNoNavegador));
    } catch {
      lista = null;
    }
    if (!lista?.success) throw new ErroHttp(422, "Lista de arquivos ignorados inválida.");
    deFora = lista.data.map((i) => ({ ...i, status: "ignorado" as const }));
  }

  const importacaoId = form.get("importacaoId");
  let importacao =
    typeof importacaoId === "string" && importacaoId
      ? await prisma.importacao.findFirst({ where: { id: importacaoId, tipo: "documentos" } }).catch(() => null)
      : null;
  if (typeof importacaoId === "string" && importacaoId && !importacao) throw new ErroHttp(422, "Envio em lote não encontrado.");
  importacao ??= await prisma.importacao.create({
    data: {
      tipo: "documentos",
      arquivoNome: `${arquivos.length} PDF(s)`,
      usuarioId: usuario.id,
      resumo: { vinculados: 0, semPaciente: 0, duplicados: 0, ignorados: 0, erros: 0, pedidosCriados: 0, arquivos: [] },
    },
  });

  // Lê tudo antes: os planos vão primeiro (do mais antigo ao mais novo), para
  // que o pedido criado pelo plano receba os demais PDFs da pasta.
  const idx = await indicePacientes();
  const resultados: Resultado[] = [...deFora];
  const lidos: { arquivo: File; nome: string; conteudo: Buffer; plano: PlanoTerapeutico | null; pasta: string | null }[] = [];
  for (const [i, arquivo] of arquivos.entries()) {
    const nome = caminhos[i] || arquivo.name;
    const origem = pastaDoPaciente(caminhos[i] ?? "", idx);
    if ("ignorar" in origem) {
      resultados.push({ arquivo: nome, status: "ignorado", motivo: origem.ignorar });
      continue;
    }
    try {
      const conteudo = await lerPdfEnviado(arquivo);
      lidos.push({ arquivo, nome, conteudo, plano: await lerPlano(conteudo), pasta: origem.pasta });
    } catch (erro) {
      resultados.push({ arquivo: nome, status: "erro", motivo: erro instanceof ErroHttp ? erro.message : "Falha ao ler o arquivo." });
    }
  }
  const chave = (l: (typeof lidos)[number]) => (l.plano ? `0${l.plano.dataSolicitacao ?? ""}` : "1");
  lidos.sort((a, b) => chave(a).localeCompare(chave(b)));

  for (const l of lidos) {
    try {
      resultados.push(
        await gravarDocumento({
          nomeArquivo: l.arquivo.name,
          conteudo: l.conteudo,
          tipoPadrao,
          usuarioId: usuario.id,
          origem: "lote",
          idx,
          pasta: l.pasta,
          plano: l.plano,
        }),
      );
      const ultimo = resultados[resultados.length - 1];
      if (l.nome !== l.arquivo.name) ultimo.arquivo = l.nome;
    } catch (erro) {
      resultados.push({ arquivo: l.nome, status: "erro", motivo: erro instanceof ErroHttp ? erro.message : "Falha ao gravar o arquivo." });
      if (!(erro instanceof ErroHttp)) console.error(erro);
    }
  }

  const anterior = importacao.resumo as unknown as ResumoLote;
  const conta = (s: string) => resultados.filter((r) => r.status === s).length;
  const resumo: ResumoLote = {
    vinculados: anterior.vinculados + conta("vinculado"),
    semPaciente: anterior.semPaciente + conta("sem_paciente"),
    duplicados: anterior.duplicados + conta("duplicado"),
    ignorados: (anterior.ignorados ?? 0) + conta("ignorado"),
    erros: anterior.erros + conta("erro"),
    pedidosCriados: anterior.pedidosCriados + resultados.filter((r) => "pedido" in r && r.pedido?.criado).length,
    arquivos: [...anterior.arquivos, ...resultados].slice(0, 2000),
  };
  const total = resumo.vinculados + resumo.semPaciente + resumo.duplicados + resumo.ignorados + resumo.erros;
  importacao = await prisma.importacao.update({
    where: { id: importacao.id },
    data: {
      arquivoNome: `${total} PDF(s)`,
      linhas: total,
      criados: resumo.vinculados,
      ignorados: resumo.semPaciente + resumo.duplicados + resumo.ignorados + resumo.erros,
      resumo: resumo as unknown as Prisma.InputJsonValue,
    },
  });
  return json({ importacaoId: importacao.id, resultados: resultados.filter((r) => !deFora.includes(r)) }, 201);
});
