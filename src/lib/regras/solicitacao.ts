// Quando pedir a autorização de cada sessão. Na Amil, a senha vale para a
// semana em que foi pedida (de segunda a sexta), e a clínica pede na véspera:
//
//   segunda → as de segunda (no próprio dia) e as de terça
//   terça   → as de quarta
//   quarta  → as de quinta
//   quinta  → as de sexta
//   sexta   → nenhuma (a senha pedida na sexta não valeria na segunda)
//
// Pedir de uma vez a agenda do mês não serve: ela muda ao longo do mês
// (faltas, troca de horário, paciente novo) e as autorizações teriam de ser
// canceladas depois.

import { somarDias } from "@/lib/datas";
import { chaveNome } from "@/lib/importacao/planilha";

/** Dia da semana de "YYYY-MM-DD": 0 = domingo … 6 = sábado. */
export function diaDaSemana(dataISO: string): number {
  return new Date(`${dataISO}T00:00:00Z`).getUTCDay();
}

/** Dia em que se pede a autorização da sessão: a véspera; a de segunda, na própria segunda. */
export function diaDaSolicitacao(dataSessao: string): string {
  return diaDaSemana(dataSessao) === 1 ? dataSessao : somarDias(dataSessao, -1);
}

/** Último dia em que a senha vale: a sexta da semana da sessão (ou o próprio sábado/domingo). */
export function fimDaSemana(dataISO: string): string {
  const d = diaDaSemana(dataISO);
  return d === 0 || d === 6 ? dataISO : somarDias(dataISO, 5 - d);
}

/**
 * A sessão continua coberta pelo pedido feito em `dataSolicitacao`? Sim
 * enquanto o pedido dela seria feito na mesma semana do pedido (a senha vale
 * a semana): remarcada para quinta, continua; para a semana seguinte, não.
 */
export function cabeNoPedido(dataSessao: string, dataSolicitacao: string): boolean {
  const dia = diaDaSolicitacao(dataSessao);
  return dia >= dataSolicitacao && dia <= fimDaSemana(dataSolicitacao);
}

/**
 * Datas das sessões que entram na lista do dia: as de hoje ainda sem pedido
 * (as de segunda, ou as que ficaram para trás) e as de amanhã, quando o pedido
 * delas é hoje.
 */
export function datasDaJanela(hoje: string): string[] {
  const amanha = somarDias(hoje, 1);
  return diaDaSolicitacao(amanha) === hoje ? [hoje, amanha] : [hoje];
}

/**
 * Atendimento na escola ("SÃO MIGUEL - ATENDIMENTO ESCOLAR" na sala do
 * AnClinic). A criança falta muito à escola, então a autorização só é pedida
 * no dia, quando o profissional confirma que está com ela lá.
 */
export function ehAtendimentoEscolar(sala: string | null): boolean {
  return !!sala && /\bESCOLAR\b/.test(chaveNome(sala));
}

const SEM_PREFIXO = /^(FISIOMED( ABA)?|UNIDADE)\s+/;
const semPrefixo = (nome: string) => chaveNome(nome).replace(SEM_PREFIXO, "");
const contemPalavras = (a: string, b: string) => ` ${a} `.includes(` ${b} `);

/**
 * Unidade pela sala, quando a coluna "Unidade de Atendimento" vem em branco:
 * a sala começa com o nome da unidade ("ITINGUÇU - SALA 01" → FISIOMED ABA
 * ITINGUÇU). Só devolve quando uma única unidade casa.
 */
export function unidadePelaSala(sala: string | null, unidades: { id: string; nome: string; nomeAnclinic: string }[]): string | null {
  const prefixo = sala?.split(" - ")[0];
  if (!prefixo || prefixo === sala) return null;
  const chave = semPrefixo(prefixo);
  if (chave.length < 3) return null;
  const nomes = (u: (typeof unidades)[number]) => [semPrefixo(u.nomeAnclinic), semPrefixo(u.nome)];
  const iguais = unidades.filter((u) => nomes(u).includes(chave));
  if (iguais.length) return iguais.length === 1 ? iguais[0].id : null;
  const parecidas = unidades.filter((u) => nomes(u).some((n) => contemPalavras(n, chave) || contemPalavras(chave, n)));
  return parecidas.length === 1 ? parecidas[0].id : null;
}
