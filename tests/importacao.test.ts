import { describe, expect, it } from "vitest";
import { interpretarAgenda, separarProcedimento } from "@/lib/importacao/agenda";
import { chaveNome, cpf, dataBR, hora, type Linha } from "@/lib/importacao/planilha";
import { interpretarProfissionais } from "@/lib/importacao/profissionais";
import { cboSugerido } from "@/lib/tiss/dominios";

// Dados fictícios no formato exportado pelo AnClinic.
const CABECALHO = [
  "ID Agendamento", "Data", "Hora Início", "Hora Fim", "Paciente", "CPF Paciente", "CNS Paciente",
  "Profissional", "CPF Profissional", "CNS Profissional", "Convênio", "Cartão", "Procedimento", "Agenda",
  "Status", "Valor Faturamento", "Valor Repasse", "Status de Faturamento", "Evolução", "Dt. Nasc. Paciente",
  "Telefone Celular", "Telefone Residencial", "Observação", "Agendamentos Restantes", "Senha Autorização",
  "Senha Execução", "Qtd. Notificações", "Unidade de Atendimento", "Sala",
];

function linhaAgenda(p: Partial<Record<string, string | number | null>>): Linha {
  const base: Record<string, string | number | null> = {
    "ID Agendamento": 1001, Data: "28/09/2026", "Hora Início": "07:00", "Hora Fim": "08:00",
    Paciente: "PACIENTE TESTE", "CPF Paciente": "52998224725", Profissional: "TERAPEUTA TESTE",
    "CPF Profissional": "11144477735", Convênio: "Amil Assitencia Medica Internacional S.a.", Cartão: "074929371",
    Procedimento: "4440 - PSICOLOGIA ABA", Status: "Marcado Nao Confirmado", "Valor Faturamento": "R$131,00",
    "Status de Faturamento": "Autorização", "Dt. Nasc. Paciente": "26/01/2019", "Agendamentos Restantes": 32,
    "Unidade de Atendimento": "FISIOMED ABA SAO MIGUEL",
  };
  const v = { ...base, ...p };
  return CABECALHO.map((c) => v[c] ?? null);
}

describe("conversões da planilha", () => {
  it("converte data e hora", () => {
    expect(dataBR("28/09/2026")).toBe("2026-09-28");
    expect(dataBR("31/02/2026")).toBeNull();
    expect(hora("7:05")).toBe("07:05");
  });
  it("recupera zeros à esquerda do CPF e valida os dígitos", () => {
    expect(cpf(1144477735)).toBeNull(); // 01144477735 não é válido
    expect(cpf("111.444.777-35")).toBe("11144477735");
    expect(cpf("11144477736")).toBeNull();
    expect(cpf(" ")).toBeNull();
  });
  it("compara nomes sem acento, caixa e espaços", () => {
    expect(chaveNome(" Itinguçu  ABA")).toBe(chaveNome("ITINGUCU ABA"));
  });
  it("separa código e descrição do procedimento", () => {
    expect(separarProcedimento("4440 - PSICOLOGIA ABA")).toEqual({ codigo: "4440", descricao: "PSICOLOGIA ABA" });
    expect(separarProcedimento("9910 - PACOTE - SÃO CRISTÓVÃO - SUPERVISÃO")?.descricao).toBe("PACOTE - SÃO CRISTÓVÃO - SUPERVISÃO");
  });
});

describe("interpretarAgenda", () => {
  it("acha o cabeçalho depois da linha de período e lê as sessões", () => {
    const titulo: Linha = ["Período - 28/09/2026 a 29/09/2026", ...Array(28).fill(null)];
    const r = interpretarAgenda([titulo, CABECALHO, linhaAgenda({}), linhaAgenda({ "ID Agendamento": 1002, Data: "29/09/2026" })]);
    expect(r.periodo).toEqual({ inicio: "2026-09-28", fim: "2026-09-29" });
    expect(r.sessoes).toHaveLength(2);
    const s = r.sessoes[0];
    expect(s.linha).toBe(3);
    expect(s.paciente).toEqual({ nome: "PACIENTE TESTE", cpf: "52998224725", nascimento: "2019-01-26", telefone: null });
    expect(s.procedimento?.codigo).toBe("4440");
    expect(s.agendamentosRestantes).toBe(32);
  });

  it("sem linha de título, o período vem das datas das sessões", () => {
    const r = interpretarAgenda([CABECALHO, linhaAgenda({ Data: "30/09/2026" }), linhaAgenda({ "ID Agendamento": 7, Data: "28/09/2026" })]);
    expect(r.periodo).toEqual({ inicio: "2026-09-28", fim: "2026-09-30" });
  });

  it("ignora IDs repetidos e linhas sem data, e avisa CPF inválido", () => {
    const r = interpretarAgenda([
      CABECALHO,
      linhaAgenda({ "CPF Paciente": "12345678900" }),
      linhaAgenda({}),
      linhaAgenda({ "ID Agendamento": 2, Data: "" }),
    ]);
    expect(r.sessoes).toHaveLength(1);
    expect(r.sessoes[0].paciente?.cpf).toBeNull();
    expect(r.ignoradas).toBe(2);
    expect(r.avisos.map((a) => a.mensagem)).toEqual(
      expect.arrayContaining([expect.stringMatching(/CPF do paciente inválido/), expect.stringMatching(/repetido/)]),
    );
  });

  it("recusa planilha sem as colunas obrigatórias", () => {
    expect(() => interpretarAgenda([["Nome", "CPF"], ["x", "y"]])).toThrow(/Colunas obrigatórias/);
  });
});

describe("interpretarProfissionais", () => {
  const cab = ["Nome", "CPF", "Conselho", "Numero no conselho", "UF", "Especialidades cadastradas"];
  it("normaliza CPF, conselho e sugere CBO", () => {
    const r = interpretarProfissionais([cab, ["ANA TESTE", 11144477735, "CRP", 123456, "SP", "Psicologia "]]);
    expect(r.profissionais[0]).toMatchObject({
      cpf: "11144477735", conselho: "CRP", numeroConselho: "123456", ufConselho: "SP", especialidades: "Psicologia", cbo: "251510",
    });
  });
  it("em CPF repetido, fica a linha com dados de conselho", () => {
    const r = interpretarProfissionais([
      cab,
      ["ANA TESTE", 11144477735, null, null, null, "Psicologia"],
      ["ANA TESTE", 11144477735, "CRP", 1, "SP", "Psicologia"],
    ]);
    expect(r.profissionais).toHaveLength(1);
    expect(r.profissionais[0].conselho).toBe("CRP");
    expect(r.ignoradas).toBe(1);
  });
  it("sugere o CBO pela especialidade", () => {
    expect(cboSugerido("Fonoaudiologia")).toBe("223810");
    expect(cboSugerido("Terapia Ocupacional")).toBe("223905");
    expect(cboSugerido("Fisioterapia")).toBe("223605");
    expect(cboSugerido("Psicopedagogia")).toBe("239425");
    expect(cboSugerido("Nutrição")).toBeNull();
  });
});
