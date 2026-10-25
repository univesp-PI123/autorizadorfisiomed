import { describe, expect, it } from "vitest";
import { lerRespostaSolicitacao } from "@/lib/tiss/resposta";
import { montarSolicitacaoSpSadt, type DadosSolicitacaoSpSadt } from "@/lib/tiss/solicitacao";
import { validarMensagemTiss } from "@/lib/tiss/validarXsd";
import { configAmil, envelopeSoap } from "@/lib/tiss/webservice";
import { comLoginSenha, hashDoXml } from "@/lib/tiss/xml";

const dados: DadosSolicitacaoSpSadt = {
  numeroGuiaPrestador: "17",
  sequencialTransacao: "17",
  agora: new Date("2026-10-15T13:05:09Z"),
  registroAns: "326305",
  prestador: { codigoNaOperadora: "12493066", nome: "Fisiomed ABA Ltda" },
  carteirinha: "074929371",
  solicitante: { nome: "Dra. Ana Lúcia Souza", conselho: "CRM", numeroConselho: "123456", uf: "SP", cbo: "225124" },
  dataSolicitacao: "2026-09-01",
  indicacaoClinica: "TEA (CID F84.0) & terapia ABA",
  procedimentos: [{ tabela: "22", codigo: "50000470", descricao: "Sessão de psicoterapia individual", quantidade: 1 }],
  cnes: "4160088",
};
const montar = () => {
  const r = montarSolicitacaoSpSadt(dados);
  if (!r.ok) throw new Error(r.erros.join("; "));
  return r;
};

describe("login e senha no cabeçalho", () => {
  it("hashDoXml recalcula o mesmo hash da montagem", () => {
    const r = montar();
    expect(hashDoXml(r.xml)).toBe(r.hash);
  });

  it("inclui o login, recalcula o hash e continua válido pelo schema", async () => {
    const r = montar();
    const comLogin = comLoginSenha(r.xmlUtf8, "12345678901", "e10adc3949ba59abbe56e057f20f883e");
    expect(comLogin).toMatch(/<\/ans:Padrao>\s*<ans:loginSenhaPrestador>\s*<ans:loginPrestador>12345678901<\/ans:loginPrestador>/);
    expect(comLogin).not.toContain(`<ans:hash>${r.hash}</ans:hash>`);
    expect(comLogin).toContain(`<ans:hash>${hashDoXml(comLogin)}</ans:hash>`);
    expect(await validarMensagemTiss(comLogin)).toEqual([]);
  });

  it("o XML gravado não leva a senha", () => {
    expect(montar().xml).not.toContain("senhaPrestador");
  });
});

describe("envelope e configuração", () => {
  it("põe a mensagem no Body sem a declaração XML dela", () => {
    const env = envelopeSoap(montar().xml);
    expect(env.match(/<\?xml/g)).toHaveLength(1);
    expect(env).toContain("<soapenv:Body>\n<ans:solicitacaoProcedimentoWS");
  });

  it("aponta o que falta no .env e calcula o MD5 da senha", () => {
    expect(configAmil({})).toEqual({ ok: false, faltando: ["TISS_AMIL_URL_SOLICITACAO", "TISS_AMIL_LOGIN", "TISS_AMIL_SENHA"] });
    const c = configAmil({ TISS_AMIL_URL_SOLICITACAO: "https://exemplo/soap", TISS_AMIL_LOGIN: " 123 ", TISS_AMIL_SENHA: "123456" });
    expect(c).toEqual({ ok: true, config: { url: "https://exemplo/soap", login: "123", senhaMd5: "e10adc3949ba59abbe56e057f20f883e" } });
  });
});

const envelope = (corpo: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body>${corpo}</S:Body></S:Envelope>`;
const cabecalho =
  "<ans:cabecalho><ans:identificacaoTransacao><ans:tipoTransacao>AUTORIZACAO_ODONTOLOGIA</ans:tipoTransacao>" +
  "<ans:sequencialTransacao>99</ans:sequencialTransacao></ans:identificacaoTransacao></ans:cabecalho>";

describe("lerRespostaSolicitacao", () => {
  it("autorização com senha", () => {
    const r = lerRespostaSolicitacao(
      envelope(
        `<ans:autorizacaoProcedimentoWS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas">${cabecalho}` +
          "<ans:autorizacaoProcedimento><ans:autorizacaoServico><ans:dadosAutorizacao>" +
          "<ans:numeroGuiaPrestador>17</ans:numeroGuiaPrestador><ans:numeroGuiaOperadora>A9876</ans:numeroGuiaOperadora>" +
          "<ans:dataAutorizacao>2026-10-25</ans:dataAutorizacao><ans:senha>SEN123</ans:senha>" +
          "<ans:dataValidadeSenha>2026-11-24</ans:dataValidadeSenha></ans:dadosAutorizacao>" +
          "<ans:statusSolicitacao>1</ans:statusSolicitacao></ans:autorizacaoServico></ans:autorizacaoProcedimento>" +
          "<ans:hash>x</ans:hash></ans:autorizacaoProcedimentoWS>",
      ),
    );
    expect(r).toEqual({
      tipo: "autorizacao",
      status: "1",
      numeroGuiaOperadora: "A9876",
      senha: "SEN123",
      validadeSenha: "2026-11-24",
      glosas: [],
      observacao: null,
    });
  });

  it("negativa com os códigos de glosa, com outro prefixo de namespace", () => {
    const r = lerRespostaSolicitacao(
      envelope(
        '<t:autorizacaoProcedimentoWS xmlns:t="http://www.ans.gov.br/padroes/tiss/schemas"><t:autorizacaoProcedimento>' +
          "<t:autorizacaoServico><t:statusSolicitacao>3</t:statusSolicitacao><t:motivosNegativa>" +
          "<t:codigoGlosa>1702</t:codigoGlosa><t:codigoGlosa>1801</t:codigoGlosa></t:motivosNegativa>" +
          "<t:observacao>Carteira inválida &amp; vencida</t:observacao></t:autorizacaoServico></t:autorizacaoProcedimento></t:autorizacaoProcedimentoWS>",
      ),
    );
    expect(r).toMatchObject({ tipo: "autorizacao", status: "3", glosas: ["1702", "1801"], observacao: "Carteira inválida & vencida" });
  });

  it("mensagem de erro da operadora", () => {
    const r = lerRespostaSolicitacao(
      envelope(
        "<ans:autorizacaoProcedimentoWS><ans:autorizacaoProcedimento><ans:mensagemErro>" +
          "<ans:codigoGlosa>5014</ans:codigoGlosa><ans:descricaoGlosa>Hash inválido</ans:descricaoGlosa>" +
          "</ans:mensagemErro></ans:autorizacaoProcedimento></ans:autorizacaoProcedimentoWS>",
      ),
    );
    expect(r).toEqual({ tipo: "erro", glosas: ["5014 - Hash inválido"] });
  });

  it("SOAP Fault com tissFault", () => {
    const r = lerRespostaSolicitacao(
      envelope(
        "<S:Fault><faultcode>S:Server</faultcode><faultstring>Erro</faultstring><detail>" +
          "<ans:tissFaultWS><ans:tissFault>CredenciaisInvalidas</ans:tissFault></ans:tissFaultWS></detail></S:Fault>",
      ),
    );
    expect(r).toEqual({ tipo: "falha", mensagem: "CredenciaisInvalidas" });
  });

  it("resposta que não é TISS", () => {
    expect(lerRespostaSolicitacao("<html>Bad gateway</html>").tipo).toBe("falha");
  });
});
