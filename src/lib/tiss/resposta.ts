// Leitura das respostas do webservice: autorizacaoProcedimentoWS (à
// solicitacaoProcedimento: autorização, negativa ou mensagem de erro),
// respostaElegibilidadeWS ou um SOAP Fault com o tissFault.
//
// Funções puras sobre o texto da resposta. Os campos são achados pelo nome,
// com qualquer prefixo de namespace, porque cada operadora monta o envelope
// do seu jeito.

const decodificar = (t: string) =>
  t
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();

/** Conteúdo de cada ocorrência do campo, com qualquer prefixo de namespace. */
function campos(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${tag}>`, "g");
  return [...xml.matchAll(re)].map((m) => decodificar(m[1])).filter(Boolean);
}
const campo = (xml: string, tag: string) => campos(xml, tag)[0] ?? null;

/** Conteúdo do primeiro elemento composto com esse nome. */
function trecho(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`);
  return xml.match(re)?.[1] ?? null;
}

/** "código - descrição" de cada glosa do trecho (a descrição é opcional). */
function glosasDe(xml: string): string[] {
  const codigos = campos(xml, "codigoGlosa");
  const descricoes = campos(xml, "descricaoGlosa");
  return codigos.map((c, i) => (descricoes.length === codigos.length ? `${c} - ${descricoes[i]}` : c));
}

/** Falha fora do padrão TISS: SOAP Fault (com ou sem tissFault) ou outra coisa. */
function falha(xml: string, semResposta: string): { tipo: "falha"; mensagem: string } {
  const m = campo(xml, "tissFault") ?? campo(xml, "faultstring") ?? campo(xml, "Text");
  return { tipo: "falha", mensagem: m ?? semResposta };
}

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

export function lerRespostaSolicitacao(xml: string): RespostaSolicitacao {
  const erro = trecho(xml, "mensagemErro");
  if (erro !== null) return { tipo: "erro", glosas: glosasDe(erro) };

  const servico = trecho(xml, "autorizacaoServico");
  let status = servico && campo(servico, "statusSolicitacao");
  if (servico && status) {
    const negativa = trecho(servico, "motivosNegativa");
    // A Amil pode responder "autorizada" na guia com o item negado
    // (quantidadeAutorizada 0 e glosa): vale o que foi liberado nos itens.
    const autorizadas = campos(servico, "quantidadeAutorizada").map(Number);
    if ((status === "1" || status === "7") && autorizadas.length) {
      if (autorizadas.every((q) => q === 0)) status = "3";
      else if (autorizadas.some((q) => q === 0)) status = "7";
    }
    return {
      tipo: "autorizacao",
      status,
      numeroGuiaOperadora: campo(servico, "numeroGuiaOperadora"),
      senha: status === "3" ? null : campo(servico, "senha"),
      validadeSenha: campo(servico, "dataValidadeSenha"),
      glosas: negativa ? glosasDe(negativa) : [],
      observacao: campo(servico, "observacao"),
    };
  }

  return falha(xml, "Resposta da operadora sem autorização nem mensagem de erro.");
}

export type RespostaElegibilidade =
  | { tipo: "recibo"; elegivel: boolean; nome: string | null; carteira: string | null; validade: string | null; glosas: string[] }
  | { tipo: "erro"; glosas: string[] }
  | { tipo: "falha"; mensagem: string };

export function lerRespostaElegibilidade(xml: string): RespostaElegibilidade {
  const resposta = trecho(xml, "respostaElegibilidade");
  if (resposta !== null) {
    const recibo = trecho(resposta, "reciboElegibilidade");
    if (recibo === null) return { tipo: "erro", glosas: glosasDe(resposta) };
    return {
      tipo: "recibo",
      elegivel: campo(recibo, "respostaSolicitacao") === "S",
      nome: campo(recibo, "nomeBeneficiario"),
      carteira: campo(recibo, "numeroCarteira"),
      validade: campo(recibo, "validadeCarteira"),
      glosas: glosasDe(trecho(recibo, "motivosNegativa") ?? ""),
    };
  }
  return falha(xml, "Resposta da operadora sem recibo de elegibilidade.");
}
