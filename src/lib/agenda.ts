// Carrega sessões da agenda importada do AnClinic com a situação de cada uma
// em relação à autorização (regra em regras/pendencias.ts). Usada pela lista
// "A solicitar" e pela geração automática dos atendimentos.

import type { Prisma } from "@prisma/client";
import { deDate } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { codigoParaGuia, codigosAceitos } from "@/lib/regras/codigoGuia";
import { analisarSessao, type ContextoAnalise } from "@/lib/regras/pendencias";

const INCLUIR = {
  paciente: { select: { id: true, nome: true } },
  convenio: { select: { id: true, nome: true, integracao: true, codigoPrestador: true } },
  procedimento: {
    select: {
      id: true, codigoAnclinic: true, descricao: true, codigoTuss: true, tabelaTuss: true,
      equivalencias: { select: { convenioId: true, codigo: true, tabela: true, codigoTuss: true } },
    },
  },
  profissional: {
    select: {
      id: true, nome: true, conselho: true, numeroConselho: true, ufConselho: true,
      credenciamentos: { select: { convenioId: true } },
    },
  },
  unidade: { select: { id: true, nome: true, cnes: true } },
  atendimento: { select: { id: true, situacao: true } },
  autorizacao: { select: { id: true, status: true, motivoNegativa: true } },
} satisfies Prisma.AgendamentoInclude;

export async function analisarAgendamentos(where: Prisma.AgendamentoWhereInput) {
  const agendamentos = await prisma.agendamento.findMany({
    where,
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }, { pacienteAnclinic: "asc" }],
    include: INCLUIR,
  });

  const pacienteIds = [...new Set(agendamentos.map((a) => a.pacienteId).filter((id): id is string => !!id))];
  const [clinica, pedidos, autorizacoes] = await Promise.all([
    prisma.clinica.findFirst({ select: { id: true } }),
    prisma.pedidoMedico.findMany({
      where: { pacienteId: { in: pacienteIds }, ativo: true },
      select: { pacienteId: true, convenioId: true, dataPedido: true, validoAte: true, _count: { select: { documentos: true } } },
    }),
    prisma.autorizacao.findMany({
      where: { pacienteId: { in: pacienteIds }, status: "autorizada" },
      select: {
        id: true, pacienteId: true, convenioId: true, codigoProcedimento: true, procedimento: true, status: true, dataInicioVigencia: true,
        dataFimVigencia: true, quantidadeAutorizada: true, quantidadeUtilizada: true, _count: { select: { agendamentos: true } },
      },
    }),
  ]);

  const contextos = new Map<string, ContextoAnalise>();
  const contexto = (pacienteId: string | null): ContextoAnalise => {
    if (!pacienteId) return { clinicaCadastrada: !!clinica, pedidos: [], autorizacoes: [] };
    let c = contextos.get(pacienteId);
    if (!c) {
      c = {
        clinicaCadastrada: !!clinica,
        pedidos: pedidos
          .filter((p) => p.pacienteId === pacienteId)
          .map((p) => ({
            convenioId: p.convenioId,
            dataPedido: deDate(p.dataPedido),
            validoAte: p.validoAte && deDate(p.validoAte),
            arquivos: p._count.documentos,
          })),
        autorizacoes: autorizacoes
          .filter((a) => a.pacienteId === pacienteId)
          .map((a) => ({
            id: a.id,
            convenioId: a.convenioId,
            codigoProcedimento: a.codigoProcedimento,
            procedimento: a.procedimento,
            status: a.status,
            dataInicioVigencia: a.dataInicioVigencia && deDate(a.dataInicioVigencia),
            dataFimVigencia: a.dataFimVigencia && deDate(a.dataFimVigencia),
            saldo: a.quantidadeAutorizada === null ? null : a.quantidadeAutorizada - a.quantidadeUtilizada,
            ligadas: a._count.agendamentos,
          })),
      };
      contextos.set(pacienteId, c);
    }
    return c;
  };

  return agendamentos.map((a) => {
    const codigo = a.procedimento ? codigoParaGuia(a.procedimento, a.convenioId) : null;
    const analise = analisarSessao(
      {
        data: deDate(a.data),
        statusAnclinic: a.statusAnclinic,
        statusFaturamento: a.statusFaturamento,
        senhaAutorizacao: a.senhaAutorizacao,
        removidoEm: a.removidoEm,
        carteirinha: a.carteirinha,
        convenioAnclinic: a.convenioAnclinic,
        pacienteId: a.pacienteId,
        convenio: a.convenio,
        procedimento: a.procedimento && {
          codigoGuia: codigo?.codigo ?? null,
          codigosAceitos: codigosAceitos(a.procedimento, a.convenioId),
          descricao: a.procedimento.descricao,
        },
        profissional: a.profissional && {
          ...a.profissional,
          convenioIds: a.profissional.credenciamentos.map((c) => c.convenioId),
        },
        unidade: a.unidade,
        sala: a.sala,
        autorizacao: a.autorizacao,
      },
      contexto(a.pacienteId),
    );
    return { agendamento: a, codigo, ...analise };
  });
}

export type SessaoAnalisada = Awaited<ReturnType<typeof analisarAgendamentos>>[number];
