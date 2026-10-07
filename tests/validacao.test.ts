import { describe, expect, it } from "vitest";
import { fimDaSessao } from "@/lib/regras/atendimentos";
import {
  esquemaAtendimento,
  esquemaAtendimentoEdicao,
  esquemaSituacaoAtendimento,
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

describe("esquemaAtendimento", () => {
  it("aceita sem autorização e valida hora", () => {
    const r = esquemaAtendimento.parse({ pacienteId: UUID, procedimento: "ABA", dataAtendimento: "2026-09-27", autorizacaoId: "", horaInicio: "08:30", });
expect(r.autorizacaoId).toBeNull();
expect(esquemaAtendimento.safeParse({ pacienteId: UUID, procedimento: "ABA", dataAtendimento: "2026-09-27", horaInicio: "25:00" }).success).toBe(false);
// Só hora cheia ou meia hora.
  });
});

describe("esquemaUsuarioNovo", () => {
  it("normaliza o e-mail e exige senha de 8+ caracteres", () => {
    const r = esquemaUsuarioNovo.parse({ nome: "Ana", email: " Ana@Clinica.COM ", senha: "12345678", perfil: "terapeuta" });
    expect(r.email).toBe("ana@clinica.com");
    expect(esquemaUsuarioNovo.safeParse({ nome: "Ana", email: "a@b.com", senha: "1234567", perfil: "terapeuta" }).success).toBe(false);
    expect(esquemaUsuarioNovo.safeParse({ nome: "Ana", email: "a@b.com", senha: "12345678", perfil: "root" }).success).toBe(false);
  });
});

describe("confirmação e glosa", () => {
  it("cancelar exige motivo", () => {
    expect(esquemaSituacaoAtendimento.safeParse({ acao: "cancelar", motivo: " " }).success).toBe(false);
    expect(esquemaSituacaoAtendimento.safeParse({ acao: "cancelar", motivo: "Paciente faltou" }).success).toBe(true);
    expect(esquemaSituacaoAtendimento.safeParse({ acao: "confirmar" }).success).toBe(true);
  });
  it("glosado exige motivo", () => {
    expect(esquemaAtendimentoEdicao.safeParse({ statusCobranca: "glosado", motivoGlosa: "" }).success).toBe(false);
    expect(esquemaAtendimentoEdicao.safeParse({ statusCobranca: "glosado", motivoGlosa: "Autorização vencida" }).success).toBe(true);
  });
  it("sessão de 1 hora", () => {
    expect(fimDaSessao("15:30")).toBe("16:30");
    expect(fimDaSessao("23:30")).toBe("00:30");
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
