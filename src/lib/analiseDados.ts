/**
 * Cálculos e formatações usados pelas telas.
 * Portado de frontend/src/utils/analiseDados.js do sistema integrado.
 */
import { hojeISO } from "@/lib/datas";

/** Taxa de glosas sobre o total de atendimentos, ex.: "10.00%". */
export function calcularTaxaGlosa(totalAtendimentos: number | null, totalGlosados: number): string {
  if (!totalAtendimentos) return "0.00%";
  return ((totalGlosados / totalAtendimentos) * 100).toFixed(2) + "%";
}

/**
 * Dias até o fim da vigência ("YYYY-MM-DD"); negativo se já passou.
 * Conta pelo calendário da clínica, sem efeito de fuso horário.
 */
export function diasParaVencimento(
  dataFimVigencia: string | null | undefined,
  hoje: string = hojeISO(),
): number | null {
  if (!dataFimVigencia) return null;
  const fim = Date.parse(`${dataFimVigencia.slice(0, 10)}T00:00:00Z`);
  const inicio = Date.parse(`${hoje}T00:00:00Z`);
  return Math.round((fim - inicio) / 86_400_000);
}

export type Urgencia = "critico" | "alerta" | "normal" | "vencido" | "indefinido";

export function classificarUrgencia(dias: number | null): Urgencia {
  if (dias === null) return "indefinido";
  if (dias < 0) return "vencido";
  if (dias <= 3) return "critico";
  if (dias <= 7) return "alerta";
  return "normal";
}

/** Percentual (0–100) de sessões utilizadas. */
export function percentualSessoes(utilizada: number, autorizada: number | null): number {
  if (!autorizada) return 0;
  return Math.min(Math.round((utilizada / autorizada) * 100), 100);
}

/** "YYYY-MM-DD" (ou ISO completo) → "DD/MM/AAAA". */
export function formatarData(data: string | null | undefined): string {
  if (!data) return "—";
  const [ano, mes, dia] = data.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHora(data: string | null | undefined): string {
  if (!data) return "—";
  return new Date(data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** "YYYY-MM" → "mmm/AA" para eixos de gráfico. */
export function formatarMes(mes: string): string {
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [ano, m] = mes.split("-");
  return `${nomes[Number(m) - 1]}/${ano.slice(2)}`;
}
