import type { StatusAutorizacao } from "@prisma/client";
import { hojeISO, paraDate } from "@/lib/datas";
import { prisma } from "@/lib/prisma";

// Máquina de estados da autorização. As mudanças manuais (feitas por um
// usuário) só podem seguir estas transições. "vencida" e "esgotada" são
// aplicadas pelo sistema, nunca escolhidas à mão.
export const TRANSICOES_MANUAIS: Record<StatusAutorizacao, StatusAutorizacao[]> = {
  pendente: ["em_analise", "autorizada", "negada", "cancelada"],
  em_analise: ["autorizada", "negada", "cancelada"],
  autorizada: ["cancelada"],
  negada: ["pendente"],
  vencida: [],
  cancelada: [],
  esgotada: [],
};

export function podeTransitar(de: StatusAutorizacao, para: StatusAutorizacao): boolean {
  return TRANSICOES_MANUAIS[de].includes(para);
}

/**
 * Status que uma autorização "autorizada" deve assumir pelos dados atuais:
 * vencida se a vigência acabou, esgotada se usou todas as sessões.
 */
export function statusAutomatico(aut: {
  status: StatusAutorizacao;
  dataFimVigencia: string | null;
  quantidadeAutorizada: number | null;
  quantidadeUtilizada: number;
  hoje: string;
}): StatusAutorizacao {
  if (aut.status !== "autorizada") return aut.status;
  if (aut.quantidadeAutorizada !== null && aut.quantidadeUtilizada >= aut.quantidadeAutorizada) {
    return "esgotada";
  }
  if (aut.dataFimVigencia !== null && aut.dataFimVigencia < aut.hoje) return "vencida";
  return "autorizada";
}

/**
 * Marca como "vencida" toda autorização "autorizada" cuja vigência já acabou,
 * registrando no histórico. Roda antes das consultas que dependem do status
 * (listas, dashboard, alertas), então não precisa de tarefa agendada.
 */
export async function marcarVencidas() {
  const hoje = paraDate(hojeISO());
  await prisma.$transaction(async (tx) => {
    // UPDATE ... RETURNING é atômico: se duas requisições rodarem juntas, cada
    // autorização é devolvida para só uma delas, e o histórico não duplica.
    const vencidas = await tx.$queryRaw<{ id: string }[]>`
      UPDATE autorizacoes
         SET status = 'vencida', "updatedAt" = NOW()
       WHERE status = 'autorizada' AND "dataFimVigencia" < ${hoje}
      RETURNING id`;
    if (vencidas.length === 0) return;
    await tx.historicoStatus.createMany({
      data: vencidas.map(({ id }) => ({
        autorizacaoId: id,
        statusAnterior: "autorizada" as const,
        statusNovo: "vencida" as const,
        observacao: "Vigência encerrada (automático).",
      })),
    });
  });
}
