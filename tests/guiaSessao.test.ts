import { describe, expect, it } from "vitest";
import { efeitoDaGuia, guiaQueDecide, type GuiaParaSessao } from "@/lib/regras/guiaSessao";

const guia = (p: Partial<GuiaParaSessao> = {}): GuiaParaSessao => ({
  numero: 18,
  statusOperadora: "1",
  senhaOperadora: "EX1",
  validadeSenha: "2026-11-30",
  dataSessao: "2026-11-02",
  conferir: null,
  ...p,
});

describe("efeito da guia na sessão", () => {
  it("autorizada (1 ou 7) dentro da validade cobre a sessão", () => {
    expect(efeitoDaGuia(guia(), "2026-11-02")).toBe("cobre");
    expect(efeitoDaGuia(guia({ statusOperadora: "7" }), "2026-11-02")).toBe("cobre");
    expect(efeitoDaGuia(guia({ validadeSenha: null }), "2026-11-02")).toBe("cobre");
  });

  it("senha vencida antes da sessão não cobre", () => {
    expect(efeitoDaGuia(guia({ validadeSenha: "2026-11-01" }), "2026-11-02")).toBe("livre");
  });

  it("sessão remarcada para outro dia: a guia da data antiga não vale", () => {
    expect(efeitoDaGuia(guia({ dataSessao: "2026-10-30" }), "2026-11-02")).toBe("livre");
    expect(efeitoDaGuia(guia({ dataSessao: null }), "2026-11-02")).toBe("cobre");
  });

  it("a conferir, em análise, negada e recusada", () => {
    expect(efeitoDaGuia(guia({ conferir: "x" }), "2026-11-02")).toBe("conferir");
    expect(efeitoDaGuia(guia({ statusOperadora: null, conferir: "x" }), "2026-11-02")).toBe("conferir");
    expect(efeitoDaGuia(guia({ statusOperadora: "2" }), "2026-11-02")).toBe("bloqueia");
    expect(efeitoDaGuia(guia({ statusOperadora: "3" }), "2026-11-02")).toBe("livre");
    expect(efeitoDaGuia(guia({ statusOperadora: null }), "2026-11-02")).toBe("livre");
  });

  it("entre várias guias, decide a que cobre, depois a que pede conferência", () => {
    const negada = guia({ numero: 20, statusOperadora: "3" });
    const conferir = guia({ numero: 19, statusOperadora: null, conferir: "x" });
    const autorizada = guia({ numero: 18 });
    expect(guiaQueDecide([negada, conferir, autorizada], "2026-11-02")).toMatchObject({ efeito: "cobre", guia: { numero: 18 } });
    expect(guiaQueDecide([negada, conferir], "2026-11-02")).toMatchObject({ efeito: "conferir", guia: { numero: 19 } });
    expect(guiaQueDecide([negada], "2026-11-02")).toBeNull();
  });
});
