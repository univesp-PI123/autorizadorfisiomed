import { json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";

export const GET = rota<{ id: string }>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  const importacao = await prisma.importacao.findUnique({
    where: { id },
    include: { usuario: { select: { id: true, nome: true } } },
  });
  if (!importacao) naoEncontrado("Importação");
  return json(importacao);
});
