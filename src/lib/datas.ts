// Datas "só dia" (nascimento, vigência, atendimento) trafegam na API como
// "YYYY-MM-DD" e são gravadas no banco como DATE. O "hoje" é calculado no fuso
// da clínica — o servidor na AWS roda em UTC, e entre 21h e meia-noite o dia
// em UTC já é o seguinte.

export const FUSO_CLINICA = "America/Sao_Paulo";

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function ehDataISO(valor: string): boolean {
  if (!REGEX_DATA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

/** "YYYY-MM-DD" de hoje no fuso da clínica. */
export function hojeISO(agora: Date = new Date()): string {
  // en-CA formata como YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO_CLINICA }).format(agora);
}

export function somarDias(dataISO: string, dias: number): string {
  const d = new Date(`${dataISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function somarMeses(dataISO: string, meses: number): string {
  const d = new Date(`${dataISO}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + meses);
  return d.toISOString().slice(0, 10);
}

export function primeiroDiaDoMes(dataISO: string): string {
  return `${dataISO.slice(0, 7)}-01`;
}

/** Converte "YYYY-MM-DD" para o Date que o Prisma grava numa coluna DATE. */
export function paraDate(dataISO: string): Date {
  return new Date(`${dataISO}T00:00:00Z`);
}

/** Converte o Date lido de uma coluna DATE de volta para "YYYY-MM-DD". */
export function deDate(data: Date): string {
  return data.toISOString().slice(0, 10);
}

/** Data ("YYYY-MM-DD") e hora ("HH:MM:SS") de um instante no fuso da clínica. */
export function dataHoraNoFuso(agora: Date = new Date()): { data: string; hora: string } {
  const hora = new Intl.DateTimeFormat("en-GB", {
    timeZone: FUSO_CLINICA,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(agora);
  return { data: hojeISO(agora), hora };
}
