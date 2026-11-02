import { afterEach, describe, expect, it, vi } from "vitest";
import { montarPedidoElegibilidade } from "@/lib/tiss/elegibilidade";
import { lerRespostaElegibilidade, lerRespostaSolicitacao } from "@/lib/tiss/resposta";
import { montarSolicitacaoSpSadt, type DadosSolicitacaoSpSadt } from "@/lib/tiss/solicitacao";
import { validarMensagemTiss } from "@/lib/tiss/validarXsd";
import { configAmil, envelopeSoap, enviarSoap } from "@/lib/tiss/webservice";
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

describe("token do beneficiário", () => {
  it("vai no codValidacao, antes da etapa, e a guia segue válida pelo schema", async () => {
    const r = montarSolicitacaoSpSadt({ ...dados, codValidacao: "482913" });
    if (!r.ok) throw new Error(r.erros.join("; "));
    expect(r.xml).toMatch(/<\/ans:cabecalhoSolicitacao>\s*<ans:codValidacao>482913<\/ans:codValidacao>\s*<ans:tipoEtapaAutorizacao>1<\/ans:tipoEtapaAutorizacao>/);
    expect(await validarMensagemTiss(r.xmlUtf8)).toEqual([]);
  });

  it("recusa token com espaço ou longo demais", () => {
    expect(montarSolicitacaoSpSadt({ ...dados, codValidacao: "12345678901" })).toMatchObject({ ok: false });
    expect(montarSolicitacaoSpSadt({ ...dados, codValidacao: "12 34" })).toMatchObject({ ok: false });
  });
});

describe("envelope e configuração", () => {
  it("põe a mensagem no Body sem a declaração XML dela", () => {
    const env = envelopeSoap(montar().xml);
    expect(env.match(/<\?xml/g)).toHaveLength(1);
    expect(env).toContain("<soapenv:Body>\n<ans:solicitacaoProcedimentoWS");
  });

  it("aponta o que falta no .env e calcula o MD5 da senha", () => {
    expect(configAmil({})).toEqual({ ok: false, faltando: ["TISS_AMIL_URL", "TISS_AMIL_LOGIN", "TISS_AMIL_SENHA"] });
    const c = configAmil({ TISS_AMIL_URL: "https://exemplo/soap", TISS_AMIL_LOGIN: " 123 ", TISS_AMIL_SENHA: "123456" });
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
      conferir: null,
    });
  });

  const comItensStatus = (status: string, ...itens: [number | string, string?][]) =>
    lerRespostaSolicitacao(
      envelope(
        `<ans:autorizacaoProcedimentoWS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas">${cabecalho}` +
          "<ans:autorizacaoProcedimento><ans:autorizacaoServico><ans:dadosAutorizacao><ans:senha>EX1</ans:senha></ans:dadosAutorizacao>" +
          `<ans:statusSolicitacao>${status}</ans:statusSolicitacao><ans:servicosAutorizados>` +
          itens
            .map(([q, glosa]) =>
              `<ans:servicoAutorizado><ans:quantidadeSolicitada>1</ans:quantidadeSolicitada><ans:quantidadeAutorizada>${q}</ans:quantidadeAutorizada>` +
              (glosa ? `<ans:motivosNegativa><ans:codigoGlosa>${glosa}</ans:codigoGlosa></ans:motivosNegativa>` : "") +
              "</ans:servicoAutorizado>",
            )
            .join("") +
          "</ans:servicosAutorizados></ans:autorizacaoServico></ans:autorizacaoProcedimento><ans:hash>x</ans:hash></ans:autorizacaoProcedimentoWS>",
      ),
    );

  const comItens = (...itens: [number | string, string?][]) => comItensStatus("1", ...itens);

  it("guia 'autorizada' com o item negado (quantidade 0) conta como negada, sem senha", () => {
    expect(comItens([0, "3145"])).toMatchObject({ status: "3", senha: null, glosas: ["3145"] });
  });

  it("um item liberado e outro negado é autorização parcial", () => {
    expect(comItens([1], [0, "3145"])).toMatchObject({ status: "7", senha: "EX1" });
    expect(comItens([1])).toMatchObject({ status: "1", senha: "EX1", glosas: [] });
  });

  it("quantidade autorizada vazia ou que não é número pede conferência", () => {
    expect(comItens([""])).toMatchObject({ status: "1", conferir: expect.stringMatching(/ilegível/) });
    expect(comItens(["abc"])).toMatchObject({ status: "1", conferir: expect.stringMatching(/ilegível/) });
    expect(comItens([1])).toMatchObject({ conferir: null });
  });

  it("status 7 sem quantidade pede conferência; status 1 sem quantidade, não", () => {
    expect(comItensStatus("7")).toMatchObject({ status: "7", conferir: expect.stringMatching(/parcial/) });
    expect(comItensStatus("1")).toMatchObject({ status: "1", conferir: null });
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

describe("elegibilidade", () => {
  const pedido = (p = {}) =>
    montarPedidoElegibilidade({
      sequencialTransacao: "761234567890",
      agora: new Date("2026-10-25T17:00:00Z"),
      registroAns: "326305",
      codigoPrestador: "12493066",
      carteirinha: "074.929.371",
      ...p,
    });

  it("monta o pedido válido pelo schema da ANS, com login", async () => {
    const r = pedido({ validadeCarteira: "2027-01-31" });
    if (!r.ok) throw new Error(r.erros.join("; "));
    expect(r.xml).toContain("<ans:tipoTransacao>VERIFICA_ELEGIBILIDADE</ans:tipoTransacao>");
    expect(r.xml).toContain("<ans:numeroCarteira>074929371</ans:numeroCarteira>");
    expect(await validarMensagemTiss(r.xmlUtf8)).toEqual([]);
    expect(await validarMensagemTiss(comLoginSenha(r.xmlUtf8, "12493066", "0".repeat(32)))).toEqual([]);
  });

  it("aponta o que falta", () => {
    expect(pedido({ registroAns: null, carteirinha: "" })).toEqual({
      ok: false,
      erros: ["Convênio sem registro ANS (6 dígitos)", "Sem carteirinha"],
    });
  });

  it("lê o recibo: elegível, não elegível e glosa", () => {
    const recibo = (corpo: string) =>
      envelope(`<ans:respostaElegibilidadeWS><ans:respostaElegibilidade>${corpo}</ans:respostaElegibilidade></ans:respostaElegibilidadeWS>`);
    expect(
      lerRespostaElegibilidade(
        recibo(
          "<ans:reciboElegibilidade><ans:registroANS>326305</ans:registroANS><ans:numeroCarteira>074929371</ans:numeroCarteira>" +
            "<ans:validadeCarteira>2027-01-31</ans:validadeCarteira><ans:nomeBeneficiario>ANA TESTE</ans:nomeBeneficiario>" +
            "<ans:respostaSolicitacao>S</ans:respostaSolicitacao></ans:reciboElegibilidade>",
        ),
      ),
    ).toEqual({ tipo: "recibo", elegivel: true, nome: "ANA TESTE", carteira: "074929371", validade: "2027-01-31", glosas: [] });
    expect(
      lerRespostaElegibilidade(
        recibo(
          "<ans:reciboElegibilidade><ans:nomeBeneficiario>ANA</ans:nomeBeneficiario><ans:respostaSolicitacao>N</ans:respostaSolicitacao>" +
            "<ans:motivosNegativa><ans:motivoNegativa><ans:codigoGlosa>1013</ans:codigoGlosa><ans:descricaoGlosa>Cadastro cancelado</ans:descricaoGlosa>" +
            "</ans:motivoNegativa></ans:motivosNegativa></ans:reciboElegibilidade>",
        ),
      ),
    ).toMatchObject({ tipo: "recibo", elegivel: false, glosas: ["1013 - Cadastro cancelado"] });
    expect(
      lerRespostaElegibilidade(recibo("<ans:codigoGlosa><ans:codigoGlosa>1001</ans:codigoGlosa></ans:codigoGlosa>")),
    ).toEqual({ tipo: "erro", glosas: ["1001"] });
  });
});

describe("enviarSoap: se a mensagem pode ter chegado à operadora", () => {
  const config = { url: "https://exemplo.invalid/ws", login: "1", senhaMd5: "x" };
  const msg = "<ans:cabecalho>\n  <ans:Padrao>4.03.00</ans:Padrao>\n</ans:cabecalho>";
  afterEach(() => vi.unstubAllGlobals());

  it("sem conexão ou barrado no gateway (4xx): não chegou", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    expect(await enviarSoap(msg, config)).toMatchObject({ ok: false, chegou: false });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Access Denied", { status: 403 })));
    expect(await enviarSoap(msg, config)).toMatchObject({ ok: false, chegou: false });
  });

  it("tempo esgotado ou erro do servidor (5xx): pode ter chegado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" })));
    expect(await enviarSoap(msg, config)).toMatchObject({ ok: false, chegou: true });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("erro", { status: 502 })));
    expect(await enviarSoap(msg, config)).toMatchObject({ ok: false, chegou: true });
  });
});
