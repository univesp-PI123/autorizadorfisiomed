// Portado de frontend/tests/analiseDados.test.js do sistema integrado.
import { describe, expect, it } from "vitest";
import {
  calcularTaxaGlosa,
  classificarUrgencia,
  diasParaVencimento,
  formatarData,
  formatarMes,
  percentualSessoes,
} from "@/lib/analiseDados";

describe("calcularTaxaGlosa", () => {
  it("calcula a taxa de glosa", () => {
    expect(calcularTaxaGlosa(100, 10)).toBe("10.00%");
    expect(calcularTaxaGlosa(200, 50)).toBe("25.00%");
  });
  it("retorna 0 sem atendimentos", () => {
    expect(calcularTaxaGlosa(0, 0)).toBe("0.00%");
    expect(calcularTaxaGlosa(null, 5)).toBe("0.00%");
  });
});

describe("classificarUrgencia", () => {
  it("classifica por dias restantes", () => {
    expect(classificarUrgencia(-1)).toBe("vencido");
    expect(classificarUrgencia(0)).toBe("critico");
    expect(classificarUrgencia(3)).toBe("critico");
    expect(classificarUrgencia(5)).toBe("alerta");
    expect(classificarUrgencia(7)).toBe("alerta");
    expect(classificarUrgencia(10)).toBe("normal");
    expect(classificarUrgencia(null)).toBe("indefinido");
  });
});

describe("diasParaVencimento", () => {
  it("conta dias de calendário", () => {
    expect(diasParaVencimento("2026-10-01", "2026-09-27")).toBe(4);
    expect(diasParaVencimento("2026-09-27", "2026-09-27")).toBe(0);
    expect(diasParaVencimento("2026-09-20", "2026-09-27")).toBe(-7);
  });
  it("atravessa o horário de verão e virada de ano sem erro de arredondamento", () => {
    expect(diasParaVencimento("2027-01-02", "2026-12-30")).toBe(3);
    expect(diasParaVencimento("2026-11-10", "2026-10-25")).toBe(16);
  });
  it("retorna null sem data", () => {
    expect(diasParaVencimento(null)).toBeNull();
  });
});

describe("percentualSessoes", () => {
  it("calcula o percentual", () => {
    expect(percentualSessoes(5, 10)).toBe(50);
    expect(percentualSessoes(10, 10)).toBe(100);
    expect(percentualSessoes(15, 10)).toBe(100); // não passa de 100
    expect(percentualSessoes(0, 10)).toBe(0);
  });
  it("retorna 0 se a quantidade autorizada for 0 ou nula", () => {
    expect(percentualSessoes(5, 0)).toBe(0);
    expect(percentualSessoes(5, null)).toBe(0);
  });
});

describe("formatação", () => {
  it("formata datas sem depender do fuso", () => {
    expect(formatarData("2026-01-01")).toBe("01/01/2026");
    expect(formatarData("2026-01-01T00:00:00.000Z")).toBe("01/01/2026");
    expect(formatarData(null)).toBe("—");
  });
  it("formata meses", () => {
    expect(formatarMes("2026-09")).toBe("set/26");
  });
});

