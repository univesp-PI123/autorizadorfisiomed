import { describe, expect, it } from "vitest";
import {
  datasDaVerificacao,
  elegibilidadeVencida,
  horaDePedir,
  horaDoPedido,
  instanteNoFuso,
  MAXIMO_CONSULTAS,
  proximaConsultaStatus,
} from "@/lib/regras/rotina";

describe("pedido na véspera", () => {
  it("sessão de terça a sexta é pedida no dia anterior, às 7h (horário de Brasília)", () => {
    // 2026-11-11 é quarta-feira.
    expect(horaDoPedido("2026-11-11").toISOString()).toBe("2026-11-10T10:00:00.000Z");
  });

  it("sessão de segunda-feira é pedida na própria segunda, às 0h05, e nunca no domingo", () => {
    // 2026-11-09 é segunda-feira.
    expect(horaDoPedido("2026-11-09").toISOString()).toBe("2026-11-09T03:05:00.000Z");
  });

  it("só pede depois do horário e enquanto a sessão não passou", () => {
    expect(horaDePedir("2026-11-11", new Date("2026-11-10T09:59:00Z"))).toBe(false);
    expect(horaDePedir("2026-11-11", new Date("2026-11-10T10:00:00Z"))).toBe(true);
    // Sessão importada tarde: no próprio dia ainda pede.
    expect(horaDePedir("2026-11-11", new Date("2026-11-11T14:00:00Z"))).toBe(true);
    // Dia seguinte (no fuso da clínica): já passou.
    expect(horaDePedir("2026-11-11", new Date("2026-11-12T12:00:00Z"))).toBe(false);
    // Domingo à noite não pede a sessão de segunda.
    expect(horaDePedir("2026-11-09", new Date("2026-11-08T23:00:00Z"))).toBe(false);
  });

  it("converte o horário do fuso da clínica para UTC", () => {
    expect(instanteNoFuso("2026-11-10", "07:00").toISOString()).toBe("2026-11-10T10:00:00.000Z");
  });
});

describe("verificação antecipada", () => {
  it("cobre hoje e os três dias seguintes, no fuso da clínica", () => {
    // 23h30 em Brasília do dia 10 já é dia 11 em UTC.
    expect(datasDaVerificacao(new Date("2026-11-11T02:30:00Z"))).toEqual(["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13"]);
  });

  it("a elegibilidade vale para o dia em que foi verificada", () => {
    const agora = new Date("2026-11-10T15:00:00Z");
    expect(elegibilidadeVencida(null, agora)).toBe(true);
    expect(elegibilidadeVencida(new Date("2026-11-10T11:00:00Z"), agora)).toBe(false);
    expect(elegibilidadeVencida(new Date("2026-11-09T20:00:00Z"), agora)).toBe(true);
  });
});

describe("consulta do status", () => {
  const agora = new Date("2026-11-10T12:00:00Z");
  const depois = (n: number) => (proximaConsultaStatus(n, agora)!.getTime() - agora.getTime()) / 60_000;

  it("15 min, 30 min, 1 h, 2 h e depois a cada 4 h", () => {
    expect([0, 1, 2, 3, 4, 50].map(depois)).toEqual([15, 30, 60, 120, 240, 240]);
  });

  it("desiste depois de cerca de 30 dias", () => {
    expect(MAXIMO_CONSULTAS).toBe(184);
    expect(proximaConsultaStatus(MAXIMO_CONSULTAS, agora)).toBeNull();
  });
});
