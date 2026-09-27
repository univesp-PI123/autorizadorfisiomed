import { describe, expect, it } from "vitest";
import { hojeISO, primeiroDiaDoMes, somarDias, somarMeses } from "@/lib/datas";
import { paraCSV } from "@/lib/exportacao";
import { podeTransitar, statusAutomatico } from "@/lib/regras/transicoes";

describe("máquina de estados da autorização", () => {
  it("aceita as transições manuais válidas", () => {
    expect(podeTransitar("pendente", "autorizada")).toBe(true);
    expect(podeTransitar("em_analise", "negada")).toBe(true);
    expect(podeTransitar("negada", "pendente")).toBe(true);
    expect(podeTransitar("autorizada", "cancelada")).toBe(true);
  });
  it("recusa transições inválidas e status só automáticos", () => {
    expect(podeTransitar("pendente", "esgotada")).toBe(false);
    expect(podeTransitar("pendente", "vencida")).toBe(false);
    expect(podeTransitar("cancelada", "autorizada")).toBe(false);
    expect(podeTransitar("vencida", "autorizada")).toBe(false);
    expect(podeTransitar("autorizada", "pendente")).toBe(false);
  });
});

describe("statusAutomatico", () => {
  const base = {
    status: "autorizada" as const,
    dataFimVigencia: "2026-10-10",
    quantidadeAutorizada: 10,
    quantidadeUtilizada: 3,
    hoje: "2026-09-27",
  };
  it("mantém autorizada dentro da vigência e com saldo", () => {
    expect(statusAutomatico(base)).toBe("autorizada");
  });
  it("vence no dia seguinte ao fim da vigência (o último dia ainda vale)", () => {
    expect(statusAutomatico({ ...base, hoje: "2026-10-10" })).toBe("autorizada");
    expect(statusAutomatico({ ...base, hoje: "2026-10-11" })).toBe("vencida");
  });
  it("esgota ao usar todas as sessões", () => {
    expect(statusAutomatico({ ...base, quantidadeUtilizada: 10 })).toBe("esgotada");
  });
  it("sem quantidade/fim definidos, não muda", () => {
    expect(statusAutomatico({ ...base, dataFimVigencia: null, quantidadeAutorizada: null, quantidadeUtilizada: 99 })).toBe("autorizada");
  });
  it("só age sobre autorizadas", () => {
    expect(statusAutomatico({ ...base, status: "pendente", quantidadeUtilizada: 10 })).toBe("pendente");
  });
});

describe("datas no fuso da clínica", () => {
  it("às 23h em São Paulo ainda é o mesmo dia (em UTC já é o seguinte)", () => {
    // 2026-09-28 02:00 UTC = 2026-09-27 23:00 em São Paulo
    expect(hojeISO(new Date("2026-09-28T02:00:00Z"))).toBe("2026-09-27");
    expect(hojeISO(new Date("2026-09-28T03:00:00Z"))).toBe("2026-09-28");
  });
  it("soma dias e meses", () => {
    expect(somarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(somarMeses("2026-09-01", -5)).toBe("2026-04-01");
    expect(primeiroDiaDoMes("2026-09-27")).toBe("2026-09-01");
  });
});

describe("paraCSV", () => {
  it("usa ; e escapa aspas, ; e quebras de linha", () => {
    const csv = paraCSV([{ mes: "2026-09", obs: 'a;b "c"\nd', total: 3 }]);
    expect(csv).toBe('mes;obs;total\n2026-09;"a;b ""c""\nd";3');
  });
});
