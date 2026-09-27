import { hojeISO, paraDate } from "@/lib/datas";
import { prisma } from "@/lib/prisma";

export { podeTransitar, statusAutomatico, TRANSICOES_MANUAIS } from "./transicoes";

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
