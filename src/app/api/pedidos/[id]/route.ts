import { z } from "zod";
import { json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { lerCorpo } from "@/lib/validacao";

// Desativa (ou reativa) um pedido médico. Os PDFs ficam guardados: são a
// comprovação do que foi enviado à operadora.
export const PATCH = rota<{ id: string }>(async (req, { params }) => {
  await exigirSessao(req, ["admin", "recepcionista"]);
  const { id } = await params;
  const { ativo } = await lerCorpo(req, z.object({ ativo: z.boolean() }));
  if (!(await prisma.pedidoMedico.findUnique({ where: { id } }))) naoEncontrado("Pedido médico");
  return json(await prisma.pedidoMedico.update({ where: { id }, data: { ativo } }));
});
