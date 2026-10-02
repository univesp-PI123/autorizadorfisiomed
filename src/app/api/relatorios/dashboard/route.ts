import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { hojeISO, paraDate, primeiroDiaDoMes, somarDias } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { marcarVencidas } from "@/lib/regras/autorizacao";
import { listaDoDia } from "@/lib/solicitacoes";

// Painel do dia: o que pedir hoje, o que espera a operadora, as negativas para
// tratar e os atendimentos. Tudo em quantidades (a clínica não analisa valores).
export const GET = rota(async (req) => {
  const usuario = await exigirSessao(req);
  await marcarVencidas();
  const hoje = hojeISO();
  const inicioMes = paraDate(primeiroDiaDoMes(hoje));
  const semanaPassada = paraDate(somarDias(hoje, -7));

  const [aEnviar, emAnalise, negadas, ultimasNegadas, hojeAguardando, hojeConfirmados, atendimentosMes, semAutorizacaoMes, glosasMes] =
    await prisma.$transaction([
      prisma.autorizacao.count({ where: { status: "pendente" } }),
      prisma.autorizacao.count({ where: { status: "em_analise" } }),
      prisma.autorizacao.count({ where: { status: "negada", dataResposta: { gte: semanaPassada } } }),
      prisma.autorizacao.findMany({
        where: { status: "negada", dataResposta: { gte: semanaPassada } },
        orderBy: [{ dataResposta: "desc" }, { updatedAt: "desc" }],
        take: 6,
        select: {
          id: true,
          procedimento: true,
          motivoNegativa: true,
          dataResposta: true,
          paciente: { select: { id: true, nome: true } },
          convenio: { select: { id: true, nome: true } },
        },
      }),
      prisma.atendimento.count({ where: { dataAtendimento: paraDate(hoje), situacao: "aguardando_confirmacao" } }),
      prisma.atendimento.count({ where: { dataAtendimento: paraDate(hoje), situacao: "confirmado" } }),
      // Só os atendimentos confirmados contam (pendentes de confirmação e cancelados, não).
      prisma.atendimento.count({ where: { dataAtendimento: { gte: inicioMes }, situacao: "confirmado" } }),
      prisma.atendimento.count({ where: { semAutorizacao: true, dataAtendimento: { gte: inicioMes }, situacao: "confirmado" } }),
      prisma.atendimento.count({ where: { statusCobranca: "glosado", dataAtendimento: { gte: inicioMes } } }),
    ]);

  // A lista do dia é de quem pede autorização.
  const lista = usuario.perfil === "terapeuta" ? null : await listaDoDia(hoje);

  return json({
    aSolicitar: lista && { prontas: lista.resumo.pronta, comPendencia: lista.resumo.pendente, escolares: lista.resumo.escolar, datas: lista.datas },
    aEnviar,
    emAnalise,
    negadas,
    ultimasNegadas,
    atendimentosHoje: { aguardando: hojeAguardando, confirmados: hojeConfirmados },
    atendimentosMes,
    semAutorizacaoMes,
    glosasMes,
  });
});
