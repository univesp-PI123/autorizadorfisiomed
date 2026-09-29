import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { hojeISO, paraDate, primeiroDiaDoMes, somarDias } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { marcarVencidas } from "@/lib/regras/autorizacao";

export const GET = rota(async (req) => {
  await exigirSessao(req);
  await marcarVencidas();
  const hoje = hojeISO();
  const inicioMes = paraDate(primeiroDiaDoMes(hoje));

  const [
    totalPacientes,
    autorizacoesAtivas,
    autorizacoesPendentes,
    autorizacoesVencendo,
    atendimentosMes,
    glosasAberto,
    semAutorizacaoMes,
    somaGlosado,
  ] = await prisma.$transaction([
    prisma.paciente.count({ where: { ativo: true } }),
    prisma.autorizacao.count({ where: { status: "autorizada" } }),
    prisma.autorizacao.count({ where: { status: "pendente" } }),
    prisma.autorizacao.count({
      where: {
        status: "autorizada",
        dataFimVigencia: { gte: paraDate(hoje), lte: paraDate(somarDias(hoje, 7)) },
      },
    }),
    // Só os atendimentos confirmados contam (pendentes de confirmação e cancelados, não).
    prisma.atendimento.count({ where: { dataAtendimento: { gte: inicioMes }, situacao: "confirmado" } }),
    prisma.atendimento.count({ where: { statusCobranca: "glosado" } }),
    prisma.atendimento.count({
      where: { semAutorizacao: true, dataAtendimento: { gte: inicioMes }, situacao: "confirmado" },
    }),
    prisma.atendimento.aggregate({
      where: { statusCobranca: "glosado" },
      _sum: { valorCobrado: true },
    }),
  ]);

  return json({
    totalPacientes,
    autorizacoesAtivas,
    autorizacoesPendentes,
    autorizacoesVencendo,
    atendimentosMes,
    glosasAberto,
    semAutorizacaoMes,
    totalGlosado: Number(somaGlosado._sum.valorCobrado ?? 0),
  });
});
