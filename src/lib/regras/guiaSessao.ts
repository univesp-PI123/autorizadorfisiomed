// O que as guias TISS já geradas para uma sessão significam para ela:
//   cobre    — autorizada (status 1 ou 7), para a data da sessão e dentro da
//              validade da senha
//   conferir — a operadora pode ter recebido a guia, mas a resposta não diz
//              o que foi liberado (ou não veio): a equipe confere no portal
//   bloqueia — em análise na operadora: não se pede de novo
//   livre    — negada, cancelada, recusada, ou de outra data (sessão
//              remarcada): pode-se gerar guia nova
//
// Funções puras: a consulta ao banco fica em agenda.ts e tiss/guias.ts.

import { STATUS_AUTORIZADA, STATUS_EM_ANDAMENTO } from "@/lib/tiss/dominios";

export type GuiaParaSessao = {
  numero: number;
  statusOperadora: string | null;
  senhaOperadora: string | null;
  validadeSenha: string | null; // YYYY-MM-DD
  dataSessao: string | null; // YYYY-MM-DD; null nas guias anteriores a este campo
  conferir: string | null;
};

export type EfeitoGuia = "cobre" | "conferir" | "bloqueia" | "livre";

export function efeitoDaGuia(g: GuiaParaSessao, dataSessao: string): EfeitoGuia {
  // Sessão remarcada para outro dia: a guia era da data antiga.
  if (g.dataSessao && g.dataSessao !== dataSessao) return "livre";
  if (g.conferir) return "conferir";
  if (g.statusOperadora && STATUS_AUTORIZADA.has(g.statusOperadora)) {
    return g.validadeSenha && g.validadeSenha < dataSessao ? "livre" : "cobre";
  }
  if (g.statusOperadora && STATUS_EM_ANDAMENTO.has(g.statusOperadora)) return "bloqueia";
  return "livre";
}

const PRIORIDADE: EfeitoGuia[] = ["cobre", "conferir", "bloqueia"];

/** A guia que decide a sessão: a que cobre, senão a que pede conferência, senão a em análise. */
export function guiaQueDecide<G extends GuiaParaSessao>(guias: G[], dataSessao: string): { guia: G; efeito: EfeitoGuia } | null {
  for (const efeito of PRIORIDADE) {
    const guia = guias.find((g) => efeitoDaGuia(g, dataSessao) === efeito);
    if (guia) return { guia, efeito };
  }
  return null;
}
