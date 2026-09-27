import { describe, expect, it } from "vitest";
import { analisarSessao, type ContextoAnalise, type SessaoParaAnalise } from "@/lib/regras/pendencias";

const AMIL = "conv-amil";

const sessao = (p: Partial<SessaoParaAnalise> = {}): SessaoParaAnalise => ({
  data: "2026-09-28",
  statusAnclinic: "Marcado Nao Confirmado",
  statusFaturamento: "Autorização",
  senhaAutorizacao: null,
  removidoEm: null,
  carteirinha: "074929371",
  convenioAnclinic: "Amil",
  pacienteId: "pac-1",
  convenio: { id: AMIL, integracao: "tiss_amil", codigoPrestador: "12493066" },
  procedimento: { codigoTuss: "50000470" },
  profissional: { conselho: "CRP", numeroConselho: "123", ufConselho: "SP", cbo: "251510", convenioIds: [AMIL] },
  unidade: { cnes: "4160088" },
  ...p,
});

const ctx = (p: Partial<ContextoAnalise> = {}): ContextoAnalise => ({
  clinicaCadastrada: true,
  pedidos: [{ convenioId: null, dataPedido: "2026-09-01", validoAte: "2026-12-01", arquivos: 2 }],
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
        procedimento: { codigoTuss: null },
        profissional: { conselho: null, numeroConselho: null, ufConselho: null, cbo: null, convenioIds: [] },
        unidade: { cnes: null },
      }),
      ctx({ pedidos: [], clinicaCadastrada: false }),
    );
    expect(r.situacao).toBe("pendente");
    expect(r.pendencias).toEqual([
      "Dados da clínica não cadastrados",
      "Unidade sem CNES",
      "Procedimento sem código TUSS",
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
    expect(analisarSessao(sessao(), ctx({ pedidos: [{ convenioId: null, dataPedido: "2026-01-01", validoAte: "2026-06-30", arquivos: 2 }] })).pendencias)
      .toEqual(["Sem pedido médico válido"]);
    expect(analisarSessao(sessao(), ctx({ pedidos: [{ convenioId: AMIL, dataPedido: "2026-09-01", validoAte: null, arquivos: 0 }] })).pendencias)
      .toEqual(["Pedido médico sem PDF anexado"]);
  });
});
