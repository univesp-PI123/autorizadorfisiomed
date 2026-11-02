// Validação das mensagens contra os schemas oficiais da ANS (pasta
// schemas/v4_03_00, convertidos para UTF-8 — o xmllint só lê UTF-8). Nenhuma
// guia é gravada ou enviada sem passar por aqui: um campo fora do padrão
// aparece na hora, e não como recusa da operadora.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { validateXML, type XMLFileInfo } from "xmllint-wasm";

const PASTA_SCHEMAS = path.join(process.cwd(), "src/lib/tiss/schemas/v4_03_00");
const SCHEMA_PRINCIPAL = "tissWebServicesV4_03_00.xsd";

let schemas: Promise<XMLFileInfo[]> | null = null;

function carregarSchemas(): Promise<XMLFileInfo[]> {
  schemas ??= readdir(PASTA_SCHEMAS).then((arquivos) =>
    Promise.all(
      arquivos
        .filter((a) => a.endsWith(".xsd"))
        .map(async (fileName) => ({ fileName, contents: await readFile(path.join(PASTA_SCHEMAS, fileName), "utf8") })),
    ),
  );
  return schemas;
}

/** Erros de schema da mensagem (vazio = válida). Recebe o XML em UTF-8. */
export async function validarMensagemTiss(xmlUtf8: string): Promise<string[]> {
  const todos = await carregarSchemas();
  const principal = todos.find((s) => s.fileName === SCHEMA_PRINCIPAL)!;
  const r = await validateXML({
    xml: { fileName: "mensagem.xml", contents: xmlUtf8 },
    schema: principal,
    preload: todos.filter((s) => s !== principal),
  });
  return r.errors.map((e) => (e.loc ? `Linha ${e.loc.lineNumber}: ${e.message}` : e.message).trim());
}
