// Especialidades do formulário de plano terapêutico da Amil. A mesma regra
// liga um procedimento (ex.: "PSICOLOGIA ABA") à linha do plano.

import { chaveNome } from "@/lib/importacao/planilha";

export const ESPECIALIDADES = [
  "PSICOLOGIA",
  "PSICOPEDAGOGIA",
  "PSICOMOTRICIDADE",
  "MUSICOTERAPIA",
  "LUDOTERAPIA",
  "FONOAUDIOLOGIA",
  "TERAPIA OCUPACIONAL",
  "FISIOTERAPIA",
] as const;

/** Especialidade da lista do formulário que corresponde ao texto (ou null). */
export function especialidadeDe(texto: string): string | null {
  const t = chaveNome(texto);
  // As mais longas primeiro: "PSICOPEDAGOGIA" não pode cair em "PSICOLOGIA".
  return [...ESPECIALIDADES].sort((a, b) => b.length - a.length).find((e) => t.includes(e)) ?? null;
}

/** Sessões por semana do plano para o procedimento (null se o plano não tem a especialidade). */
export function sessoesPorSemana(itens: { especialidade: string; total: number }[] | null | undefined, procedimento: string) {
  const esp = especialidadeDe(procedimento);
  return esp ? (itens?.find((i) => i.especialidade === esp)?.total ?? null) : null;
}
