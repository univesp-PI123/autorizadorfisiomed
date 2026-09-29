import type { Prisma, TipoDocumento } from "@prisma/client";
import { ErroHttp, json, rota } from "@/lib/api/http";
import { lerPdfEnviado } from "@/lib/arquivos";
import { exigirSessao } from "@/lib/auth/sessao";
import { gravarDocumento, indicePacientes, type ResultadoDocumento } from "@/lib/documentos/salvar";
import { prisma } from "@/lib/prisma";

const MAX_POR_ENVIO = 10;
const TIPOS: TipoDocumento[] = ["pedido_medico", "plano_terapeutico", "relatorio", "outro"];

type ResumoLote = {
  vinculados: number;
  semPaciente: number;
  duplicados: number;
  erros: number;
  pedidosCriados: number;
  arquivos: (ResultadoDocumento | { arquivo: string; status: "erro"; motivo: string })[];
};

// Envio em lote de PDFs (planos terapêuticos, pedidos, relatórios). O navegador
// manda os arquivos em partes de até 10; todas as partes de um mesmo envio
// somam no mesmo registro de importação (importacaoId).
export const POST = rota(async (req) => {
  const usuario = await exigirSessao(req, ["admin", "recepcionista"]);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ErroHttp(400, "Envie os arquivos como formulário (multipart/form-data).");
  }
  const arquivos = form.getAll("arquivos").filter((a): a is File => a instanceof File && a.size > 0);
  if (!arquivos.length) throw new ErroHttp(422, "Selecione os PDFs.");
  if (arquivos.length > MAX_POR_ENVIO) throw new ErroHttp(422, `Envie no máximo ${MAX_POR_ENVIO} arquivos por vez.`);
  const tipoPadrao = (form.get("tipoPadrao") as TipoDocumento | null) ?? "pedido_medico";
  if (!TIPOS.includes(tipoPadrao)) throw new ErroHttp(422, "Tipo de documento inválido.");

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
      resumo: { vinculados: 0, semPaciente: 0, duplicados: 0, erros: 0, pedidosCriados: 0, arquivos: [] },
    },
  });

  // Planos primeiro: assim os pedidos criados por eles recebem os outros PDFs.
  const ordenados = [...arquivos].sort((a, b) => Number(/plano/i.test(b.name)) - Number(/plano/i.test(a.name)));
  const idx = await indicePacientes();
  const resultados: ResumoLote["arquivos"] = [];
  for (const arquivo of ordenados) {
    try {
      const conteudo = await lerPdfEnviado(arquivo);
      resultados.push(
        await gravarDocumento({ nomeArquivo: arquivo.name, conteudo, tipoPadrao, usuarioId: usuario.id, origem: "lote", idx }),
      );
    } catch (erro) {
      resultados.push({ arquivo: arquivo.name, status: "erro", motivo: erro instanceof ErroHttp ? erro.message : "Falha ao gravar o arquivo." });
      if (!(erro instanceof ErroHttp)) console.error(erro);
    }
  }

  const anterior = importacao.resumo as unknown as ResumoLote;
  const conta = (s: string) => resultados.filter((r) => r.status === s).length;
  const resumo: ResumoLote = {
    vinculados: anterior.vinculados + conta("vinculado"),
    semPaciente: anterior.semPaciente + conta("sem_paciente"),
    duplicados: anterior.duplicados + conta("duplicado"),
    erros: anterior.erros + conta("erro"),
    pedidosCriados: anterior.pedidosCriados + resultados.filter((r) => "pedido" in r && r.pedido?.criado).length,
    arquivos: [...anterior.arquivos, ...resultados].slice(0, 2000),
  };
  const total = resumo.vinculados + resumo.semPaciente + resumo.duplicados + resumo.erros;
  importacao = await prisma.importacao.update({
    where: { id: importacao.id },
    data: {
      arquivoNome: `${total} PDF(s)`,
      linhas: total,
      criados: resumo.vinculados,
      ignorados: resumo.semPaciente + resumo.duplicados + resumo.erros,
      resumo: resumo as unknown as Prisma.InputJsonValue,
    },
  });
  return json({ importacaoId: importacao.id, resultados }, 201);
});
