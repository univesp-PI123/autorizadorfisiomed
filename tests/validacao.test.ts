import { describe, expect, it } from "vitest";
import { fimDaSessao, sessaoRealizada } from "@/lib/regras/atendimentos";
import {
  esquemaAutorizacao,
  esquemaPaciente,
  esquemaUsuarioNovo,
} from "@/lib/validacao";

const UUID = "3f1c2b8e-4a5d-4c6e-9f70-1a2b3c4d5e6f";

describe("esquemaPaciente", () => {
  it("aceita campos opcionais vazios vindos do formulário", () => {
    const r = esquemaPaciente.parse({ nome: "Ana Maria", dataNascimento: "2019-02-28", cpf: "", email: "  " });
    expect(r.cpf).toBeNull();
    expect(r.email).toBeNull();
    expect(r.dataNascimento.toISOString()).toBe("2019-02-28T00:00:00.000Z");
  });
  it("recusa data impossível e CPF fora do formato", () => {
    expect(esquemaPaciente.safeParse({ nome: "Ana", dataNascimento: "2019-02-30" }).success).toBe(false);
    expect(esquemaPaciente.safeParse({ nome: "Ana", dataNascimento: "2019-01-01", cpf: "12345678900" }).success).toBe(false);
  });
});

describe("esquemaAutorizacao", () => {
  const valida = { pacienteId: UUID, convenioId: UUID, procedimento: "ABA", quantidadeSolicitada: "10" };
  it("converte quantidade em texto", () => {
    expect(esquemaAutorizacao.parse(valida).quantidadeSolicitada).toBe(10);
  });
  it("ignora campos que não pertencem ao formulário (ex.: status)", () => {
    expect(esquemaAutorizacao.parse({ ...valida, status: "autorizada" })).not.toHaveProperty("status");
  });
  it("recusa vigência invertida e quantidade inválida", () => {
    expect(esquemaAutorizacao.safeParse({ ...valida, dataInicioVigencia: "2026-10-10", dataFimVigencia: "2026-10-01" }).success).toBe(false);
    expect(esquemaAutorizacao.safeParse({ ...valida, quantidadeSolicitada: "0" }).success).toBe(false);
    expect(esquemaAutorizacao.safeParse({ ...valida, quantidadeSolicitada: "1.5" }).success).toBe(false);
  });
});

describe("esquemaUsuarioNovo", () => {
  it("normaliza o e-mail e exige senha de 8+ caracteres", () => {
    const r = esquemaUsuarioNovo.parse({ nome: "Ana", email: " Ana@Clinica.COM ", senha: "12345678" });
    expect(r.email).toBe("ana@clinica.com");
    expect(esquemaUsuarioNovo.safeParse({ nome: "Ana", email: "a@b.com", senha: "1234567" }).success).toBe(false);
  });
});

describe("atendimentos gerados da agenda", () => {
  it("sessão de 1 hora", () => {
    expect(fimDaSessao("15:30")).toBe("16:30");
    expect(fimDaSessao("23:30")).toBe("00:30");
  });
  it("sessão realizada (desconto automático): só de dias anteriores e não desmarcada", () => {
    const hoje = new Date("2026-11-05T00:00:00Z");
    const ontem = new Date("2026-11-04T00:00:00Z");
    const ativa = { statusAnclinic: "Atendido", removidoEm: null };
    expect(sessaoRealizada(ontem, hoje, ativa)).toBe(true);
    // As de hoje ainda podem ser desmarcadas: esperam o dia seguinte.
    expect(sessaoRealizada(hoje, hoje, ativa)).toBe(false);
    expect(sessaoRealizada(new Date("2026-11-06T00:00:00Z"), hoje, ativa)).toBe(false);
    // Desmarcada ou excluída no AnClinic não conta.
    expect(sessaoRealizada(ontem, hoje, { statusAnclinic: "Desmarcado", removidoEm: null })).toBe(false);
    expect(sessaoRealizada(ontem, hoje, { statusAnclinic: null, removidoEm: hoje })).toBe(false);
    // Atendimento lançado à mão (sem sessão da agenda) conta pela data.
    expect(sessaoRealizada(ontem, hoje, null)).toBe(true);
  });
});

describe("validade do pedido médico", () => {
  it("em branco, vale 1 ano a partir da data do pedido", async () => {
    const { esquemaPedidoMedico } = await import("@/lib/validacao");
    const base = { medicoNome: "Dra. X", numeroConselho: "123", ufConselho: "SP", dataPedido: "2025-12-11" };
    expect(esquemaPedidoMedico.parse(base).validoAte?.toISOString().slice(0, 10)).toBe("2026-12-10");
    expect(esquemaPedidoMedico.parse({ ...base, validoAte: "2026-03-01" }).validoAte?.toISOString().slice(0, 10)).toBe("2026-03-01");
  });
});
