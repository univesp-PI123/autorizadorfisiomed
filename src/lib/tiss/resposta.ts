// Leitura da resposta do webservice à solicitacaoProcedimento: a mensagem
// autorizacaoProcedimentoWS (autorização, negativa ou mensagem de erro) ou um
// SOAP Fault com o tissFault.
//
// Função pura sobre o texto da resposta. Os campos são achados pelo nome,
// com qualquer prefixo de namespace, porque cada operadora monta o envelope
// do seu jeito.

export type RespostaSolicitacao =
  | {
      tipo: "autorizacao";
      status: string; // dm_statusSolicitacao
      numeroGuiaOperadora: string | null;
      senha: string | null;
      validadeSenha: string | null; // YYYY-MM-DD
      glosas: string[];
      observacao: string | null;
    }
  | { tipo: "erro"; glosas: string[] } // mensagemErro: a operadora recusou a mensagem
  | { tipo: "falha"; mensagem: string }; // SOAP Fault ou resposta que não é TISS

const decodificar = (t: string) =>
  t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();

/** Conteúdo de cada ocorrência do campo, em ordem. */
function campos(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${tag}>`, "g");
  return [...xml.matchAll(re)].map((m) => decodificar(m[1])).filter(Boolean);
}
const campo = (xml: string, tag: string) => campos(xml, tag)[0] ?? null;

/** Trecho de um elemento composto (o primeiro), para ler só os campos dele. */
function trecho(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`);
  return xml.match(re)?.[1] ?? null;
}

/** "código - descrição" de cada glosa do trecho. */
function glosasDe(xml: string): string[] {
  const codigos = campos(xml, "codigoGlosa");
  const descricoes = campos(xml, "descricaoGlosa");
  // Na negativa (motivosNegativa) só vêm os códigos; na mensagemErro vêm
  // código e descrição, em pares.
  return codigos.map((c, i) => (descricoes.length === codigos.length ? `${c} - ${descricoes[i]}` : c));
}

export function lerRespostaSolicitacao(xml: string): RespostaSolicitacao {
  const erro = trecho(xml, "mensagemErro");
  if (erro !== null) return { tipo: "erro", glosas: glosasDe(erro) };

  const servico = trecho(xml, "autorizacaoServico");
  const status = servico && campo(servico, "statusSolicitacao");
  if (servico && status) {
    const negativa = trecho(servico, "motivosNegativa");
    return {
      tipo: "autorizacao",
      status,
      numeroGuiaOperadora: campo(servico, "numeroGuiaOperadora"),
      senha: campo(servico, "senha"),
      validadeSenha: campo(servico, "dataValidadeSenha"),
      glosas: negativa ? glosasDe(negativa) : [],
      observacao: campo(servico, "observacao"),
    };
  }

  const falha = campo(xml, "tissFault") ?? campo(xml, "faultstring") ?? campo(xml, "Text");
  if (falha) return { tipo: "falha", mensagem: falha };
  return { tipo: "falha", mensagem: "Resposta da operadora sem autorização nem mensagem de erro." };
}
