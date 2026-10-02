import { describe, expect, it } from "vitest";
import {
  cabeNoPedido,
  datasDaJanela,
  diaDaSolicitacao,
  ehAtendimentoEscolar,
  fimDaSemana,
  unidadePelaSala,
} from "@/lib/regras/solicitacao";

// Semana de 05/10/2026 (segunda) a 11/10/2026 (domingo).
const SEG = "2026-10-05";
const TER = "2026-10-06";
const QUA = "2026-10-07";
const QUI = "2026-10-08";
const SEX = "2026-10-09";
const SAB = "2026-10-10";
const DOM = "2026-10-11";

describe("dia da solicitação", () => {
  it("é a véspera; a sessão de segunda é pedida na própria segunda", () => {
    expect(diaDaSolicitacao(SEG)).toBe(SEG);
    expect(diaDaSolicitacao(TER)).toBe(SEG);
    expect(diaDaSolicitacao(QUA)).toBe(TER);
    expect(diaDaSolicitacao(SEX)).toBe(QUI);
  });

  it("na segunda entram as sessões de segunda e terça; na sexta, nenhuma da semana seguinte", () => {
    expect(datasDaJanela(SEG)).toEqual([SEG, TER]);
    expect(datasDaJanela(TER)).toEqual([TER, QUA]);
    expect(datasDaJanela(QUI)).toEqual([QUI, SEX]);
    expect(datasDaJanela(SEX)).toEqual([SEX, SAB]);
    expect(datasDaJanela(DOM)).toEqual([DOM]);
    expect(datasDaJanela(DOM)).not.toContain("2026-10-12");
  });

  it("a senha vale até a sexta da semana", () => {
    expect(fimDaSemana(SEG)).toBe(SEX);
    expect(fimDaSemana(QUI)).toBe(SEX);
    expect(fimDaSemana(SEX)).toBe(SEX);
    expect(fimDaSemana(SAB)).toBe(SAB);
  });
});

describe("sessão remarcada continua no pedido?", () => {
  it("na mesma semana, sim; na seguinte ou antes do pedido, não", () => {
    expect(cabeNoPedido(TER, SEG)).toBe(true); // pedido de segunda cobre a terça
    expect(cabeNoPedido(QUI, SEG)).toBe(true); // remarcada para quinta
    expect(cabeNoPedido("2026-10-12", SEG)).toBe(false); // segunda seguinte
    expect(cabeNoPedido("2026-10-02", SEG)).toBe(false); // sexta anterior
    expect(cabeNoPedido(DOM, SAB)).toBe(true); // domingo, pedido no sábado
  });
});

describe("atendimento escolar", () => {
  it("pela sala do AnClinic", () => {
    expect(ehAtendimentoEscolar("SÃO MIGUEL - ATENDIMENTO ESCOLAR")).toBe(true);
    expect(ehAtendimentoEscolar("ITINGUÇU - ATENDIMENTO DOMICILIAR")).toBe(false);
    expect(ehAtendimentoEscolar("SÃO MIGUEL - SALA 31")).toBe(false);
    expect(ehAtendimentoEscolar(null)).toBe(false);
  });
});

describe("unidade pela sala", () => {
  const unidades = [
    { id: "sm", nome: "FISIOMED ABA SAO MIGUEL", nomeAnclinic: "FISIOMED ABA SAO MIGUEL" },
    { id: "it", nome: "Itinguçu", nomeAnclinic: "FISIOMED ABA ITINGUÇU" },
    { id: "ca", nome: "Unidade Cangaíba", nomeAnclinic: "FISIOMED ABA CANGAIBA" },
  ];
  it("casa o começo da sala com o nome da unidade, sem acento", () => {
    expect(unidadePelaSala("SÃO MIGUEL - SALA 31", unidades)).toBe("sm");
    expect(unidadePelaSala("ITINGUÇU - ATENDIMENTO DOMICILIAR", unidades)).toBe("it");
    expect(unidadePelaSala("CANGAÍBA - ATENDIMENTO ESCOLAR", unidades)).toBe("ca");
  });
  it("sem prefixo, sem unidade parecida ou com mais de uma, não escolhe", () => {
    expect(unidadePelaSala("SALA 31", unidades)).toBeNull();
    expect(unidadePelaSala("JOINVILLE - SALA 2", unidades)).toBeNull();
    expect(unidadePelaSala(null, unidades)).toBeNull();
    const duas = [...unidades, { id: "sm2", nome: "São Miguel 2", nomeAnclinic: "FISIOMED ABA SAO MIGUEL 2" }];
    expect(unidadePelaSala("SÃO MIGUEL - SALA 31", duas)).toBe("sm");
    expect(unidadePelaSala("MIGUEL - SALA 31", duas)).toBeNull();
  });
});
