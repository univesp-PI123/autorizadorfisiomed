import { describe, expect, it } from "vitest";
import { codigoParaGuia, codigosAceitos } from "@/lib/regras/codigoGuia";
import { analisarSessao, mesmoProcedimento, pedidoDaSessao, type ContextoAnalise, type SessaoParaAnalise } from "@/lib/regras/pendencias";

const AMIL = "conv-amil";

const PEDIDO = { convenioId: null, dataPedido: "2026-09-01", validoAte: "2026-12-01", arquivos: 2, cbo: "225124", indicacao: true };

const sessao = (p: Partial<SessaoParaAnalise> = {}): SessaoParaAnalise => ({
  data: "2026-09-28",
  statusAnclinic: "Marcado Nao Confirmado",
  statusFaturamento: "Autorização",
  senhaAutorizacao: null,
  removidoEm: null,
  carteirinha: "074929371",
  convenioAnclinic: "Amil",
  pacienteId: "pac-1",
  convenio: { id: AMIL, integracao: "tiss_amil", codigoPrestador: "12493066", codigoAns: "326305" },
  procedimento: { codigoGuia: "50000470", codigosAceitos: ["50000470"] },
  profissional: { conselho: "CRP", numeroConselho: "123", ufConselho: "SP", cbo: "251510", convenioIds: [AMIL] },
  unidade: { cnes: "4160088" },
  token: { valor: "482913", dia: p.data ?? "2026-09-28" },
  ...p,
});

const ctx = (p: Partial<ContextoAnalise> = {}): ContextoAnalise => ({
  clinicaCadastrada: true,
  pedidos: [PEDIDO],
  autorizacoes: [],
  ...p,
});

describe("analisarSessao", () => {
  it("sessão completa fica pronta para solicitar", () => {
    expect(analisarSessao(sessao(), ctx())).toEqual({ situacao: "pronta", pendencias: [] });
  });

  it("cancelada, desmarcada ou excluída não entra", () => {
    expect(analisarSessao(sessao({ statusAnclinic: "Desmarcado pelo Profissional" }), ctx()).situacao).toBe("cancelada");
    expect(analisarSessao(sessao({ statusAnclinic: "Nao Compareceu" }), ctx()).situacao).toBe("cancelada");
    expect(analisarSessao(sessao({ removidoEm: new Date() }), ctx()).situacao).toBe("cancelada");
  });

  it("fora da integração: convênio manual, não vinculado ou faturamento por assinatura", () => {
    expect(analisarSessao(sessao({ convenio: null }), ctx()).situacao).toBe("fora");
    expect(analisarSessao(sessao({ convenio: { id: AMIL, integracao: "manual", codigoPrestador: null } }), ctx()).situacao).toBe("fora");
    expect(analisarSessao(sessao({ statusFaturamento: "Assinatura" }), ctx()).situacao).toBe("fora");
  });

  it("coberta por senha do AnClinic ou por autorização vigente com saldo", () => {
    expect(analisarSessao(sessao({ senhaAutorizacao: "129502308" }), ctx()).situacao).toBe("coberta");
    const aut = { convenioId: AMIL, codigoProcedimento: "50000470", status: "autorizada", dataInicioVigencia: "2026-09-01", dataFimVigencia: "2026-09-30" };
    expect(analisarSessao(sessao(), ctx({ autorizacoes: [{ ...aut, saldo: 3 }] })).situacao).toBe("coberta");
    expect(analisarSessao(sessao(), ctx({ autorizacoes: [{ ...aut, saldo: 0 }] })).situacao).toBe("pronta");
    expect(analisarSessao(sessao({ data: "2026-10-01" }), ctx({ autorizacoes: [{ ...aut, saldo: 3 }] })).situacao).toBe("pronta");
  });

  it("lista o que falta", () => {
    const r = analisarSessao(
      sessao({
        procedimento: { codigoGuia: null, codigosAceitos: [] },
        profissional: { conselho: null, numeroConselho: null, ufConselho: null, cbo: null, convenioIds: [] },
        unidade: { cnes: null },
      }),
      ctx({ pedidos: [], clinicaCadastrada: false }),
    );
    expect(r.situacao).toBe("pendente");
    expect(r.pendencias).toEqual([
      "Dados da clínica não cadastrados",
      "Unidade sem CNES",
      "Procedimento sem código para a operadora",
      "Profissional sem conselho/número/UF",
      "Profissional sem CBO",
      "Profissional não credenciado no convênio",
      "Sem pedido médico válido",
    ]);
  });

  it("sessão sem unidade no AnClinic", () => {
    expect(analisarSessao(sessao({ unidade: null }), ctx()).pendencias).toEqual(["Sessão sem unidade de atendimento"]);
  });

  it("pedido médico vencido ou sem PDF", () => {
    expect(analisarSessao(sessao(), ctx({ pedidos: [{ ...PEDIDO, dataPedido: "2026-01-01", validoAte: "2026-06-30" }] })).pendencias)
      .toEqual(["Sem pedido médico válido"]);
    expect(analisarSessao(sessao(), ctx({ pedidos: [{ ...PEDIDO, convenioId: AMIL, validoAte: null, arquivos: 0 }] })).pendencias)
      .toEqual(["Pedido médico sem PDF anexado"]);
  });

  it("pedido médico sem os dados que a guia exige do médico", () => {
    expect(analisarSessao(sessao(), ctx({ pedidos: [{ ...PEDIDO, cbo: null, indicacao: false }] })).pendencias).toEqual([
      "Pedido médico sem CBO do médico",
      "Pedido médico sem indicação clínica nem CID",
    ]);
  });

  it("convênio sem registro ANS", () => {
    expect(analisarSessao(sessao({ convenio: { id: AMIL, integracao: "tiss_amil", codigoPrestador: "1", codigoAns: null } }), ctx()).pendencias)
      .toEqual(["Convênio sem registro ANS"]);
  });

  it("vale o pedido mais recente entre os vigentes", () => {
    const antigo = { ...PEDIDO, id: "antigo", dataPedido: "2026-03-01" };
    const novo = { ...PEDIDO, id: "novo", dataPedido: "2026-09-01" };
    expect(pedidoDaSessao([antigo, novo], AMIL, "2026-09-28")?.id).toBe("novo");
    expect(pedidoDaSessao([antigo, novo], AMIL, "2026-08-01")?.id).toBe("antigo");
  });
  it("guia autorizada pela operadora cobre a sessão", () => {
    expect(analisarSessao(sessao({ token: null, guiaAutorizada: { numero: 18, senha: "EX1" } }), ctx())).toEqual({
      situacao: "coberta",
      pendencias: [],
      motivo: "Guia 18 autorizada pela operadora (senha EX1).",
    });
  });
  it("guia a conferir deixa a sessão pendente, com o motivo", () => {
    expect(analisarSessao(sessao({ guiaConferir: { numero: 19, motivo: "a operadora não respondeu ao envio" } }), ctx())).toEqual({
      situacao: "pendente",
      pendencias: ["Guia 19: a operadora não respondeu ao envio. Confira no portal da Amil"],
    });
  });
  it("Amil: sem token, ou com token de outro dia, fica pendente", () => {
    const pend = "Sem token do paciente do dia da sessão";
    expect(analisarSessao(sessao({ token: null }), ctx())).toEqual({ situacao: "pendente", pendencias: [pend] });
    expect(analisarSessao(sessao({ token: { valor: "482913", dia: "2026-09-27" } }), ctx()).pendencias).toEqual([pend]);
    const outro = { id: AMIL, integracao: "tiss_outra", codigoPrestador: "1", codigoAns: "000001" };
    expect(analisarSessao(sessao({ token: null, convenio: outro }), ctx()).situacao).toBe("pronta");
  });
});

describe("codigoParaGuia", () => {
  const proc = {
    codigoTuss: "50000470",
    tabelaTuss: "22",
    equivalencias: [{ convenioId: "amil", codigo: "9001", tabela: "98", codigoTuss: "50000470" }],
  };
  it("usa o de/para da operadora quando existe", () => {
    expect(codigoParaGuia(proc, "amil")).toEqual({ codigo: "9001", tabela: "98", origem: "operadora" });
    expect(codigosAceitos(proc, "amil")).toEqual(["9001", "50000470"]);
  });
  it("sem de/para, usa o TUSS do procedimento", () => {
    expect(codigoParaGuia(proc, "outro")).toEqual({ codigo: "50000470", tabela: "22", origem: "tuss" });
    expect(codigoParaGuia({ codigoTuss: null, tabelaTuss: null }, "amil")).toBeNull();
  });
});

describe("cobertura por autorização registrada no sistema", () => {
  const aut = { id: "aut-1", convenioId: AMIL, codigoProcedimento: null, status: "autorizada", dataInicioVigencia: "2026-09-01", dataFimVigencia: "2026-09-30", saldo: 5 };
  it("vale também para convênio sem envio automático, e diz qual autorização", () => {
    const manual = sessao({ convenio: { id: AMIL, integracao: "manual", codigoPrestador: null } });
    const r = analisarSessao(manual, ctx({ autorizacoes: [{ ...aut, codigoProcedimento: "50000470" }] }));
    expect(r).toMatchObject({ situacao: "coberta", autorizacaoId: "aut-1" });
  });
  it("autorização sem código casa pelo nome do procedimento", () => {
    const s = sessao({ procedimento: { codigoGuia: null, codigosAceitos: [], descricao: "PSICOLOGIA ABA" } });
    expect(analisarSessao(s, ctx({ autorizacoes: [{ ...aut, procedimento: "Sessão de Psicologia ABA" }] })).situacao).toBe("coberta");
    expect(analisarSessao(s, ctx({ autorizacoes: [{ ...aut, procedimento: "Fonoaudiologia ABA" }] })).situacao).not.toBe("coberta");
  });
});

describe("mesmoProcedimento", () => {
  const sessao = { codigosAceitos: ["9010", "50000470"], descricao: "PSICOLOGIA ABA" };
  it("pelo código", () => expect(mesmoProcedimento({ codigoProcedimento: "9010" }, sessao)).toBe(true));
  it("pelo nome ou pela especialidade", () => {
    expect(mesmoProcedimento({ codigoProcedimento: null, procedimento: "Psicologia" }, sessao)).toBe(true);
    expect(mesmoProcedimento({ codigoProcedimento: null, procedimento: "Terapia ABA - psicologia" }, sessao)).toBe(true);
    expect(mesmoProcedimento({ codigoProcedimento: null, procedimento: "Psicopedagogia" }, sessao)).toBe(false);
    expect(mesmoProcedimento({ codigoProcedimento: "123", procedimento: "Fono" }, sessao)).toBe(false);
  });
});
