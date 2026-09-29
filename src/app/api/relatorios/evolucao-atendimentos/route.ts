import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { hojeISO, paraDate, primeiroDiaDoMes, somarMeses } from "@/lib/datas";
import { prisma } from "@/lib/prisma";

type Linha = { mes: string; total: number; semAutorizacao: number; glosados: number };

// Atendimentos por mês nos últimos N meses (incluindo o atual).
export const GET = rota(async (req) => {
  await exigirSessao(req);
  const meses = Math.min(
    24,
    Math.max(1, Number.parseInt(req.nextUrl.searchParams.get("meses") ?? "6", 10) || 6),
  );
  const inicio = paraDate(somarMeses(primeiroDiaDoMes(hojeISO()), -(meses - 1)));

  const linhas = await prisma.$queryRaw<Linha[]>`
    SELECT to_char("dataAtendimento", 'YYYY-MM')                              AS mes,
           COUNT(*)::int                                                     AS total,
           COUNT(*) FILTER (WHERE "semAutorizacao")::int                     AS "semAutorizacao",
           COUNT(*) FILTER (WHERE "statusCobranca" = 'glosado')::int         AS glosados
      FROM atendimentos
     WHERE "dataAtendimento" >= ${inicio} AND situacao = 'confirmado'
  GROUP BY 1
  ORDER BY 1`;

  return json(linhas);
});
