// sessões da agenda que ela cobre (dentro da vigência, até o saldo) viram
// atendimentos "aguardando confirmação". Depois que a sessão acontece (dia
// seguinte), ela é confirmada e descontada da autorização sozinha
// (descontarSessoesRealizadas); se foi desmarcada no AnClinic, é cancelada.

import { Prisma } from "@prisma/client";
import { analisarAgendamentos } from "@/lib/agenda";
import { ErroHttp } from "@/lib/api/http";
import { hojeISO, paraDate, somarDias } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { marcarVencidas } from "./autorizacao";
import { sessaoInativa } from "./pendencias";

type Tx = Prisma.TransactionClient;

/** Horário de início permitido: hora cheia ou meia hora. */
export const HORA_FECHADA = /^([01]\d|2[0-3]):(00|30)$/;

/** Fim de uma sessão de 1 hora. */
export function fimDaSessao(inicio: string): string {
  const [h, m] = inicio.split(":").map(Number);
  const total = (h * 60 + m + 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Uma autorização "vencida" ainda cobre as sessões feitas dentro da vigência:
// o desconto pode rodar depois de a vigência acabar.
const STATUS_QUE_DESCONTAM = ["autorizada", "vencida"] as const;

/**
 * Desconta uma sessão da autorização, se ela estiver autorizada (ou vencida),
 * com a data da sessão na vigência e com saldo — numa única instrução, para
 * dois pedidos simultâneos não passarem do limite. Esgotou: a autorizada muda
 * para "esgotada", com histórico.
 */
export async function consumirSessao(tx: Tx, autorizacaoId: string, pacienteId: string, data: Date) {
  const aut = await tx.autorizacao.findUnique({ where: { id: autorizacaoId } });
  if (!aut || aut.pacienteId !== pacienteId) {
    throw new ErroHttp(422, "A autorização escolhida não pertence a este paciente.");
  }
  if (!(STATUS_QUE_DESCONTAM as readonly string[]).includes(aut.status)) {
    throw new ErroHttp(422, `Autorização com status "${aut.status}" não pode ser utilizada.`);
  }
  if ((aut.dataInicioVigencia && data < aut.dataInicioVigencia) || (aut.dataFimVigencia && data > aut.dataFimVigencia)) {
    throw new ErroHttp(422, "A data do atendimento está fora da vigência da autorização.");
  }
  const { count } = await tx.autorizacao.updateMany({
    where: {
      id: aut.id,
      status: { in: [...STATUS_QUE_DESCONTAM] },
      ...(aut.quantidadeAutorizada !== null && { quantidadeUtilizada: { lt: aut.quantidadeAutorizada } }),
    },
    data: { quantidadeUtilizada: { increment: 1 } },
  });
  if (count === 0) throw new ErroHttp(409, "Esta autorização não tem mais sessões disponíveis.");

  const atualizada = await tx.autorizacao.findUniqueOrThrow({ where: { id: aut.id } });
  if (
    atualizada.status === "autorizada" &&
    atualizada.quantidadeAutorizada !== null &&
    atualizada.quantidadeUtilizada >= atualizada.quantidadeAutorizada
  ) {
    await tx.autorizacao.update({
      where: { id: aut.id },
      data: {
        status: "esgotada",
        historico: {
          create: {
            statusAnterior: "autorizada",
            statusNovo: "esgotada",
            observacao: "Todas as sessões autorizadas foram utilizadas (automático).",
          },
        },
      },
    });
  }
}

const JANELA_DIAS = 60; // sessões mais antigas que isso não geram atendimento (as futuras, sim)

/**
 * Cria os atendimentos pendentes das sessões cobertas e cancela os pendentes
 * cujas sessões foram desmarcadas no AnClinic. Idempotente (um atendimento
 * por sessão); roda após importar a agenda e ao autorizar.
 */
export async function sincronizarAtendimentos() {
  const hoje = hojeISO();

  // 1. Pendentes cuja sessão foi desmarcada ou excluída no AnClinic.
  const pendentes = await prisma.atendimento.findMany({
    where: { situacao: "aguardando_confirmacao", agendamentoId: { not: null } },
    select: { id: true, agendamento: { select: { statusAnclinic: true, removidoEm: true } } },
  });
  for (const p of pendentes) {
    const ag = p.agendamento!;
    if (ag.removidoEm || sessaoInativa(ag.statusAnclinic)) {
      await prisma.atendimento.update({
        where: { id: p.id },
        data: {
          situacao: "cancelado",
          statusCobranca: "cancelado",
          motivoCancelamento: ag.removidoEm ? "Sessão excluída da agenda do AnClinic." : `AnClinic: ${ag.statusAnclinic}.`,
        },
      });  
    }
  }

  // 2. Sessões cobertas por autorização aprovada, ainda sem atendimento.
  const sessoes = await analisarAgendamentos({
    data: { gte: paraDate(somarDias(hoje, -JANELA_DIAS)) },
    atendimento: null,
    removidoEm: null,
    pacienteId: { not: null },
    paciente: { autorizacoes: { some: { status: "autorizada" } } },
  });
  const cobertas = sessoes.filter((s) => s.situacao === "coberta" && s.autorizacaoId);
  if (!cobertas.length) return { criados: 0 };

  // Reserva: pendentes já ligados a cada autorização contam no saldo.
  const autIds = [...new Set(cobertas.map((s) => s.autorizacaoId!))];
  const [auts, reservas] = await Promise.all([
    prisma.autorizacao.findMany({ where: { id: { in: autIds } }, select: { id: true, quantidadeAutorizada: true, quantidadeUtilizada: true } }),
    prisma.atendimento.groupBy({
      by: ["autorizacaoId"],
      where: { autorizacaoId: { in: autIds }, situacao: "aguardando_confirmacao" },
      _count: true,
    }),
  ]);
  const saldo = new Map(
    auts.map((a) => [
      a.id,
      a.quantidadeAutorizada === null
        ? Infinity
        : a.quantidadeAutorizada - a.quantidadeUtilizada - (reservas.find((r) => r.autorizacaoId === a.id)?._count ?? 0),
    ]),
  );

  const dados: Prisma.AtendimentoCreateManyInput[] = [];
  for (const { agendamento: a, autorizacaoId, codigo } of cobertas) {
    const resta = saldo.get(autorizacaoId!) ?? 0;
    if (resta <= 0) continue;
    saldo.set(autorizacaoId!, resta - 1);
    dados.push({
      pacienteId: a.pacienteId!,
      autorizacaoId,
      agendamentoId: a.id,
      profissionalId: a.profissionalId,
      procedimentoId: a.procedimentoId,
      procedimento: a.procedimento?.descricao ?? "Sessão",
      codigoProcedimento: codigo?.codigo ?? null,
      dataAtendimento: a.data,
      horaInicio: a.horaInicio,
      horaFim: a.horaFim,      
      situacao: "aguardando_confirmacao",
      semAutorizacao: false,
    });
  }
  const { count } = await prisma.atendimento.createMany({ data: dados, skipDuplicates: true });
  return { criados: count };
}

/**
 * A sessão já aconteceu? Conta como realizada a de dia anterior a hoje que
 * não foi desmarcada nem excluída no AnClinic. As de hoje esperam o dia
 * seguinte, porque ainda podem ser desmarcadas.
 */
export function sessaoRealizada(
  dataAtendimento: Date,
  hoje: Date,
  agendamento: { statusAnclinic: string | null; removidoEm: Date | null } | null,
): boolean {
  if (dataAtendimento >= hoje) return false;
  return !agendamento || (!agendamento.removidoEm && !sessaoInativa(agendamento.statusAnclinic));
}

/**
 * Desconta das autorizações as sessões que já aconteceram, no lugar da
 * confirmação manual (a tela de Atendimentos saiu em 05/11/2026): o
 * atendimento "aguardando confirmação" de uma sessão realizada vira
 * "confirmado" e a sessão sai do saldo. Se a autorização não puder mais
 * cobrir a sessão (sem saldo, fora da vigência, negada…), o atendimento é
 * confirmado como "sem autorização", com o motivo. Idempotente; roda antes
 * das consultas que mostram saldo e status (como marcarVencidas).
 */
export async function descontarSessoesRealizadas() {
  const hoje = paraDate(hojeISO());
  const pendentes = await prisma.atendimento.findMany({
    where: { situacao: "aguardando_confirmacao", dataAtendimento: { lt: hoje } },
    select: {
      id: true,
      pacienteId: true,
      autorizacaoId: true,
      dataAtendimento: true,
      observacoes: true,
      agendamento: { select: { statusAnclinic: true, removidoEm: true } },
    },
    orderBy: { dataAtendimento: "asc" },
  });

  let descontadas = 0;
  for (const p of pendentes) {
    // Desmarcadas no AnClinic são canceladas por sincronizarAtendimentos.
    if (!sessaoRealizada(p.dataAtendimento, hoje, p.agendamento)) continue;
    const confirmar = { situacao: "confirmado" as const, confirmadoEm: new Date() };
    try {
      await prisma.$transaction(async (tx) => {
        // A condição na situação evita descontar duas vezes se duas
        // requisições rodarem juntas.
        const { count } = await tx.atendimento.updateMany({
          where: { id: p.id, situacao: "aguardando_confirmacao" },
          data: confirmar,
        });
        if (count === 0) return;
        if (p.autorizacaoId) await consumirSessao(tx, p.autorizacaoId, p.pacienteId, p.dataAtendimento);
        descontadas++;
      });
    } catch (err) {
      if (!(err instanceof ErroHttp)) throw err;
      await prisma.atendimento.updateMany({
        where: { id: p.id, situacao: "aguardando_confirmacao" },
        data: {
          ...confirmar,
          autorizacaoId: null,
          semAutorizacao: true,
          observacoes: [p.observacoes, `Não descontada da autorização: ${err.message}`].filter(Boolean).join("\n"),
        },
      });
    }
  }
  return { descontadas };
}

/**
 * Atualiza o que depende da data antes das consultas de autorizações:
 * desconta as sessões realizadas e marca as autorizações vencidas, nesta
 * ordem (a sessão do último dia da vigência ainda é descontada).
 */
export async function atualizarAutorizacoes() {
  await descontarSessoesRealizadas();
  await marcarVencidas();
}
