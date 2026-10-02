import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";

// Procedimentos do AnClinic (criados pela importação da agenda ou da tabela da
// operadora), com o equivalente na operadora escolhida e o termo TUSS.
export const GET = rota(async (req) => {
  await exigirSessao(req, ["admin", "recepcionista", "financeiro", "terapeuta"]);
  const convenioId = req.nextUrl.searchParams.get("convenioId") || null;
  const procedimentos = await prisma.procedimento.findMany({
    orderBy: { codigoAnclinic: "asc" },
    include: {
      _count: { select: { agendamentos: true } },
      equivalencias: convenioId
        ? { where: { convenioId }, select: { id: true, codigo: true, descricao: true, tabela: true, codigoTuss: true } }
        : false,
    },
  });
  const codigos = [
    ...new Set(
      procedimentos.flatMap((p) => [p.codigoTuss, ...(p.equivalencias ?? []).map((e) => e.codigoTuss)]).filter((c): c is string => !!c),
    ),
  ];
  const termos = new Map(
    (await prisma.tussProcedimento.findMany({ where: { codigo: { in: codigos } } })).map((t) => [t.codigo, t.termo]),
  );
  return json(
    procedimentos.map(({ equivalencias, ...p }) => ({
      ...p,
      termoTuss: p.codigoTuss ? termos.get(p.codigoTuss) ?? null : null,
      equivalencia: equivalencias?.[0] ?? null,
    })),
  );
});
