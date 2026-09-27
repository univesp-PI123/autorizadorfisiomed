import { json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaUnidade, lerCorpo } from "@/lib/validacao";

export const PUT = rota<{ id: string }>(async (req, { params }) => {
  await exigirSessao(req, ["admin"]);
  const { id } = await params;
  const dados = await lerCorpo(req, esquemaUnidade);
  if (!(await prisma.unidade.findUnique({ where: { id } }))) naoEncontrado("Unidade");
  return json(await prisma.unidade.update({ where: { id }, data: dados }));
});
