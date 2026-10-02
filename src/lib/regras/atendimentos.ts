// Atendimentos a partir da agenda: assim que uma autorização é aprovada, as
// sessões da agenda que ela cobre (as ligadas ao pedido ou, numa autorização
// lançada à mão, as da vigência até o saldo) viram atendimentos "aguardando
// confirmação". No dia da sessão, o operador confirma (aí ela é descontada da
// autorização) ou cancela, com motivo.

import type { Prisma } from "@prisma/client";
import { analisarAgendamentos } from "@/lib/agenda";
import { ErroHttp } from "@/lib/api/http";
import { hojeISO, paraDate, somarDias } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
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

/**
 * Desconta uma sessão da autorização, se ela estiver autorizada, vigente na
 * data e com saldo — numa única instrução, para dois pedidos simultâneos não
 * passarem do limite. Esgotou: muda para "esgotada", com histórico.
 */
export async function consumirSessao(tx: Tx, autorizacaoId: string, pacienteId: string, data: Date) {
  const aut = await tx.autorizacao.findUnique({ where: { id: autorizacaoId } });
  if (!aut || aut.pacienteId !== pacienteId) {
    throw new ErroHttp(422, "A autorização escolhida não pertence a este paciente.");
  }
  if (aut.status !== "autorizada") {
    throw new ErroHttp(422, `Autorização com status "${aut.status}" não pode ser utilizada.`);
  }
  if ((aut.dataInicioVigencia && data < aut.dataInicioVigencia) || (aut.dataFimVigencia && data > aut.dataFimVigencia)) {
    throw new ErroHttp(422, "A data do atendimento está fora da vigência da autorização.");
  }
  const { count } = await tx.autorizacao.updateMany({
    where: {
      id: aut.id,
      status: "autorizada",
      ...(aut.quantidadeAutorizada !== null && { quantidadeUtilizada: { lt: aut.quantidadeAutorizada } }),
    },
    data: { quantidadeUtilizada: { increment: 1 } },
  });
  if (count === 0) throw new ErroHttp(409, "Esta autorização não tem mais sessões disponíveis.");

  const atualizada = await tx.autorizacao.findUniqueOrThrow({ where: { id: aut.id } });
  if (atualizada.quantidadeAutorizada !== null && atualizada.quantidadeUtilizada >= atualizada.quantidadeAutorizada) {
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
 * por sessão); roda após importar a agenda, ao autorizar e ao abrir a tela de
 * atendimentos.
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
