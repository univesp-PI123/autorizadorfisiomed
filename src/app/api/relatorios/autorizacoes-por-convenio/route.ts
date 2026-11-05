import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { atualizarAutorizacoes } from "@/lib/regras/atendimentos";

export const GET = rota(async (req) => {
  await exigirSessao(req);
  await atualizarAutorizacoes();

  const [grupos, convenios] = await Promise.all([
    prisma.autorizacao.groupBy({
      by: ["convenioId", "status"],
      _count: { _all: true },
    }),
    prisma.convenio.findMany({ select: { id: true, nome: true } }),
  ]);
  const porId = new Map(convenios.map((c) => [c.id, c]));

  return json(
    grupos.map((g) => ({
      status: g.status,
      total: g._count._all,
      convenio: porId.get(g.convenioId) ?? { id: g.convenioId, nome: "—" },
    })),
  );
});
