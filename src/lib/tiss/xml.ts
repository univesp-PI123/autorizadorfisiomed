// Montagem das mensagens TISS em XML e cálculo do hash.
//
// A mensagem é uma árvore simples de elementos, todos no namespace da ANS
// (prefixo "ans:"). O hash TISS é o MD5 da concatenação do conteúdo de todos
// os campos da mensagem, na ordem em que aparecem, sem as tags e sem o
// próprio campo hash, calculado sobre o texto em ISO-8859-1 (a codificação
// da mensagem).

import { createHash } from "node:crypto";

export const NAMESPACE_TISS = "http://www.ans.gov.br/padroes/tiss/schemas";

export type No = { tag: string; conteudo: string | No[] };

/**
 * Elemento da mensagem. Conteúdo vazio (null, "" ou lista sem filhos) some
 * da mensagem: campos opcionais não preenchidos não vão no XML.
 */
export function el(tag: string, conteudo: string | number | null | undefined | (No | null)[]): No | null {
  if (conteudo === null || conteudo === undefined) return null;
  if (Array.isArray(conteudo)) {
    const filhos = conteudo.filter((c): c is No => c !== null);
    return filhos.length ? { tag, conteudo: filhos } : null;
  }
  const texto = String(conteudo);
  return texto === "" ? null : { tag, conteudo: texto };
}

/**
 * Texto livre pronto para a guia: espaços normalizados, só caracteres que
 * existem em ISO-8859-1 e cortado no tamanho máximo do campo.
 */
export function textoTiss(valor: string | null | undefined, max: number): string | null {
  if (!valor) return null;
  const t = valor
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[^\x20-\xFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t ? t.slice(0, max).trim() : null;
}

/** Só os dígitos (carteirinha, CNES, códigos). */
export const digitos = (v: string | null | undefined) => v?.replace(/\D/g, "") || null;

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

function serializarNo(no: No, nivel: number): string {
  const recuo = "  ".repeat(nivel);
  if (typeof no.conteudo === "string") return `${recuo}<ans:${no.tag}>${escapar(no.conteudo)}</ans:${no.tag}>`;
  const filhos = no.conteudo.map((f) => serializarNo(f, nivel + 1)).join("\n");
  return `${recuo}<ans:${no.tag}>\n${filhos}\n${recuo}</ans:${no.tag}>`;
}

function conteudoConcatenado(no: No): string {
  return typeof no.conteudo === "string" ? no.conteudo : no.conteudo.map(conteudoConcatenado).join("");
}

/** MD5 (hexadecimal, minúsculas) do conteúdo dos campos, em ISO-8859-1. */
export function hashTiss(campos: No[]): string {
  const texto = campos.map(conteudoConcatenado).join("");
  return createHash("md5").update(Buffer.from(texto, "latin1")).digest("hex");
}

/**
 * Mensagem completa: elemento raiz com os campos, o hash calculado sobre
 * eles e a declaração de codificação pedida (UTF-8 para validar no xmllint,
 * ISO-8859-1 para o arquivo e o envio).
 */
export function mensagemTiss(raiz: string, campos: No[], codificacao: "UTF-8" | "ISO-8859-1" = "ISO-8859-1") {
  const hash = hashTiss(campos);
  const corpo = [...campos, { tag: "hash", conteudo: hash }].map((c) => serializarNo(c, 1)).join("\n");
  const xml =
    `<?xml version="1.0" encoding="${codificacao}"?>\n` +
    `<ans:${raiz} xmlns:ans="${NAMESPACE_TISS}">\n${corpo}\n</ans:${raiz}>\n`;
  return { xml, hash };
}
