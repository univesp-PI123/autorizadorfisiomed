// Regras de horário da rotina automática (lib/rotina.ts). Funções puras.
//
//   Pedido na véspera — a sessão é pedida no dia anterior, às 7h, para dar
//   tempo de resolver uma negativa. A senha da Amil vale até o fim da semana:
//   a sessão de segunda-feira é pedida na própria segunda, logo depois da
//   meia-noite, e nunca no domingo.
//
//   Consulta do status — guia em análise é consultada depois de 15 min, 30
//   min, 1 h, 2 h e, depois, a cada 4 h, até cerca de 30 dias.
//
//   Verificação antecipada — a elegibilidade da carteirinha é conferida para
//   as sessões dos próximos dias, uma vez por dia.

import { FUSO_CLINICA, hojeISO, somarDias } from "@/lib/datas";

export const DIAS_A_FRENTE = 3;
export const HORA_PEDIDO_VESPERA = "07:00";
export const HORA_PEDIDO_SEGUNDA = "00:05";

const INTERVALOS_MIN = [15, 30, 60, 120];
const INTERVALO_DEPOIS_MIN = 240;
// 4 consultas curtas + 30 dias a cada 4 h.
export const MAXIMO_CONSULTAS = INTERVALOS_MIN.length + (30 * 24 * 60) / INTERVALO_DEPOIS_MIN;

/** Diferença, em minutos, entre o horário do fuso da clínica e o UTC naquele instante. */
function deslocamentoMin(instante: Date): number {
  const nome = new Intl.DateTimeFormat("en-US", { timeZone: FUSO_CLINICA, timeZoneName: "shortOffset" })
    .formatToParts(instante)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT-3"
  const m = nome?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const min = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === "-" ? -min : min;
}

/** Instante (UTC) de uma data e hora no fuso da clínica. */
export function instanteNoFuso(dataISO: string, hora: string): Date {
  const comoUtc = new Date(`${dataISO}T${hora}:00Z`);
  return new Date(comoUtc.getTime() - deslocamentoMin(comoUtc) * 60_000);
}

/** Dia da semana da data (0 = domingo … 6 = sábado). */
function diaDaSemana(dataISO: string): number {
  return new Date(`${dataISO}T12:00:00Z`).getUTCDay();
}

/** A partir de quando a sessão desta data pode ser pedida à operadora. */
export function horaDoPedido(dataSessao: string): Date {
  if (diaDaSemana(dataSessao) === 1) return instanteNoFuso(dataSessao, HORA_PEDIDO_SEGUNDA);
  return instanteNoFuso(somarDias(dataSessao, -1), HORA_PEDIDO_VESPERA);
}

/** A sessão já pode ser pedida e ainda não passou? */
export function horaDePedir(dataSessao: string, agora: Date): boolean {
  return agora >= horaDoPedido(dataSessao) && dataSessao >= hojeISO(agora);
}

/** Datas (YYYY-MM-DD) que a verificação antecipada cobre: hoje e os próximos dias. */
export function datasDaVerificacao(agora: Date): string[] {
  const hoje = hojeISO(agora);
  return Array.from({ length: DIAS_A_FRENTE + 1 }, (_, i) => somarDias(hoje, i));
}

/** A elegibilidade precisa ser conferida de novo? Vale para o dia em que foi feita. */
export function elegibilidadeVencida(verificadaEm: Date | null, agora: Date): boolean {
  return !verificadaEm || hojeISO(verificadaEm) !== hojeISO(agora);
}

/**
 * Quando consultar de novo o status de uma guia em análise, dado quantas
 * consultas já foram feitas. Nulo: desiste e deixa a guia para a equipe.
 */
export function proximaConsultaStatus(consultasFeitas: number, agora: Date): Date | null {
  if (consultasFeitas >= MAXIMO_CONSULTAS) return null;
  const minutos = INTERVALOS_MIN[consultasFeitas] ?? INTERVALO_DEPOIS_MIN;
  return new Date(agora.getTime() + minutos * 60_000);
}
