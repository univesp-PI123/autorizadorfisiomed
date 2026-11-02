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

/**
 * Código TUSS (tabela 22) do procedimento. A Amil recebe as solicitações só
 * pela TUSS: vale o TUSS do de/para da operadora, o próprio código do de/para
 * quando ele já é da tabela 22 ou, sem de/para, o TUSS do procedimento.
 */
export function codigoTuss(proc: ProcedimentoComCodigos, convenioId: string | null): string | null {
  const eq = convenioId ? proc.equivalencias?.find((e) => e.convenioId === convenioId) : undefined;
  if (eq) return eq.codigoTuss ?? (eq.tabela === "22" ? eq.codigo : null) ?? proc.codigoTuss;
  return proc.codigoTuss;
}
