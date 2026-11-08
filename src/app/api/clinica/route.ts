import { json, rota } from "@/lib/api/http";
import { exigirAdmin, exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaClinica, lerCorpo } from "@/lib/validacao";

// Dados da clínica (uma linha só) usados no cabeçalho das guias TISS.
export const GET = rota(async (req) => {
  await exigirSessao(req);
  return json(await prisma.clinica.findFirst());
});

export const PUT = rota(async (req) => {
  await exigirAdmin(req);
  const dados = await lerCorpo(req, esquemaClinica);
  const atual = await prisma.clinica.findFirst({ select: { id: true } });
  return json(
    atual
      ? await prisma.clinica.update({ where: { id: atual.id }, data: dados })
      : await prisma.clinica.create({ data: dados }),
  );
});
