// Tabelas de domínio do padrão TISS usadas nos cadastros.

// Tabela 26 — Conselho profissional (sigla → código na guia).
export const CONSELHOS = {
  CRAS: "01",
  COREN: "02",
  CRF: "03",
  CRFA: "04",
  CREFITO: "05",
  CRM: "06",
  CRN: "07",
  CRO: "08",
  CRP: "09",
  OUT: "10",
} as const;

export type SiglaConselho = keyof typeof CONSELHOS;

export const SIGLAS_CONSELHO = Object.keys(CONSELHOS) as SiglaConselho[];

export function siglaConselho(v: string | null | undefined): SiglaConselho | null {
  const s = v?.trim().toUpperCase();
  return s && s in CONSELHOS ? (s as SiglaConselho) : null;
}

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

// CBO sugerido a partir da especialidade cadastrada no AnClinic. É só um
// ponto de partida: o valor fica editável no cadastro do profissional.
const CBO_POR_ESPECIALIDADE: [RegExp, string][] = [
  [/psicopedagog/i, "239425"], // Psicopedagogo
  [/psicolog|psicogeriatr/i, "251510"], // Psicólogo clínico
  [/fonoaudiolog/i, "223810"], // Fonoaudiólogo
  [/terapia ocupacional|terapeuta ocupacional/i, "223905"], // Terapeuta ocupacional
  [/fisioterap/i, "223605"], // Fisioterapeuta geral
  [/musicoterap/i, "226305"], // Musicoterapeuta
];

export function cboSugerido(especialidades: string | null | undefined): string | null {
  if (!especialidades) return null;
  return CBO_POR_ESPECIALIDADE.find(([re]) => re.test(especialidades))?.[1] ?? null;
}
