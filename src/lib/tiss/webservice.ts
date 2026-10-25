// Envio das mensagens TISS ao webservice SOAP da Amil (por enquanto só no
// endereço de homologação). Um endereço só atende todos os serviços
// (elegibilidade, solicitação…): a operação vem do elemento no corpo.
//
// Configuração no .env (ver .env.example). Segundo o manual da Amil, o login
// e a senha são os mesmos do portal, com a senha em MD5; aqui vai a senha
// normal e o MD5 é calculado na hora do envio.

import { createHash } from "node:crypto";
import { comLoginSenha } from "@/lib/tiss/xml";

export type ConfigWebservice = { url: string; login: string; senhaMd5: string };

const TEMPO_LIMITE_MS = 60_000;

/** Configuração do webservice da Amil, ou a lista do que falta no .env. */
export function configAmil(env: Record<string, string | undefined> = process.env):
  | { ok: true; config: ConfigWebservice }
  | { ok: false; faltando: string[] } {
  const url = env.TISS_AMIL_URL?.trim();
  const login = env.TISS_AMIL_LOGIN?.trim();
  const senha = env.TISS_AMIL_SENHA;
  const faltando = [
    !url && "TISS_AMIL_URL",
    !login && "TISS_AMIL_LOGIN",
    !senha && "TISS_AMIL_SENHA",
  ].filter((f): f is string => !!f);
  if (faltando.length) return { ok: false, faltando };
  return { ok: true, config: { url: url!, login: login!, senhaMd5: createHash("md5").update(senha!).digest("hex") } };
}

/**
 * Envelope SOAP 1.1 (document/literal) com a mensagem TISS no corpo. Vai em
 * UTF-8: o gateway da Amil responde erro 500 a envelopes em ISO-8859-1
 * (testado na homologação em 25/10/2026). O hash da mensagem continua o do
 * padrão, calculado sobre o texto em ISO-8859-1.
 */
export function envelopeSoap(xmlTiss: string): string {
  const mensagem = xmlTiss.replace(/^<\?xml[^>]*\?>\s*/, "");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">\n` +
    `<soapenv:Header/>\n<soapenv:Body>\n${mensagem}</soapenv:Body>\n</soapenv:Envelope>\n`
  );
}

/** Texto da resposta na codificação que ela declara (ISO-8859-1 ou UTF-8). */
function decodificarResposta(corpo: Buffer, contentType: string | null): string {
  const inicio = corpo.subarray(0, 200).toString("latin1");
  const declarada = (contentType?.match(/charset=([\w-]+)/i)?.[1] ?? inicio.match(/encoding="([\w-]+)"/i)?.[1] ?? "utf-8").toLowerCase();
  return corpo.toString(/^(iso-8859-1|latin1|windows-1252)$/.test(declarada) ? "latin1" : "utf8");
}

export type ResultadoEnvio =
  | { ok: true; status: number; resposta: string }
  | { ok: false; erro: string; resposta?: string };

/** Envia a mensagem (já com o hash) e devolve o texto da resposta. */
export async function enviarSoap(xmlTiss: string, config: ConfigWebservice): Promise<ResultadoEnvio> {
  const corpo = Buffer.from(envelopeSoap(comLoginSenha(xmlTiss, config.login, config.senhaMd5)), "utf8");
  let resp: Response;
  try {
    resp = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=UTF-8", SOAPAction: '""' },
      body: new Uint8Array(corpo),
      signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
    });
  } catch (e) {
    const motivo = e instanceof Error && e.name === "TimeoutError" ? "sem resposta em 60 s" : e instanceof Error ? e.message : String(e);
    return { ok: false, erro: `Falha ao falar com a operadora: ${motivo}.` };
  }
  const resposta = decodificarResposta(Buffer.from(await resp.arrayBuffer()), resp.headers.get("content-type"));
  // SOAP Fault volta com HTTP 500, mas traz o tissFault: quem lê é a resposta.
  if (!resp.ok && !/Fault/.test(resposta)) {
    return { ok: false, erro: `A operadora respondeu HTTP ${resp.status}.`, resposta };
  }
  return { ok: true, status: resp.status, resposta };
}
