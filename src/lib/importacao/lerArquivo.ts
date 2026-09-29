// Leitura dos arquivos enviados (só no servidor: usa a biblioteca de .xlsx,
// que depende do sistema de arquivos do Node).

import { ErroPlanilha, lerCsv, type Linha } from "./planilha";

export async function lerPlanilha(conteudo: Buffer): Promise<Linha[]> {
  const { readSheet } = await import("read-excel-file/node");
  try {
    return (await readSheet(conteudo)) as Linha[];
  } catch {
    throw new ErroPlanilha("Não foi possível ler o arquivo. Envie a planilha .xlsx exportada do AnClinic.");
  }
}

/** Planilha .xlsx ou .csv, pela extensão do arquivo. */
export async function lerTabela(conteudo: Buffer, nomeArquivo: string): Promise<Linha[]> {
  return /\.csv$/i.test(nomeArquivo) ? lerCsv(conteudo) : lerPlanilha(conteudo);
}

