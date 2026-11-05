import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { hojeISO, paraDate, somarDias } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { marcarVencidas } from "@/lib/regras/autorizacao";

export const GET = rota(async (req) => {
  await exigirSessao(req);
  await marcarVencidas();
  const hoje = hojeISO();

  const [
    totalPacientes,
    autorizacoesAtivas,
    autorizacoesPendentes,
    autorizacoesVencendo,
    sessoesHoje,
    glosasAberto,
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
    // Sessões importadas do AnClinic para hoje (a tela Solicitações detalha).
    prisma.agendamento.count({ where: { data: paraDate(hoje) } }),
    prisma.atendimento.count({ where: { statusCobranca: "glosado" } }),
  ]);

  return json({
    totalPacientes,
    autorizacoesAtivas,
    autorizacoesPendentes,
    autorizacoesVencendo,
    sessoesHoje,
    glosasAberto,
  });
});
