// Interpretação da planilha de profissionais cadastrados na operadora
// (colunas: Nome, CPF, Conselho, Numero no conselho, UF, Especialidades).

import { cboSugerido, siglaConselho, UFS } from "@/lib/tiss/dominios";
import { Avisos, type Aviso } from "./avisos";
import { acharCabecalho, cpf, soDigitos, texto, type Linha } from "./planilha";

const COLUNAS = ["Nome", "CPF", "Conselho", "Numero no conselho", "UF", "Especialidades cadastradas"] as const;
const OBRIGATORIAS = ["Nome", "CPF"] as const;

export type ProfissionalPlanilha = {
  linha: number;
  nome: string;
  cpf: string;
  conselho: string | null;
  numeroConselho: string | null;
  ufConselho: string | null;
  especialidades: string | null;
  cbo: string | null;
};

export type ProfissionaisInterpretados = {
  profissionais: ProfissionalPlanilha[];
  ignoradas: number;
  avisos: Aviso[];
};

const completo = (p: ProfissionalPlanilha) => !!(p.conselho && p.numeroConselho && p.ufConselho);

export function interpretarProfissionais(linhas: Linha[]): ProfissionaisInterpretados {
  const { indice, posicao } = acharCabecalho(linhas, COLUNAS, OBRIGATORIAS);
  const avisos = new Avisos();
  const porCpf = new Map<string, ProfissionalPlanilha>();
  let ignoradas = 0;

  const col = (l: Linha, c: (typeof COLUNAS)[number]) => (posicao[c] >= 0 ? l[posicao[c]] : null);

  linhas.slice(indice + 1).forEach((l, i) => {
    const linha = indice + 2 + i;
    if (l.every((c) => texto(c) === null)) return;

    const nome = texto(col(l, "Nome"))?.slice(0, 200);
    const cpfProf = cpf(col(l, "CPF"));
    if (!nome || !cpfProf) {
      ignoradas++;
      avisos.add("Sem nome ou com CPF inválido (ignorado).", linha);
      return;
    }

    const conselhoBruto = texto(col(l, "Conselho"));
    const conselho = siglaConselho(conselhoBruto);
    if (conselhoBruto && !conselho) avisos.add(`Conselho "${conselhoBruto}" não reconhecido.`, linha);
    const ufBruta = texto(col(l, "UF"))?.toUpperCase() ?? null;
    const ufConselho = ufBruta && (UFS as readonly string[]).includes(ufBruta) ? ufBruta : null;
    const especialidades = texto(col(l, "Especialidades cadastradas"))?.slice(0, 300) ?? null;

    const atual: ProfissionalPlanilha = {
      linha,
      nome,
      cpf: cpfProf,
      conselho,
      numeroConselho: soDigitos(col(l, "Numero no conselho"))?.slice(0, 15) ?? null,
      ufConselho,
      especialidades,
      cbo: cboSugerido(especialidades),
    };

    const anterior = porCpf.get(cpfProf);
    if (anterior) {
      ignoradas++;
      avisos.add("CPF repetido na planilha (vale a linha com os dados de conselho).", linha);
      if (completo(anterior) || !completo(atual)) return;
    }
    porCpf.set(cpfProf, atual);
  });

  const profissionais = [...porCpf.values()];
  for (const p of profissionais) {
    if (!completo(p)) avisos.add("Sem conselho, número ou UF: não poderá constar como executante na guia.", p.linha);
  }
  return { profissionais, ignoradas, avisos: avisos.lista() };
}
