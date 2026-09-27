// Armazenamento dos PDFs dos pedidos médicos, em disco, fora da pasta pública
// (só saem pela API, com login). Pasta configurável por ARQUIVOS_DIR; o
// padrão é ./dados/arquivos dentro do projeto. Entra no backup do servidor.

import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ErroHttp } from "@/lib/api/http";

export const TAMANHO_MAX_PDF = 10 * 1024 * 1024; // 10 MB por arquivo
export const MAX_PDFS_POR_PEDIDO = 5;

function raiz() {
  return path.resolve(process.env.ARQUIVOS_DIR || path.join(process.cwd(), "dados", "arquivos"));
}

function caminhoAbsoluto(relativo: string) {
  const r = raiz();
  const abs = path.resolve(r, relativo);
  if (!abs.startsWith(r + path.sep)) throw new ErroHttp(400, "Caminho de arquivo inválido.");
  return abs;
}

/** Confere que é mesmo um PDF (assinatura "%PDF-") e dentro do tamanho. */
export async function lerPdfEnviado(arquivo: File): Promise<Buffer> {
  if (arquivo.size === 0) throw new ErroHttp(422, `O arquivo "${arquivo.name}" está vazio.`);
  if (arquivo.size > TAMANHO_MAX_PDF) throw new ErroHttp(413, `O arquivo "${arquivo.name}" passa de 10 MB.`);
  const conteudo = Buffer.from(await arquivo.arrayBuffer());
  if (conteudo.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new ErroHttp(415, `O arquivo "${arquivo.name}" não é um PDF.`);
  }
  return conteudo;
}

export async function salvarPdf(conteudo: Buffer) {
  const mes = new Date().toISOString().slice(0, 7);
  const relativo = path.posix.join("pedidos", mes, `${randomUUID()}.pdf`);
  const abs = caminhoAbsoluto(relativo);
  await mkdir(path.dirname(abs), { recursive: true, mode: 0o750 });
  await writeFile(abs, conteudo, { mode: 0o640, flag: "wx" });
  return {
    caminho: relativo,
    tamanho: conteudo.length,
    sha256: createHash("sha256").update(conteudo).digest("hex"),
  };
}

export async function lerArquivo(relativo: string) {
  try {
    return await readFile(caminhoAbsoluto(relativo));
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ErroHttp(404, "Arquivo não encontrado no servidor.");
    }
    throw erro;
  }
}

export async function apagarArquivo(relativo: string) {
  await unlink(caminhoAbsoluto(relativo)).catch(() => undefined);
}
