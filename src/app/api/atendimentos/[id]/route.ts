import { json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaAtendimentoEdicao, lerCorpo } from "@/lib/validacao";

type Params = { id: string };

export const GET = rota<Params>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  const atendimento = await prisma.atendimento.findUnique({
    where: { id },
    include: {
      paciente: true,
      autorizacao: { include: { convenio: true } },
      terapeuta: { select: { id: true, nome: true } },
    },
  });
  if (!atendimento) naoEncontrado("Atendimento");
  return json(atendimento);
});

// Edição (cobrança/glosa): perfis administrativos, não o terapeuta.
export const PUT = rota<Params>(async (req, { params }) => {
  await exigirSessao(req, ["admin", "financeiro", "recepcionista"]);
  const { id } = await params;
  const dados = await lerCorpo(req, esquemaAtendimentoEdicao);
  if (!(await prisma.atendimento.findUnique({ where: { id } }))) naoEncontrado("Atendimento");
  return json(await prisma.atendimento.update({ where: { id }, data: dados }));
});
