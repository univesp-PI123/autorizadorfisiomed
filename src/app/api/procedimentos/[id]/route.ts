import { json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaProcedimento, lerCorpo } from "@/lib/validacao";

export const PUT = rota<{ id: string }>(async (req, { params }) => {
  await exigirSessao(req, ["admin", "recepcionista"]);
  const { id } = await params;
  const dados = await lerCorpo(req, esquemaProcedimento);
  if (!(await prisma.procedimento.findUnique({ where: { id } }))) naoEncontrado("Procedimento");
  return json(await prisma.procedimento.update({ where: { id }, data: dados }));
});
