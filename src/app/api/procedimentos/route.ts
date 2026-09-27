import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";

// Procedimentos do AnClinic (criados pela importação) e seu código TUSS.
export const GET = rota(async (req) => {
  await exigirSessao(req, ["admin", "recepcionista", "financeiro"]);
  const procedimentos = await prisma.procedimento.findMany({
    orderBy: { codigoAnclinic: "asc" },
    include: { _count: { select: { agendamentos: true } } },
  });
  return json(procedimentos);
});
