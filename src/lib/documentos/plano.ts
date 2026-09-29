// Leitura do "Formulário para solicitação de sessões de terapias para
// transtornos globais do desenvolvimento" (plano terapêutico da Amil), quando
// o PDF tem texto (exportado do Word). PDF escaneado não tem texto: nesse caso
// o documento é guardado sem os dados.
//
// interpretarPlano é pura (recebe o texto com a posição na página) para ser
// testada; lerPlano extrai o texto do PDF.

import { chaveNome, dataBR, soDigitos } from "@/lib/importacao/planilha";
import { especialidadeDe } from "./especialidades";

export { ESPECIALIDADES, especialidadeDe } from "./especialidades";

export type ItemTexto = { pagina: number; x: number; y: number; texto: string };

export const DIAS = ["seg", "ter", "qua", "qui", "sex", "sab"] as const;
export type Dia = (typeof DIAS)[number];

export type ItemPlano = { especialidade: string; dias: Partial<Record<Dia, number>>; total: number };

export type PlanoTerapeutico = {
  paciente: { nome: string | null; nascimento: string | null };
  cid: string | null;
  responsavel: { nome: string | null; cpf: string | null };
  medico: { nome: string | null; crm: string | null };
  dataSolicitacao: string | null;
  sessoesSemanais: number | null; // o total informado no formulário
  itens: ItemPlano[];
  metodos: string[];
};

const MARCADOR = /PLANO TERAP[EÊ]UTICO POR DIA DA SEMANA/i;

function linhas(itens: ItemTexto[]) {
  // Junta os pedaços da mesma linha (mesma página e altura, com tolerância).
  const grupos: { pagina: number; y: number; itens: ItemTexto[] }[] = [];
  for (const it of [...itens].sort((a, b) => a.pagina - b.pagina || b.y - a.y || a.x - b.x)) {
    const g = grupos.find((l) => l.pagina === it.pagina && Math.abs(l.y - it.y) <= 3);
    if (g) g.itens.push(it);
    else grupos.push({ pagina: it.pagina, y: it.y, itens: [it] });
  }
  return grupos.map((g) => ({ ...g, texto: g.itens.sort((a, b) => a.x - b.x).map((i) => i.texto).join(" ") }));
}

const depois = (texto: string, rotulo: RegExp) => {
  const m = texto.match(rotulo);
  return m ? texto.slice((m.index ?? 0) + m[0].length).trim() : null;
};

export function ehPlanoTerapeutico(itens: ItemTexto[]): boolean {
  return itens.some((i) => MARCADOR.test(i.texto)) || MARCADOR.test(itens.map((i) => i.texto).join(" "));
}

export function interpretarPlano(itens: ItemTexto[]): PlanoTerapeutico | null {
  if (!ehPlanoTerapeutico(itens)) return null;
  const ls = linhas(itens);
  const todo = ls.map((l) => l.texto).join("\n");
  const linhaCom = (re: RegExp) => ls.find((l) => re.test(l.texto));

  // Beneficiário: o primeiro "NOME COMPLETO" é o do paciente; o segundo, do responsável.
  const nomes = ls.filter((l) => /NOME COMPLETO:/i.test(l.texto));
  const limpaNome = (v: string | null) => v?.replace(/\s+/g, " ").trim() || null;
  const nomePaciente = limpaNome(depois(nomes[0]?.texto ?? "", /NOME COMPLETO:/i));
  const nomeResponsavel = limpaNome(depois(nomes[1]?.texto ?? "", /NOME COMPLETO:/i));
  const nascimento = dataBR(todo.match(/DATA DE NASCIMENTO:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null);
  const cid = todo.match(/\b([F-G]\d{2}(?:\.\d)?)\b/)?.[1] ?? null;
  const cpfResp = soDigitos(todo.match(/CPF:\s*([\d.\-]+)/i)?.[1] ?? null);

  // Médico prescritor: a linha "NOME:" logo abaixo de "DADOS MÉDICO(A) PRESCRITOR(A)".
  const iMedico = ls.findIndex((l) => /PRESCRITOR/i.test(l.texto));
  const lMedico = iMedico >= 0 ? ls.slice(iMedico + 1).find((l) => /NOME:/i.test(l.texto)) : undefined;
  const medicoNome = lMedico ? limpaNome(depois(lMedico.texto, /NOME:/i)?.replace(/CRM:.*$/i, "") ?? null) : null;
  const crm = soDigitos(lMedico?.texto.match(/CRM:\s*([\d.\-]+)/i)?.[1] ?? null);

  const dataSolicitacao = dataBR(todo.match(/DATA DA SOLICITA[CÇ][AÃ]O:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1] ?? null);
  const totalInformado = Number(todo.match(/TOTAL DE SESS[OÕ]ES SEMANAIS:\s*(\d+)/i)?.[1]);

  // Grade: colunas pelos títulos dos dias; linhas pelas especialidades.
  const cabecalho = linhaCom(/SEGUNDA/i);
  const colunas: { dia: Dia; x: number }[] = [];
  if (cabecalho) {
    const rotulos: [RegExp, Dia][] = [[/SEGUNDA/i, "seg"], [/TER[CÇ]A/i, "ter"], [/QUARTA/i, "qua"], [/QUINTA/i, "qui"], [/SEXTA/i, "sex"], [/S[AÁ]BADO/i, "sab"]];
    for (const [re, dia] of rotulos) {
      const it = cabecalho.itens.find((i) => re.test(i.texto));
      if (it) colunas.push({ dia, x: it.x });
    }
  }
  const porEspecialidade = new Map<string, ItemPlano>();
  if (cabecalho && colunas.length) {
    const abaixo = ls.filter((l) => l.pagina === cabecalho.pagina && l.y < cabecalho.y);
    for (const l of abaixo) {
      if (/TOTAL\s*\/\s*DIA/i.test(l.texto) || /Detalhar complexidade/i.test(l.texto)) break;
      const rotulo = l.itens.filter((i) => !/^\d+$/.test(i.texto.trim())).map((i) => i.texto).join(" ");
      let esp = especialidadeDe(rotulo);
      if (/OUTRAS/i.test(rotulo)) {
        // "OUTRAS (ESPECIFICAR…) E Nº SESSÕES): Musicoterapia" — o nome vem na linha seguinte.
        const prox = abaixo[abaixo.indexOf(l) + 1];
        const nome = depois(`${rotulo} ${prox?.texto ?? ""}`, /SESS[OÕ]ES\):/i);
        esp = (nome && (especialidadeDe(nome) ?? chaveNome(nome.replace(/\d+/g, "")).trim())) || "OUTRAS";
      }
      if (!esp) continue;
      const numeros = l.itens.filter((i) => /^\d+$/.test(i.texto.trim()) && i.x > Math.min(...colunas.map((c) => c.x)) - 30);
      if (!numeros.length) continue;
      const item = porEspecialidade.get(esp) ?? { especialidade: esp, dias: {}, total: 0 };
      for (const n of numeros) {
        const col = colunas.reduce((a, b) => (Math.abs(b.x + 15 - n.x) < Math.abs(a.x + 15 - n.x) ? b : a));
        const q = Number(n.texto);
        item.dias[col.dia] = (item.dias[col.dia] ?? 0) + q;
        item.total += q;
      }
      porEspecialidade.set(esp, item);
    }
  }

  const metodos: string[] = [];
  for (const [re, nome] of [
    [/TERAPIA ABA:\s*X/i, "ABA"],
    [/FLOORTIME:\s*X/i, "Floortime"],
    [/DENVER:\s*X/i, "Denver"],
    [/INTEGRA[CÇ][AÃ]O SENSORIAL:\s*X/i, "Integração sensorial"],
    [/TEACCH:\s*X/i, "TEACCH"],
    [/CUIDADORES:\s*X/i, "Orientação aos pais"],
  ] as [RegExp, string][]) {
    if (re.test(todo)) metodos.push(nome);
  }

  return {
    paciente: { nome: nomePaciente, nascimento },
    cid,
    responsavel: { nome: nomeResponsavel, cpf: cpfResp && cpfResp.length === 11 ? cpfResp : null },
    medico: { nome: medicoNome, crm },
    dataSolicitacao,
    sessoesSemanais: Number.isFinite(totalInformado) ? totalInformado : null,
    itens: [...porEspecialidade.values()],
    metodos,
  };
}

/** Extrai o texto (com posição) de um PDF. PDF sem texto devolve lista vazia. */
export async function textoDoPdf(conteudo: Buffer): Promise<ItemTexto[]> {
  const { getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(conteudo));
  const itens: ItemTexto[] = [];
  for (let n = 1; n <= Math.min(pdf.numPages, 5); n++) {
    const pagina = await pdf.getPage(n);
    const { items } = await pagina.getTextContent();
    for (const i of items) {
      if (!("str" in i) || !i.str.trim()) continue;
      itens.push({ pagina: n, x: i.transform[4], y: i.transform[5], texto: i.str });
    }
  }
  await pdf.cleanup?.();
  return itens;
}

export async function lerPlano(conteudo: Buffer): Promise<PlanoTerapeutico | null> {
  try {
    return interpretarPlano(await textoDoPdf(conteudo));
  } catch {
    return null; // PDF corrompido ou protegido: fica sem os dados
  }
}
