// Tabelas de procedimentos: a da operadora (com o de/para para o AnClinic e a
// TUSS) e a Tabela 22 da TUSS publicada pela ANS. Funções puras; a gravação
// fica em gravarTabelas.ts.

import { Avisos, type Aviso } from "./avisos";
import { acharColunas, soDigitos, texto, type Linha } from "./planilha";

export const COLUNAS_OPERADORA = {
  codigo: ["Código Operadora", "Código da Operadora", "Cod Operadora", "Código", "Codigo"],
  descricao: ["Descrição Operadora", "Descrição da Operadora", "Descrição", "Descricao", "Procedimento"],
  codigoTuss: ["Código TUSS", "TUSS", "Cod TUSS", "Código Tabela 22"],
  tabela: ["Tabela"],
  codigoAnclinic: ["Código AnClinic", "Cod AnClinic", "AnClinic", "Procedimento AnClinic"],
} as const;

export type ItemOperadora = {
  linha: number;
  codigo: string;
  descricao: string;
  codigoTuss: string | null;
  tabela: string;
  codigoAnclinic: string | null;
};

export function interpretarTabelaOperadora(linhas: Linha[]): { itens: ItemOperadora[]; ignoradas: number; avisos: Aviso[] } {
  const nomes = COLUNAS_OPERADORA as unknown as Record<keyof typeof COLUNAS_OPERADORA, string[]>;
  const { indice, posicao } = acharColunas<keyof typeof COLUNAS_OPERADORA>(linhas, nomes, ["codigo"]);
  const col = (l: Linha, c: keyof typeof COLUNAS_OPERADORA) => (posicao[c] >= 0 ? l[posicao[c]] : null);
  const avisos = new Avisos();
  const porCodigo = new Map<string, ItemOperadora>();
  let ignoradas = 0;

  linhas.slice(indice + 1).forEach((l, i) => {
    const linha = indice + 2 + i;
    if (l.every((c) => texto(c) === null)) return;
    const codigo = texto(col(l, "codigo"))?.replace(/\s/g, "").slice(0, 20);
    if (!codigo) {
      ignoradas++;
      avisos.add("Linha sem código da operadora (ignorada).", linha);
      return;
    }
    const tussBruto = soDigitos(col(l, "codigoTuss"));
    const codigoTuss = tussBruto && /^\d{8,10}$/.test(tussBruto) ? tussBruto : null;
    if (tussBruto && !codigoTuss) avisos.add("Código TUSS inválido (deve ter 8 dígitos): desconsiderado.", linha);
    const tabela = soDigitos(col(l, "tabela"))?.padStart(2, "0").slice(0, 2) ?? "22";
    // "4440 - PSICOLOGIA ABA" ou só "4440"
    const anclinic = texto(col(l, "codigoAnclinic"))?.match(/^\s*(\w+)/)?.[1] ?? null;
    const descricao = texto(col(l, "descricao"))?.slice(0, 300) ?? null;
    if (!descricao) avisos.add("Sem descrição: usado o código no lugar.", linha);
    if (porCodigo.has(codigo)) {
      ignoradas++;
      avisos.add("Código repetido na planilha (vale a última linha).", linha);
    }
    porCodigo.set(codigo, {
      linha,
      codigo,
      descricao: descricao ?? codigo,
      codigoTuss,
      tabela,
      codigoAnclinic: anclinic,
    });
  });
  return { itens: [...porCodigo.values()], ignoradas, avisos: avisos.lista() };
}

const COLUNAS_TUSS = {
  codigo: ["Código do Termo", "Código", "Codigo", "Código TUSS", "Cód. do Termo"],
  termo: ["Termo", "Descrição", "Descricao", "Descrição do Termo"],
};

export function interpretarTuss(linhas: Linha[]): { itens: { codigo: string; termo: string }[]; ignoradas: number; avisos: Aviso[] } {
  const { indice, posicao } = acharColunas(linhas, COLUNAS_TUSS, ["codigo", "termo"]);
  const avisos = new Avisos();
  const porCodigo = new Map<string, string>();
  let ignoradas = 0;
  linhas.slice(indice + 1).forEach((l, i) => {
    const linha = indice + 2 + i;
    if (l.every((c) => texto(c) === null)) return;
    const codigo = soDigitos(l[posicao.codigo]);
    const termo = texto(l[posicao.termo])?.slice(0, 500);
    if (!codigo || !/^\d{8,10}$/.test(codigo) || !termo) {
      ignoradas++;
      avisos.add("Sem código de 8 dígitos ou sem termo (ignorada).", linha);
      return;
    }
    porCodigo.set(codigo, termo);
  });
  return { itens: [...porCodigo].map(([codigo, termo]) => ({ codigo, termo })), ignoradas, avisos: avisos.lista() };
}

/** Modelo em CSV da tabela da operadora (baixado pela tela de procedimentos). */
export const MODELO_TABELA_OPERADORA =
  "Código AnClinic;Código Operadora;Descrição Operadora;Código TUSS;Tabela\n" +
  "4440;CODIGO-DA-OPERADORA;DESCRICAO NA TABELA DA OPERADORA;CODIGO-TUSS-8-DIGITOS;22\n";
