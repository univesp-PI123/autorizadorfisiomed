import type { Prisma } from "@prisma/client";
import { filtroPeriodo, json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";

export const GET = rota(async (req) => {
  await exigirSessao(req);
  const sp = req.nextUrl.searchParams;
  const where: Prisma.AtendimentoWhereInput = { statusCobranca: "glosado" };
  const periodo = filtroPeriodo(sp.get("dataInicio"), sp.get("dataFim"));
  if (periodo) where.dataAtendimento = periodo;

  const glosas = await prisma.atendimento.findMany({
    where,
    include: {
      paciente: { select: { id: true, nome: true } },
      autorizacao: { include: { convenio: { select: { id: true, nome: true } } } },
    },
    orderBy: { dataAtendimento: "desc" },
  });

  return json({ total: glosas.length, glosas });
});
