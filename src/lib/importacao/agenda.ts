// Interpretação do "Relatório de Agendamento" exportado do AnClinic.
// Função pura: transforma as linhas da planilha em sessões normalizadas e
// avisos. A gravação no banco fica em gravarAgenda.ts.

import { Avisos, type Aviso } from "./avisos";
import {
  acharCabecalho,
  cpf,
  dataBR, 
  hora,
  inteiro,
  soDigitos,
  texto,
  type Linha,
} from "./planilha";

const COLUNAS = [
  "ID Agendamento",
  "Data",
  "Hora Início",
  "Hora Fim",
  "Paciente",
  "CPF Paciente",
  "Profissional",
  "CPF Profissional",
  "CNS Profissional",
  "Convênio",
  "Cartão",
  "Procedimento",
  "Agenda",
  "Status", 
  "Status de Faturamento",
  "Dt. Nasc. Paciente",
  "Telefone Celular",
  "Agendamentos Restantes",
  "Senha Autorização",
  "Senha Execução",
  "Unidade de Atendimento",
  "Sala",
] as const;

const OBRIGATORIAS = ["ID Agendamento", "Data", "Paciente", "Convênio", "Cartão", "Procedimento", "Profissional"] as const;

export type SessaoAgenda = {
  linha: number; // número da linha no Excel (1 = primeira)
  idAnclinic: string;
  data: string;
  horaInicio: string | null;
  horaFim: string | null;
  paciente: { nome: string; cpf: string | null; nascimento: string | null; telefone: string | null } | null;
  profissional: { nome: string; cpf: string | null; cns: string | null } | null;
  convenio: string | null;
  carteirinha: string | null;
  procedimento: { codigo: string; descricao: string } | null;
  agenda: string | null;
  status: string | null;
  statusFaturamento: string | null;  
  agendamentosRestantes: number | null;
  senhaAutorizacao: string | null;
  senhaExecucao: string | null;
  unidade: string | null;
  sala: string | null;
};

export type AgendaInterpretada = {
  sessoes: SessaoAgenda[];
  periodo: { inicio: string; fim: string } | null;
  ignoradas: number;
  avisos: Aviso[];
};

/** "4440 - PSICOLOGIA ABA" → { codigo: "4440", descricao: "PSICOLOGIA ABA" } */
export function separarProcedimento(v: string | null): SessaoAgenda["procedimento"] {
  if (!v) return null;
  const m = v.match(/^\s*(\w+)\s*-\s*(.+)$/);
  return m ? { codigo: m[1], descricao: m[2].trim() } : { codigo: v.slice(0, 20), descricao: v };
}

/** Período do título "Período - 28/09/2026 a 30/09/2026", quando existe. */
function periodoDoTitulo(linhas: Linha[], ate: number) {
  for (const l of linhas.slice(0, ate)) {
    const m = texto(l[0])?.match(/(\d{2}\/\d{2}\/\d{4})\s+a\s+(\d{2}\/\d{2}\/\d{4})/);
    const inicio = m && dataBR(m[1]);
    const fim = m && dataBR(m[2]);
    if (inicio && fim) return { inicio, fim };
  }
  return null;
}

export function interpretarAgenda(linhas: Linha[]): AgendaInterpretada {
  const { indice, posicao } = acharCabecalho(linhas, COLUNAS, OBRIGATORIAS);
  const avisos = new Avisos();
  const sessoes: SessaoAgenda[] = [];
  const vistos = new Set<string>();
  let ignoradas = 0;

  const col = (l: Linha, c: (typeof COLUNAS)[number]) => (posicao[c] >= 0 ? l[posicao[c]] : null);

  linhas.slice(indice + 1).forEach((l, i) => {
    const linha = indice + 2 + i;
    if (l.every((c) => texto(c) === null)) return;

    const idAnclinic = soDigitos(col(l, "ID Agendamento"));
    const data = dataBR(col(l, "Data"));
    if (!idAnclinic || !data) {
      ignoradas++;
      avisos.add("Linha sem ID de agendamento ou data válida (ignorada).", linha);
      return;
    }
    if (vistos.has(idAnclinic)) {
      ignoradas++;
      avisos.add("ID de agendamento repetido na planilha (vale a primeira linha).", linha);
      return;
    }
    vistos.add(idAnclinic);

    const nomePaciente = texto(col(l, "Paciente"));
    let paciente: SessaoAgenda["paciente"] = null;
    if (nomePaciente) {
      const cpfBruto = texto(col(l, "CPF Paciente"));
      const cpfPaciente = cpf(cpfBruto);
      if (cpfBruto && !cpfPaciente) avisos.add("CPF do paciente inválido (desconsiderado).", linha);
      paciente = {
        nome: nomePaciente,
        cpf: cpfPaciente,
        nascimento: dataBR(col(l, "Dt. Nasc. Paciente")),
        telefone: texto(col(l, "Telefone Celular"))?.slice(0, 20) ?? null,
      };
    } else {
      avisos.add("Horário sem paciente (bloqueio ou reserva de agenda).", linha);
    }

    const nomeProfissional = texto(col(l, "Profissional"));
    let profissional: SessaoAgenda["profissional"] = null;
    if (nomeProfissional) {
      const cpfProf = cpf(col(l, "CPF Profissional"));
      if (!cpfProf) avisos.add("Profissional sem CPF válido na agenda.", linha);
      const cns = soDigitos(col(l, "CNS Profissional"));
      profissional = { nome: nomeProfissional, cpf: cpfProf, cns: cns && cns.length === 15 ? cns : null };
    }

    const convenio = texto(col(l, "Convênio"));
    if (paciente && !convenio) avisos.add("Sessão sem convênio.", linha);

    sessoes.push({
      linha,
      idAnclinic,
      data,
      horaInicio: hora(col(l, "Hora Início")),
      horaFim: hora(col(l, "Hora Fim")),
      paciente,
      profissional,
      convenio,
      carteirinha: texto(col(l, "Cartão"))?.slice(0, 100) ?? null,
      procedimento: separarProcedimento(texto(col(l, "Procedimento"))),
      agenda: texto(col(l, "Agenda"))?.slice(0, 200) ?? null,
      status: texto(col(l, "Status"))?.slice(0, 60) ?? null,
      statusFaturamento: texto(col(l, "Status de Faturamento"))?.slice(0, 60) ?? null,     
      agendamentosRestantes: inteiro(col(l, "Agendamentos Restantes")),
      senhaAutorizacao: texto(col(l, "Senha Autorização"))?.slice(0, 40) ?? null,
      senhaExecucao: texto(col(l, "Senha Execução"))?.slice(0, 40) ?? null,
      unidade: texto(col(l, "Unidade de Atendimento"))?.slice(0, 200) ?? null,
      sala: texto(col(l, "Sala"))?.slice(0, 200) ?? null,
    });
  });

  let periodo = periodoDoTitulo(linhas, indice);
  if (!periodo && sessoes.length) {
    const datas = sessoes.map((s) => s.data).sort();
    periodo = { inicio: datas[0], fim: datas[datas.length - 1] };
  }

  return { sessoes, periodo, ignoradas, avisos: avisos.lista() };
}
