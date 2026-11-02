import { describe, expect, it } from "vitest";
import { codigoUf } from "@/lib/tiss/dominios";
import { montarSolicitacaoSpSadt, type DadosSolicitacaoSpSadt } from "@/lib/tiss/solicitacao";
import { validarMensagemTiss } from "@/lib/tiss/validarXsd";
import { el, hashTiss, textoTiss } from "@/lib/tiss/xml";

const dados = (p: Partial<DadosSolicitacaoSpSadt> = {}): DadosSolicitacaoSpSadt => ({
  numeroGuiaPrestador: "17",
  sequencialTransacao: "17",
  agora: new Date("2026-10-15T13:05:09Z"), // 10:05:09 em São Paulo
  registroAns: "326305",
  prestador: { codigoNaOperadora: "12493066", nome: "Fisiomed ABA Ltda" },
  carteirinha: "074.929.371",
  solicitante: { nome: "Dra. Ana Lúcia Souza", conselho: "CRM", numeroConselho: "123456", uf: "SP", cbo: "225124" },
  dataSolicitacao: "2026-09-01",
  indicacaoClinica: "Transtorno do espectro autista (CID F84.0) — terapia ABA",
  procedimentos: [{ tabela: "22", codigo: "50000470", descricao: "Sessão de psicoterapia individual", quantidade: 4 }],
  cnes: "4160088",
  ...p,
});

describe("montarSolicitacaoSpSadt", () => {
  it("gera a mensagem válida pelo schema oficial da ANS (TISS 4.03.00)", async () => {
    const r = montarSolicitacaoSpSadt(dados());
    if (!r.ok) throw new Error(r.erros.join("; "));
    expect(await validarMensagemTiss(r.xmlUtf8)).toEqual([]);
  });

  it("preenche os campos no formato TISS", () => {
    const r = montarSolicitacaoSpSadt(dados());
    if (!r.ok) throw new Error(r.erros.join("; "));
    expect(r.xml.startsWith('<?xml version="1.0" encoding="ISO-8859-1"?>')).toBe(true);
    expect(r.xml).toContain("<ans:tipoTransacao>SOLICITACAO_PROCEDIMENTOS</ans:tipoTransacao>");
    expect(r.xml).toContain("<ans:dataRegistroTransacao>2026-10-15</ans:dataRegistroTransacao>");
    expect(r.xml).toContain("<ans:horaRegistroTransacao>10:05:09</ans:horaRegistroTransacao>");
    expect(r.xml).toContain("<ans:numeroCarteira>074929371</ans:numeroCarteira>");
    expect(r.xml).toContain("<ans:conselhoProfissional>06</ans:conselhoProfissional>");
    expect(r.xml).toContain("<ans:UF>35</ans:UF>");
    expect(r.xml).toContain("<ans:quantidadeSolicitada>4</ans:quantidadeSolicitada>");
    expect(r.xml).toContain(`<ans:hash>${r.hash}</ans:hash>`);
    // "—" não existe em ISO-8859-1: vira hífen.
    expect(r.xml).toContain("(CID F84.0) - terapia ABA");
  });

  it("o hash muda quando qualquer campo muda", () => {
    const a = montarSolicitacaoSpSadt(dados());
    const b = montarSolicitacaoSpSadt(dados({ carteirinha: "074929372" }));
    expect(a.ok && b.ok && a.hash !== b.hash).toBe(true);
  });

  it("lista o que falta em vez de gerar uma guia inválida", () => {
    const r = montarSolicitacaoSpSadt(
      dados({
        registroAns: null,
        carteirinha: "",
        cnes: null,
        indicacaoClinica: null,
        solicitante: { nome: "Dr. X", conselho: "CRM", numeroConselho: "1", uf: "XX", cbo: null },
        procedimentos: [{ tabela: "22", codigo: null, descricao: "ABA", quantidade: 1 }],
      }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.erros).toEqual([
      "Convênio sem registro ANS (6 dígitos)",
      "Sem carteirinha",
      "Unidade sem CNES",
      "UF do conselho do médico inválida (XX)",
      "Pedido médico sem CBO do médico",
      "Pedido médico sem indicação clínica nem CID",
      "Procedimento sem código TUSS (ABA)",
    ]);
  });

  it("o validador acusa campo fora do padrão", async () => {
    const r = montarSolicitacaoSpSadt(dados());
    if (!r.ok) throw new Error();
    const erros = await validarMensagemTiss(r.xmlUtf8.replace("<ans:UF>35</ans:UF>", "<ans:UF>SP</ans:UF>"));
    expect(erros.length).toBeGreaterThan(0);
  });
});

describe("auxiliares TISS", () => {
  it("hash é o MD5 do conteúdo dos campos em ISO-8859-1", () => {
    // MD5 de "ação" com "ç" e "ã" em 1 byte cada; as tags não entram.
    expect(hashTiss([el("a", [el("b", "aç"), el("c", "ão")])!])).toBe("ae4a7803202641a834921dad2d15bb2c");
  });

  it("UF pelo código do IBGE", () => {
    expect(codigoUf("sp")).toBe("35");
    expect(codigoUf("DF")).toBe("53");
    expect(codigoUf("XX")).toBeNull();
  });

  it("texto livre: espaços, caracteres fora do ISO-8859-1 e tamanho", () => {
    expect(textoTiss("  Fisio   ABA  ", 70)).toBe("Fisio ABA");
    expect(textoTiss("“aspas” – 😀 ok", 70)).toBe('"aspas" - ok');
    expect(textoTiss("abcdef", 3)).toBe("abc");
    expect(textoTiss("   ", 3)).toBeNull();
  });
});
