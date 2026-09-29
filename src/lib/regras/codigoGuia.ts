// Qual código de procedimento vai na guia de cada operadora: o equivalente da
// tabela da operadora (de/para) ou, sem ele, o código TUSS do procedimento.

export type Equivalencia = { convenioId: string; codigo: string; tabela: string; codigoTuss: string | null };
export type ProcedimentoComCodigos = {
  codigoTuss: string | null;
  tabelaTuss: string | null;
  equivalencias?: Equivalencia[];
};

export function codigoParaGuia(proc: ProcedimentoComCodigos, convenioId: string | null) {
  const eq = convenioId ? proc.equivalencias?.find((e) => e.convenioId === convenioId) : undefined;
  if (eq) return { codigo: eq.codigo, tabela: eq.tabela, origem: "operadora" as const };
  if (proc.codigoTuss) return { codigo: proc.codigoTuss, tabela: proc.tabelaTuss ?? "22", origem: "tuss" as const };
  return null;
}

/** Códigos que valem como "o mesmo procedimento" ao conferir uma autorização. */
export function codigosAceitos(proc: ProcedimentoComCodigos, convenioId: string | null): string[] {
  const eq = convenioId ? proc.equivalencias?.find((e) => e.convenioId === convenioId) : undefined;
  return [...new Set([eq?.codigo, eq?.codigoTuss, proc.codigoTuss].filter((c): c is string => !!c))];
}
