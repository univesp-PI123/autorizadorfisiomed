import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { especialidadeDe, interpretarPlano, type ItemTexto } from "@/lib/documentos/plano";
import { chaveCarteirinha, numerosDoNome, tipoPeloNome } from "@/lib/documentos/vinculo";

// Texto (com posição) de um plano terapêutico real da Amil, com nomes, CPF e
// telefones trocados por dados fictícios.
const itens: ItemTexto[] = JSON.parse(readFileSync(new URL("./fixtures/plano-terapeutico-itens.json", import.meta.url), "utf8"));

describe("interpretarPlano", () => {
  const plano = interpretarPlano(itens)!;

  it("reconhece o formulário e lê o beneficiário", () => {
    expect(plano.paciente).toEqual({ nome: "Paciente Ficticio da Silva", nascimento: "2021-03-10" });
    expect(plano.cid).toBe("F84.0");
    expect(plano.responsavel.cpf).toBe("11144477735");
  });

  it("lê médico prescritor, CRM e data da solicitação", () => {
    expect(plano.medico).toEqual({ nome: "Dra. Medica Ficticia", crm: "123456" });
    expect(plano.dataSolicitacao).toBe("2025-12-11");
  });

  it("monta a grade por especialidade e dia da semana", () => {
    expect(plano.itens).toEqual([
      { especialidade: "PSICOLOGIA", dias: { seg: 1, ter: 1, qui: 1, sex: 1 }, total: 4 },
      { especialidade: "FONOAUDIOLOGIA", dias: { ter: 1, qui: 1, sex: 1 }, total: 3 },
      { especialidade: "TERAPIA OCUPACIONAL", dias: { ter: 1, qui: 1 }, total: 2 },
      { especialidade: "MUSICOTERAPIA", dias: { seg: 1 }, total: 1 },
    ]);
    expect(plano.sessoesSemanais).toBe(10);
    expect(plano.itens.reduce((s, i) => s + i.total, 0)).toBe(plano.sessoesSemanais);
  });

  it("lê os métodos marcados", () => {
    expect(plano.metodos).toEqual(["ABA", "Integração sensorial", "Orientação aos pais"]);
  });

  it("devolve null para outro documento", () => {
    expect(interpretarPlano([{ pagina: 1, x: 10, y: 10, texto: "Receituário" }])).toBeNull();
  });
});

describe("especialidadeDe", () => {
  it("não confunde psicopedagogia com psicologia", () => {
    expect(especialidadeDe("4450 - PSICOPEDAGOGIA ABA")).toBe("PSICOPEDAGOGIA");
    expect(especialidadeDe("PSICOLOGIA ABA")).toBe("PSICOLOGIA");
    expect(especialidadeDe("TERAPIA OCUPACIONAL ABA")).toBe("TERAPIA OCUPACIONAL");
    expect(especialidadeDe("ACOMPANHANTE TERAPÊUTICO")).toBeNull();
  });
});

describe("vínculo pelo nome do arquivo", () => {
  it("acha CPF formatado ou não, e carteirinha", () => {
    expect(numerosDoNome("111.444.777-35_pedido.pdf")).toEqual({ cpfs: ["11144477735"], carteirinhas: [] });
    expect(numerosDoNome("PEDIDO 11144477735.pdf").cpfs).toEqual(["11144477735"]);
    expect(numerosDoNome("530683703_290920261146564656_PLANO_TERAPEUTICO.pdf")).toEqual({
      cpfs: [],
      carteirinhas: ["530683703", "290920261146564656"],
    });
  });
  it("CPF com dígito errado não conta como CPF", () => {
    expect(numerosDoNome("11144477736.pdf").cpfs).toEqual([]);
  });
  it("carteirinha ignora zeros à esquerda", () => {
    expect(chaveCarteirinha("074929371")).toBe(chaveCarteirinha("74929371"));
  });
  it("tipo pelo nome", () => {
    expect(tipoPeloNome("x_PLANO_TERAPEUTICO.pdf")).toBe("plano_terapeutico");
    expect(tipoPeloNome("pedido médico.pdf")).toBe("pedido_medico");
    expect(tipoPeloNome("Relatório.pdf")).toBe("relatorio");
    expect(tipoPeloNome("scan001.pdf")).toBeNull();
  });
});

describe("nomesParecidos", () => {
  it("aceita nome abreviado com o mesmo início", async () => {
    const { nomesParecidos } = await import("@/lib/documentos/salvar");
    expect(nomesParecidos("ANA CLARA SOUZA", "Ana Clara de Souza Lima")).toBe(true);
    expect(nomesParecidos("ANA CLARA", "Ana Clara Souza")).toBe(true);
    expect(nomesParecidos("ANA SOUZA", "Bruna Souza Lima")).toBe(false);
    expect(nomesParecidos("ANA LIMA", "Ana Clara Souza")).toBe(false);
  });
});

describe("pasta do paciente", async () => {
  const { acharPaciente, pastaDoPaciente } = await import("@/lib/documentos/salvar");
  const pac = (id: string, nome: string) => ({ id, nome, cpf: null, dataNascimento: null });
  const lista = [pac("p1", "MARIA DA SILVA SANTOS"), pac("p2", "JOÃO PEDRO LIMA"), pac("p3", "Ana Clara Souza"), pac("p4", "Ana Beatriz Souza")];
  const idx = {
    porId: new Map(lista.map((p) => [p.id, p])),
    porCpf: new Map(),
    porCarteira: new Map<string, Set<string>>(),
    porNome: new Map(lista.map((p) => [p.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase(), [p]])),
    porNascimento: new Map(),
  };

  it("escolhida a pasta de todos: a pasta do meio é o paciente; subpastas ficam de fora", () => {
    expect(pastaDoPaciente("PACIENTES/MARIA DA SILVA SANTOS/pedido.pdf", idx)).toEqual({ pasta: "MARIA DA SILVA SANTOS" });
    expect(pastaDoPaciente("PACIENTES/MARIA DA SILVA SANTOS/DOCUMENTOS/antigo.pdf", idx)).toHaveProperty("ignorar");
    expect(pastaDoPaciente("pedido.pdf", idx)).toEqual({ pasta: null });
  });

  it("escolhida a pasta de um paciente: os PDFs dela valem e a subpasta fica de fora", () => {
    expect(pastaDoPaciente("João Pedro Lima/plano.pdf", idx)).toEqual({ pasta: "João Pedro Lima" });
    expect(pastaDoPaciente("João Pedro Lima/Documentos/plano-2025.pdf", idx)).toHaveProperty("ignorar");
  });

  it("acha o paciente pelo nome da pasta, igual ou parecido, sem ambiguidade", () => {
    expect(acharPaciente("pedido.pdf", null, idx, "Maria da Silva Santos")).toMatchObject({ paciente: { id: "p1" }, por: "pasta" });
    expect(acharPaciente("pedido.pdf", null, idx, "MARIA SILVA SANTOS")).toMatchObject({ paciente: { id: "p1" }, por: "pasta" });
    expect(acharPaciente("pedido.pdf", null, idx, "ANA SOUZA").paciente).toBeUndefined();
    expect(acharPaciente("pedido.pdf", null, idx, "CARLOS NUNES").motivo).toContain("CARLOS NUNES");
  });
});
