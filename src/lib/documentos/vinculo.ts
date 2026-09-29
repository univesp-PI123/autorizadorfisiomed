// Como um PDF enviado em lote encontra o paciente: pelos números do nome do
// arquivo (CPF do paciente ou número da carteirinha) e, no plano terapêutico,
// pelo nome e nascimento lidos de dentro do documento.

import type { TipoDocumento } from "@prisma/client";
import { cpfValido } from "@/lib/importacao/planilha";

/**
 * Números do nome do arquivo. CPF pode vir com pontos e traço
 * ("123.456.789-09_pedido.pdf"); a carteirinha, só com dígitos.
 */
export function numerosDoNome(nomeArquivo: string) {
  const base = nomeArquivo.replace(/\.[^.]+$/, "");
  const grupos = base.match(/\d[\d.\-]*\d|\d/g) ?? [];
  const cpfs = new Set<string>();
  const outros = new Set<string>();
  for (const g of grupos) {
    const d = g.replace(/\D/g, "");
    if (d.length === 11 && cpfValido(d)) cpfs.add(d);
    else if (d.length >= 6 && d.length <= 20) {
      // "123.456.789-09" formatado já foi tratado; aqui entram carteirinhas.
      for (const parte of g.split(/[.\-]/)) if (parte.length >= 6) outros.add(parte);
      if (/^\d+$/.test(g)) outros.add(g);
    }
  }
  return { cpfs: [...cpfs], carteirinhas: [...outros] };
}

/** Compara carteirinhas ignorando zeros à esquerda ("074929371" = "74929371"). */
export const chaveCarteirinha = (v: string) => v.replace(/\D/g, "").replace(/^0+/, "");

/** Tipo do documento pelo nome do arquivo; null quando não dá para saber. */
export function tipoPeloNome(nomeArquivo: string): TipoDocumento | null {
  const n = nomeArquivo.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  if (/PLANO/.test(n)) return "plano_terapeutico";
  if (/RELAT/.test(n)) return "relatorio";
  if (/PEDIDO|PRESCRI|RECEITA|ENCAMINH|SOLICITA/.test(n)) return "pedido_medico";
  return null;
}
