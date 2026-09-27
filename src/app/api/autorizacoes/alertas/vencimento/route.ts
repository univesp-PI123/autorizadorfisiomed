import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { hojeISO, paraDate, somarDias } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { marcarVencidas } from "@/lib/regras/autorizacao";

// Autorizações ativas que vencem nos próximos N dias (padrão 7).
export const GET = rota(async (req) => {
  await exigirSessao(req);
  await marcarVencidas();
  const dias = Math.min(
    365,
    Math.max(0, Number.parseInt(req.nextUrl.searchParams.get("dias") ?? "7", 10) || 7),
  );
  const hoje = hojeISO();

  const autorizacoes = await prisma.autorizacao.findMany({
    where: {
      status: "autorizada",
      dataFimVigencia: { gte: paraDate(hoje), lte: paraDate(somarDias(hoje, dias)) },
    },
    include: {
      paciente: { select: { id: true, nome: true, telefone: true } },
      convenio: { select: { id: true, nome: true } },
    },
    orderBy: { dataFimVigencia: "asc" },
  });
  return json({ total: autorizacoes.length, autorizacoes });
});
