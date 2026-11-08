// Rotina automática do SGA. Roda a cada 5 minutos (scripts/rotina.ts) e faz,
// nesta ordem:
//
//   1. Verificação antecipada — confere a elegibilidade das carteirinhas das
//      sessões da Amil de hoje e dos próximos dias, uma vez por dia. Carteirinha
//      não elegível vira pendência da sessão (regras/pendencias.ts).
//   2. Pedido na véspera — gera e envia a guia das sessões prontas cujo
//      horário de pedido chegou (regras/rotina.ts). Só com
//      ROTINA_ENVIO_AUTOMATICO=1 no .env, para não enviar pedidos de teste.
//   3. Consulta do status — guias em análise com a próxima consulta vencida.
//   4. Cancelamento — guia ativa de sessão desmarcada ou excluída no AnClinic
//      é cancelada na operadora.
//
// Cada passo segue mesmo que outro falhe; os erros voltam no relatório.

import { analisarAgendamentos } from "@/lib/agenda";
import { deDate, hojeISO, paraDate } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { sessaoInativa } from "@/lib/regras/pendencias";
import { datasDaVerificacao, elegibilidadeVencida, horaDePedir } from "@/lib/regras/rotina";
import { STATUS_EM_ANDAMENTO } from "@/lib/tiss/dominios";
import { cancelarGuia, consultarStatusGuia, enviarGuia, verificarElegibilidade } from "@/lib/tiss/envio";
import { gerarGuias } from "@/lib/tiss/guias";
import { configAmil } from "@/lib/tiss/webservice";

export const MOTIVO_CANCELAMENTO_AUTOMATICO = "Sessão desmarcada ou excluída no AnClinic";

export type RelatorioRotina = {
  elegibilidades: number;
  naoElegiveis: number;
  guiasGeradas: number;
  guiasEnviadas: number;
  consultasStatus: number;
  guiasCanceladas: number;
  erros: string[];
};

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function passo(relatorio: RelatorioRotina, nome: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    relatorio.erros.push(`${nome}: ${mensagem(e)}`);
  }
}

/** 1. Elegibilidade das carteirinhas das sessões dos próximos dias. */
async function verificarElegibilidades(agora: Date, r: RelatorioRotina) {
  const sessoes = await prisma.agendamento.findMany({
    where: {
      data: { in: datasDaVerificacao(agora).map(paraDate) },
      removidoEm: null,
      pacienteId: { not: null },
      convenio: { integracao: "tiss_amil" },
    },
    select: { pacienteId: true, convenioId: true, statusAnclinic: true },
  });
  const pares = new Set(sessoes.filter((s) => !sessaoInativa(s.statusAnclinic)).map((s) => `${s.pacienteId}:${s.convenioId}`));
  if (!pares.size) return;

  const vinculos = await prisma.pacienteConvenio.findMany({
    where: { ativo: true, pacienteId: { in: [...pares].map((p) => p.split(":")[0]) } },
    select: { id: true, pacienteId: true, convenioId: true, elegibilidadeEm: true },
  });
  for (const v of vinculos) {
    if (!pares.has(`${v.pacienteId}:${v.convenioId}`) || !elegibilidadeVencida(v.elegibilidadeEm, agora)) continue;
    try {
      const resposta = await verificarElegibilidade(v.id);
      if (resposta.tipo === "falha") {
        r.erros.push(`Elegibilidade: ${resposta.mensagem}`);
        continue;
      }
      r.elegibilidades++;
      if (resposta.tipo === "erro" || !resposta.elegivel) r.naoElegiveis++;
    } catch (e) {
      r.erros.push(`Elegibilidade: ${mensagem(e)}`);
    }
  }
}

/** 2. Pedido das sessões prontas cujo horário de pedido chegou. */
async function pedirSessoes(agora: Date, r: RelatorioRotina) {
  const hoje = hojeISO(agora);
  const datas = datasDaVerificacao(agora).slice(0, 2); // hoje e amanhã
  const sessoes = await analisarAgendamentos({ data: { in: datas.map(paraDate) }, convenio: { integracao: "tiss_amil" } });
  const candidatas = sessoes.filter((s) => s.situacao === "pronta" && horaDePedir(deDate(s.agendamento.data), agora));
  if (candidatas.length) {
    // A rotina pede cada sessão uma vez só. Se já houve guia para a sessão
    // nesta data (negada, recusada…), quem decide pedir de novo é a equipe.
    const jaPedidas = await prisma.guiaTiss.findMany({
      where: { agendamentoIds: { hasSome: candidatas.map((s) => s.agendamento.id) } },
      select: { agendamentoIds: true, dataSessao: true },
    });
    const pedida = new Set(jaPedidas.flatMap((g) => g.agendamentoIds.map((id) => `${id}:${g.dataSessao && deDate(g.dataSessao)}`)));
    const ids = candidatas
      .filter((s) => !pedida.has(`${s.agendamento.id}:${deDate(s.agendamento.data)}`))
      .map((s) => s.agendamento.id);

    if (ids.length) {
      const { guias, erros } = await gerarGuias(ids, null);
      r.guiasGeradas += guias.length;
      for (const e of erros) r.erros.push(`Guia de ${e.paciente}: ${e.erros.join("; ")}`);
    }
  }

  // Envia as guias da rotina geradas hoje que ainda não chegaram à operadora
  // (as de agora e as que falharam por conexão numa rodada anterior).
  const aEnviar = await prisma.guiaTiss.findMany({
    where: { usuarioId: null, enviadaEm: null, createdAt: { gte: paraDate(hoje) }, convenio: { integracao: "tiss_amil" } },
    select: { id: true, numero: true },
    orderBy: { numero: "asc" },
  });
  for (const g of aEnviar) {
    try {
      const enviada = await enviarGuia(g.id);
      if (enviada.statusOperadora || enviada.glosas.length) r.guiasEnviadas++;
      else if (enviada.erroEnvio) r.erros.push(`Guia ${g.numero}: ${enviada.erroEnvio}`);
    } catch (e) {
      r.erros.push(`Guia ${g.numero}: ${mensagem(e)}`);
    }
  }
}

/** 3. Status das guias em análise com a consulta vencida. */
async function consultarStatus(agora: Date, r: RelatorioRotina) {
  const guias = await prisma.guiaTiss.findMany({
    where: { enviadaEm: { not: null }, canceladaEm: null, proximaConsultaEm: { lte: agora } },
    select: { id: true, numero: true },
    orderBy: { proximaConsultaEm: "asc" },
    take: 200,
  });
  for (const g of guias) {
    try {
      await consultarStatusGuia(g.id);
      r.consultasStatus++;
    } catch (e) {
      r.erros.push(`Status da guia ${g.numero}: ${mensagem(e)}`);
    }
  }
}

/** 4. Cancelamento das guias ativas de sessões desmarcadas ou excluídas. */
async function cancelarDesmarcadas(agora: Date, r: RelatorioRotina) {
  const guias = await prisma.guiaTiss.findMany({
    where: {
      enviadaEm: { not: null },
      canceladaEm: null,
      motivoCancelamento: null, // uma tentativa automática; depois, a equipe decide
      statusOperadora: { in: [...STATUS_EM_ANDAMENTO] },
      dataSessao: { gte: paraDate(hojeISO(agora)) },
    },
    select: { id: true, numero: true, agendamentoIds: true },
  });
  if (!guias.length) return;
  const sessoes = await prisma.agendamento.findMany({
    where: { id: { in: guias.flatMap((g) => g.agendamentoIds) } },
    select: { id: true, statusAnclinic: true, removidoEm: true },
  });
  const inativa = new Map(sessoes.map((s) => [s.id, !!s.removidoEm || sessaoInativa(s.statusAnclinic)]));
  for (const g of guias) {
    if (!g.agendamentoIds.length || !g.agendamentoIds.every((id) => inativa.get(id))) continue;
    try {
      const resultado = await cancelarGuia(g.id, MOTIVO_CANCELAMENTO_AUTOMATICO);
      if (resultado.statusOperadora === "6") r.guiasCanceladas++;
      else if (resultado.erroEnvio) r.erros.push(`Cancelamento da guia ${g.numero}: ${resultado.erroEnvio}`);
    } catch (e) {
      r.erros.push(`Cancelamento da guia ${g.numero}: ${mensagem(e)}`);
    }
  }
}

export async function executarRotina(agora: Date = new Date()): Promise<RelatorioRotina> {
  const r: RelatorioRotina = {
    elegibilidades: 0, naoElegiveis: 0, guiasGeradas: 0, guiasEnviadas: 0, consultasStatus: 0, guiasCanceladas: 0, erros: [],
  };
  const config = configAmil();
  if (!config.ok) {
    r.erros.push(`Webservice da Amil não configurado (falta ${config.faltando.join(", ")} no .env).`);
    return r;
  }
  await passo(r, "Verificação antecipada", () => verificarElegibilidades(agora, r));
  if (process.env.ROTINA_ENVIO_AUTOMATICO === "1") await passo(r, "Pedido na véspera", () => pedirSessoes(agora, r));
  await passo(r, "Consulta do status", () => consultarStatus(agora, r));
  await passo(r, "Cancelamento", () => cancelarDesmarcadas(agora, r));
  return r;
}
