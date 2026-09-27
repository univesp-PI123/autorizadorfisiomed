// Regras puras da autorização (sem banco): usadas pela API para validar e
// pelas telas para oferecer só as opções válidas.
import type { StatusAutorizacao } from "@/lib/cliente/tipos";

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
