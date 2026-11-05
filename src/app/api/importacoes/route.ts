import { ErroHttp, json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { interpretarAgenda } from "@/lib/importacao/agenda";
import { gravarAgenda, gravarProfissionais } from "@/lib/importacao/gravar";
import { gravarTabelaOperadora, gravarTuss } from "@/lib/importacao/gravarTabelas";
import { lerTabela } from "@/lib/importacao/lerArquivo";
import { ErroPlanilha } from "@/lib/importacao/planilha";
import { interpretarProfissionais } from "@/lib/importacao/profissionais";
import { interpretarTabelaOperadora, interpretarTuss } from "@/lib/importacao/tabelas";
import { prisma } from "@/lib/prisma";
import { sincronizarAtendimentos } from "@/lib/regras/atendimentos";

const TAMANHO_MAX = 15 * 1024 * 1024;

export const GET = rota(async (req) => {
  await exigirSessao(req);
  const importacoes = await prisma.importacao.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { usuario: { select: { id: true, nome: true } } },
  });
  return json(importacoes);
});

const TIPOS = ["agenda", "profissionais", "tabela_operadora", "tuss"] as const;

// Recebe a planilha (multipart: arquivo, tipo, convenioId). convenioId é
// opcional para a lista de credenciados e obrigatório para a tabela da operadora.
export const POST = rota(async (req) => {
  const usuario = await exigirSessao(req);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ErroHttp(400, "Envie o arquivo como formulário (multipart/form-data).");
  }
  const arquivo = form.get("arquivo");
  const tipo = form.get("tipo");
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new ErroHttp(422, "Selecione a planilha .xlsx.");
  if (arquivo.size > TAMANHO_MAX) throw new ErroHttp(413, "Planilha grande demais (máximo 15 MB).");
  if (typeof tipo !== "string" || !(TIPOS as readonly string[]).includes(tipo)) throw new ErroHttp(422, "Tipo de importação inválido.");
  const aceitaCsv = tipo === "tabela_operadora" || tipo === "tuss";
  if (!(aceitaCsv ? /\.(xlsx|csv)$/i : /\.xlsx$/i).test(arquivo.name)) {
    throw new ErroHttp(415, aceitaCsv ? "Envie a planilha em .xlsx ou .csv." : "Envie a planilha no formato .xlsx.");
  }

  const conteudo = Buffer.from(await arquivo.arrayBuffer());
  try {
    const linhas = await lerTabela(conteudo, arquivo.name);
    if (tipo === "tuss") {
      const t = interpretarTuss(linhas);
      if (!t.itens.length) throw new ErroHttp(422, "Nenhum código TUSS válido na planilha.");
      return json(await gravarTuss(t, arquivo.name, usuario.id), 201);
    }
    if (tipo === "tabela_operadora") {
      const convenioId = form.get("convenioId");
      if (typeof convenioId !== "string" || !convenioId) throw new ErroHttp(422, "Escolha o convênio da tabela.");
      if (!(await prisma.convenio.findUnique({ where: { id: convenioId } }).catch(() => null))) throw new ErroHttp(422, "Convênio inválido.");
      const t = interpretarTabelaOperadora(linhas);
      if (!t.itens.length) throw new ErroHttp(422, "Nenhum procedimento com código na planilha.");
      return json(await gravarTabelaOperadora(t, convenioId, arquivo.name, usuario.id), 201);
    }
    if (tipo === "agenda") {
      const agenda = interpretarAgenda(linhas);
      if (!agenda.sessoes.length) throw new ErroHttp(422, "Nenhuma sessão encontrada na planilha.");
      const importacao = await gravarAgenda(agenda, arquivo.name, usuario.id);
      await sincronizarAtendimentos();
      return json(importacao, 201);
    }
    const convenioId = form.get("convenioId");
    if (convenioId !== null && convenioId !== "") {
      if (typeof convenioId !== "string" || !(await prisma.convenio.findUnique({ where: { id: convenioId } }).catch(() => null))) {
        throw new ErroHttp(422, "Convênio inválido.");
      }
    }
    const profissionais = interpretarProfissionais(linhas);
    if (!profissionais.profissionais.length) throw new ErroHttp(422, "Nenhum profissional com CPF válido na planilha.");
    return json(
      await gravarProfissionais(profissionais, arquivo.name, usuario.id, (convenioId as string) || null),
      201,
    );
  } catch (erro) {
    if (erro instanceof ErroPlanilha) throw new ErroHttp(422, erro.message);
    throw erro;
  }
});
