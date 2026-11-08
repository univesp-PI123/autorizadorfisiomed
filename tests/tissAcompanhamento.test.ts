import { describe, expect, it } from "vitest";
import { montarCancelaGuia, montarSolicitacaoStatus, type DadosGuiaEnviada } from "@/lib/tiss/acompanhamento";
import { lerRespostaCancelamento, lerRespostaSolicitacao } from "@/lib/tiss/resposta";
import { validarMensagemTiss } from "@/lib/tiss/validarXsd";
import { hashDoXml } from "@/lib/tiss/xml";

const dados: DadosGuiaEnviada = {
  sequencialTransacao: "301",
  agora: new Date("2026-11-10T13:05:09Z"),
  registroAns: "326305",
  codigoPrestador: "12493066",
  numeroGuiaPrestador: "42",
  numeroGuiaOperadora: "987654321",
  carteirinha: "074.929.371",
};

describe("consulta do status da guia", () => {
  it("monta a mensagem válida pelo schema da ANS, com a guia e a carteirinha", async () => {
    const r = montarSolicitacaoStatus(dados);
    if (!r.ok) throw new Error(r.erros.join("; "));
    expect(r.xml).toContain("<ans:tipoTransacao>SOLICITA_STATUS_AUTORIZACAO</ans:tipoTransacao>");
    expect(r.xml).toMatch(/<ans:identificacaoSolicitacao>\s*<ans:registroANS>326305<\/ans:registroANS>\s*<ans:numeroGuiaPrestador>42</);
    expect(r.xml).toContain("<ans:numeroCarteira>074929371</ans:numeroCarteira>");
    expect(hashDoXml(r.xml)).toBe(r.hash);
    expect(await validarMensagemTiss(r.xmlUtf8)).toEqual([]);
  });

  it("lista o que falta", () => {
    expect(montarSolicitacaoStatus({ ...dados, carteirinha: null, registroAns: "12" })).toEqual({
      ok: false,
      erros: ["Convênio sem registro ANS (6 dígitos)", "Sem carteirinha"],
    });
  });

  it("a resposta (situacaoAutorizacaoWS) é lida como a da solicitação", () => {
    const xml = `<ans:situacaoAutorizacaoWS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas"><ans:situacaoAutorizacao>
      <ans:autorizacaoServico><ans:autorizacaoDados><ans:numeroGuiaOperadora>987654321</ans:numeroGuiaOperadora>
      <ans:senha>EX123</ans:senha><ans:dataValidadeSenha>2026-11-15</ans:dataValidadeSenha></ans:autorizacaoDados>
      <ans:statusSolicitacao>1</ans:statusSolicitacao></ans:autorizacaoServico></ans:situacaoAutorizacao></ans:situacaoAutorizacaoWS>`;
    expect(lerRespostaSolicitacao(xml)).toMatchObject({ tipo: "autorizacao", status: "1", senha: "EX123", validadeSenha: "2026-11-15" });
  });
});

describe("cancelamento da guia", () => {
  it("monta a mensagem válida pelo schema da ANS, com o tipo de guia de solicitação", async () => {
    const r = montarCancelaGuia(dados);
    if (!r.ok) throw new Error(r.erros.join("; "));
    expect(r.xml).toContain("<ans:tipoTransacao>CANCELA_GUIA</ans:tipoTransacao>");
    expect(r.xml).toMatch(/<ans:tipoCancelamentoGuia>\s*<ans:tipoGuia>1<\/ans:tipoGuia>\s*<ans:numeroGuiaPrestador>42<\/ans:numeroGuiaPrestador>\s*<ans:numeroGuiaOperadora>987654321</);
    expect(await validarMensagemTiss(r.xmlUtf8)).toEqual([]);
  });

  it("sem o número da operadora, vai só o do prestador", async () => {
    const r = montarCancelaGuia({ ...dados, numeroGuiaOperadora: null });
    if (!r.ok) throw new Error(r.erros.join("; "));
    expect(r.xml).not.toContain("numeroGuiaOperadora");
    expect(await validarMensagemTiss(r.xmlUtf8)).toEqual([]);
  });

  it("lê o recibo: cancelada, guia inexistente, não cancelada e erro", () => {
    const recibo = (status: string) =>
      `<ans:reciboCancelaGuiaWS xmlns:ans="x"><ans:reciboCancelaGuia><ans:reciboCancelaGuia><ans:registroANS>326305</ans:registroANS>
       <ans:retornoStatus><ans:guiasCanceladas><ans:dadosGuia><ans:tipoGuia>1</ans:tipoGuia><ans:numeroGuiaPrestador>42</ans:numeroGuiaPrestador>
       <ans:statusCancelamento>${status}</ans:statusCancelamento></ans:dadosGuia></ans:guiasCanceladas></ans:retornoStatus>
       </ans:reciboCancelaGuia></ans:reciboCancelaGuia></ans:reciboCancelaGuiaWS>`;
    expect(lerRespostaCancelamento(recibo("1"))).toEqual({ tipo: "recibo", status: "1", cancelada: true, descricao: "Cancelada com sucesso" });
    expect(lerRespostaCancelamento(recibo("3"))).toMatchObject({ cancelada: true });
    expect(lerRespostaCancelamento(recibo("2"))).toMatchObject({ cancelada: false, descricao: "Não cancelada" });
    const erro = `<x:reciboCancelaGuiaWS xmlns:x="y"><x:reciboCancelaGuia><x:mensagemErro><x:codigoGlosa>1404</x:codigoGlosa>
      <x:descricaoGlosa>Guia não encontrada</x:descricaoGlosa></x:mensagemErro></x:reciboCancelaGuia></x:reciboCancelaGuiaWS>`;
    expect(lerRespostaCancelamento(erro)).toEqual({ tipo: "erro", glosas: ["1404 - Guia não encontrada"] });
    expect(lerRespostaCancelamento("<html>erro</html>")).toMatchObject({ tipo: "falha" });
  });
});
