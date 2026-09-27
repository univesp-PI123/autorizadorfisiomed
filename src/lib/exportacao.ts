/**
 * Exportação de dados para CSV/JSON no navegador.
 * Portado de frontend/src/utils/exportacao.js do sistema integrado.
 */
import toast from "react-hot-toast";
import { hojeISO } from "@/lib/datas";

type Linha = Record<string, unknown>;

/** Gera o CSV (separador ";", como o Excel em português espera). */
export function paraCSV(dados: Linha[]): string {
  const colunas = Object.keys(dados[0] ?? {});
  const celula = (valor: unknown) => {
    const texto = String(valor ?? "").replace(/"/g, '""');
    return /[;"\n\r]/.test(texto) ? `"${texto}"` : texto;
  };
  return [colunas.join(";"), ...dados.map((l) => colunas.map((c) => celula(l[c])).join(";"))].join(
    "\n",
  );
}

export function exportarParaCSV(dados: Linha[], nomeArquivo = "exportacao") {
  if (!dados.length) {
    toast.error("Nenhum dado disponível para exportar.");
    return;
  }
  // ﻿ (BOM) faz o Excel reconhecer os acentos.
  baixar(new Blob(["﻿" + paraCSV(dados)], { type: "text/csv;charset=utf-8;" }), `${nomeArquivo}_${hojeISO()}.csv`);
}

export function exportarParaJSON(dados: Linha[], nomeArquivo = "exportacao") {
  if (!dados.length) {
    toast.error("Nenhum dado disponível para exportar.");
    return;
  }
  baixar(new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" }), `${nomeArquivo}_${hojeISO()}.json`);
}

function baixar(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
