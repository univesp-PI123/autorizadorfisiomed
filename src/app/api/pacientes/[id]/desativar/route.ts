import { json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";

export const PATCH = rota<{ id: string }>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  if (!(await prisma.paciente.findUnique({ where: { id } }))) naoEncontrado("Paciente");
  await prisma.paciente.update({ where: { id }, data: { ativo: false } });
  return json({ message: "Paciente desativado com sucesso." });
});
