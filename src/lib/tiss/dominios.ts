// Tabelas de domínio do padrão TISS usadas nos cadastros e nas guias.

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

// Tabela 59 — na guia a UF vai pelo código do IBGE, não pela sigla.
const UF_IBGE: Record<(typeof UFS)[number], string> = {
  RO: "11", AC: "12", AM: "13", RR: "14", PA: "15", AP: "16", TO: "17",
  MA: "21", PI: "22", CE: "23", RN: "24", PB: "25", PE: "26", AL: "27", SE: "28", BA: "29",
  MG: "31", ES: "32", RJ: "33", SP: "35",
  PR: "41", SC: "42", RS: "43",
  MS: "50", MT: "51", GO: "52", DF: "53",
};

export function codigoUf(sigla: string | null | undefined): string | null {
  const s = sigla?.trim().toUpperCase();
  return s && s in UF_IBGE ? UF_IBGE[s as keyof typeof UF_IBGE] : null;
}

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

// Status da solicitação (dm_statusSolicitacao), na resposta da operadora.
export const STATUS_SOLICITACAO: Record<string, string> = {
  "1": "Autorizada",
  "2": "Em análise",
  "3": "Negada",
  "4": "Aguardando justificativa técnica",
  "5": "Aguardando documentação",
  "6": "Cancelada",
  "7": "Autorizada parcialmente",
};

/** Status em que a guia já foi aceita ou está em andamento na operadora: não se pede de novo. */
export const STATUS_EM_ANDAMENTO = new Set(["1", "2", "4", "5", "7"]);
// Autorizada ou autorizada parcialmente: a sessão está coberta.
export const STATUS_AUTORIZADA = new Set(["1", "7"]);
