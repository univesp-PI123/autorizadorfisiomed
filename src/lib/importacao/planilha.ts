// Leitura das planilhas exportadas pelo AnClinic (.xlsx) e conversão dos
// valores de célula, que chegam ora como texto ("28/09/2026", "R$131,00"),
// ora como número (CPF sem os zeros à esquerda).

import { ehDataISO } from "@/lib/datas";

export type Celula = string | number | boolean | Date | null;
export type Linha = Celula[];

export class ErroPlanilha extends Error {}

export async function lerPlanilha(conteudo: Buffer): Promise<Linha[]> {
  const { readSheet } = await import("read-excel-file/node");
  try {
    return (await readSheet(conteudo)) as Linha[];
  } catch {
    throw new ErroPlanilha("Não foi possível ler o arquivo. Envie a planilha .xlsx exportada do AnClinic.");
  }
}

const normalizarTitulo = (v: Celula) =>
  texto(v)
    ?.normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase() ?? "";

/**
 * Acha a linha de cabeçalho (o AnClinic às vezes põe uma linha de título
 * antes, como "Período - 28/09/2026 a 28/09/2026") e devolve o índice de cada
 * coluna pelo nome, sem diferenciar acentos e maiúsculas.
 */
export function acharCabecalho<C extends string>(linhas: Linha[], colunas: readonly C[], obrigatorias: readonly C[]) {
  const alvo = obrigatorias.map((c) => normalizarTitulo(c));
  const indice = linhas.slice(0, 10).findIndex((l) => {
    const titulos = l.map(normalizarTitulo);
    return alvo.every((c) => titulos.includes(c));
  });
  if (indice < 0) {
    throw new ErroPlanilha(
      `Colunas obrigatórias não encontradas: ${obrigatorias.join(", ")}. Confira se é o relatório certo do AnClinic.`,
    );
  }
  const titulos = linhas[indice].map(normalizarTitulo);
  const posicao = Object.fromEntries(colunas.map((c) => [c, titulos.indexOf(normalizarTitulo(c))])) as Record<C, number>;
  return { indice, posicao };
}

/** Texto aparado; vazio vira null. Troca o espaço não separável por espaço. */
export function texto(v: Celula | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/ /g, " ").replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

export function soDigitos(v: Celula | undefined): string | null {
  const s = texto(v)?.replace(/\D/g, "");
  return s ? s : null;
}

/** CPF com 11 dígitos (a planilha de profissionais perde os zeros à esquerda). */
export function cpf(v: Celula | undefined): string | null {
  const d = soDigitos(v);
  if (!d || d.length > 11) return null;
  const completo = d.padStart(11, "0");
  return cpfValido(completo) ? completo : null;
}

export function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

export function formatarCpf(d: string): string {
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** "28/09/2026" (ou Date) → "2026-09-28". */
export function dataBR(v: Celula | undefined): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  const m = texto(v)?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return ehDataISO(iso) ? iso : null;
}

export function hora(v: Celula | undefined): string | null {
  const m = texto(v)?.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = m[1].padStart(2, "0");
  return Number(h) < 24 && Number(m[2]) < 60 ? `${h}:${m[2]}` : null;
}

/** "R$1.234,56" → 1234.56 */
export function dinheiro(v: Celula | undefined): number | null {
  if (typeof v === "number") return v;
  const s = texto(v)?.replace(/[R$\s.]/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function inteiro(v: Celula | undefined): number | null {
  if (typeof v === "number") return Number.isInteger(v) ? v : null;
  const s = texto(v);
  return s && /^-?\d+$/.test(s) ? Number(s) : null;
}

/** Chave para comparar nomes: maiúsculas, sem acento e sem espaços repetidos. */
export function chaveNome(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
