// Pedido médico novo substitui os anteriores: a clínica guarda o histórico no
// arquivo dela, e o sistema fica só com o que vale para as próximas
// solicitações. O mesmo vale para o plano terapêutico de um pedido.

import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Apaga os pedidos do paciente com data até a do novo, com os documentos
 * deles. Devolve os caminhos dos PDFs, para apagar do disco depois do commit.
 */
export async function apagarPedidosAnteriores(tx: Tx, pacienteId: string, novo: { id: string; dataPedido: Date }) {
  const antigos = await tx.pedidoMedico.findMany({
    where: { pacienteId, id: { not: novo.id }, dataPedido: { lte: novo.dataPedido } },
    select: { id: true, documentos: { select: { id: true, caminho: true } } },
  });
  if (!antigos.length) return { pedidos: 0, arquivos: [] as string[] };
  const docs = antigos.flatMap((p) => p.documentos);
  await tx.documento.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
  await tx.pedidoMedico.deleteMany({ where: { id: { in: antigos.map((p) => p.id) } } });
  return { pedidos: antigos.length, arquivos: docs.map((d) => d.caminho) };
}

/** Plano terapêutico novo de um pedido: os planos anteriores dele saem. */
export async function apagarPlanosAnteriores(tx: Tx, pedidoId: string, novoDocumentoId: string) {
  const antigos = await tx.documento.findMany({
    where: { pedidoId, tipo: "plano_terapeutico", id: { not: novoDocumentoId } },
    select: { id: true, caminho: true },
  });
  if (antigos.length) await tx.documento.deleteMany({ where: { id: { in: antigos.map((d) => d.id) } } });
  return antigos.map((d) => d.caminho);
}
