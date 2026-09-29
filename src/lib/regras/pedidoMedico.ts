// Validade do pedido médico: 1 ano a partir da data do pedido, quando não
// informada outra.

import { deDate, paraDate, somarMeses } from "@/lib/datas";

export const VALIDADE_PEDIDO_MESES = 12;

/** Último dia de validade: um ano depois da data do pedido, menos um dia. */
export function validadePadrao(dataPedido: Date): Date {
  const iso = somarMeses(deDate(dataPedido), VALIDADE_PEDIDO_MESES);
  const d = paraDate(iso);
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}
