import { ErroHttp, json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { interpretarAgenda } from "@/lib/importacao/agenda";
import { gravarAgenda, gravarProfissionais } from "@/lib/importacao/gravar";
import { ErroPlanilha, lerPlanilha } from "@/lib/importacao/planilha";
import { interpretarProfissionais } from "@/lib/importacao/profissionais";
import { prisma } from "@/lib/prisma";

const TAMANHO_MAX = 15 * 1024 * 1024;
const PERFIS_IMPORTACAO = ["admin", "recepcionista"] as const;

export const GET = rota(async (req) => {
  await exigirSessao(req, [...PERFIS_IMPORTACAO, "financeiro"]);
  const importacoes = await prisma.importacao.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { usuario: { select: { id: true, nome: true } } },
  });
  return json(importacoes);
});

// Recebe a planilha (multipart: arquivo, tipo = agenda | profissionais,
// convenioId opcional para a lista de credenciados).
export const POST = rota(async (req) => {
  const usuario = await exigirSessao(req, [...PERFIS_IMPORTACAO]);
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
  if (!/\.xlsx$/i.test(arquivo.name)) throw new ErroHttp(415, "Envie a planilha no formato .xlsx.");
  if (tipo !== "agenda" && tipo !== "profissionais") throw new ErroHttp(422, "Tipo de importação inválido.");

  const conteudo = Buffer.from(await arquivo.arrayBuffer());
  try {
    const linhas = await lerPlanilha(conteudo);
    if (tipo === "agenda") {
      const agenda = interpretarAgenda(linhas);
      if (!agenda.sessoes.length) throw new ErroHttp(422, "Nenhuma sessão encontrada na planilha.");
      return json(await gravarAgenda(agenda, arquivo.name, usuario.id), 201);
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
