// Carrega sessões da agenda com a situação de cada uma em relação à
// autorização (regra em regras/pendencias.ts). Usada pela tela Agenda e pela
// geração automática dos atendimentos.

import type { Prisma } from "@prisma/client";
import { deDate, hojeISO } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { codigoParaGuia, codigosAceitos } from "@/lib/regras/codigoGuia";
import { analisarSessao, type ContextoAnalise } from "@/lib/regras/pendencias";
import { STATUS_AUTORIZADA } from "@/lib/tiss/dominios";

const INCLUIR = {
  paciente: { select: { id: true, nome: true } },
  convenio: { select: { id: true, nome: true, integracao: true, codigoPrestador: true, codigoAns: true } },
  procedimento: {
    select: {
      id: true, codigoAnclinic: true, descricao: true, codigoTuss: true, tabelaTuss: true,
      equivalencias: { select: { convenioId: true, codigo: true, tabela: true, codigoTuss: true } },
    },
  },
  profissional: {
    select: {
      id: true, nome: true, conselho: true, numeroConselho: true, ufConselho: true, cbo: true,
      credenciamentos: { select: { convenioId: true } },
    },
  },
  unidade: { select: { id: true, nome: true, cnes: true } },
  atendimento: { select: { id: true, situacao: true } },
} satisfies Prisma.AgendamentoInclude;

export async function analisarAgendamentos(where: Prisma.AgendamentoWhereInput) {
  const agendamentos = await prisma.agendamento.findMany({
    where,
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }, { pacienteAnclinic: "asc" }],
    include: INCLUIR,
  });

  const pacienteIds = [...new Set(agendamentos.map((a) => a.pacienteId).filter((id): id is string => !!id))];
  const [clinica, pedidos, autorizacoes, guiasAutorizadas] = await Promise.all([
    prisma.clinica.findFirst({ select: { id: true } }),
    prisma.pedidoMedico.findMany({
      where: { pacienteId: { in: pacienteIds }, ativo: true },
      select: {
        id: true, pacienteId: true, convenioId: true, dataPedido: true, validoAte: true, cbo: true, cid: true, indicacaoClinica: true,
        _count: { select: { documentos: true } },
      },
    }),
    prisma.autorizacao.findMany({
      where: { pacienteId: { in: pacienteIds }, status: "autorizada" },
      select: {
        id: true, pacienteId: true, convenioId: true, codigoProcedimento: true, procedimento: true, status: true, dataInicioVigencia: true,
        dataFimVigencia: true, quantidadeAutorizada: true, quantidadeUtilizada: true,
      },
    }),
    prisma.guiaTiss.findMany({
      where: { agendamentoIds: { hasSome: agendamentos.map((a) => a.id) }, statusOperadora: { in: [...STATUS_AUTORIZADA] } },
      select: { numero: true, senhaOperadora: true, agendamentoIds: true },
      orderBy: { numero: "desc" },
    }),
  ]);
  const guiaAutorizada = (id: string) => {
    const g = guiasAutorizadas.find((g) => g.agendamentoIds.includes(id));
    return g ? { numero: g.numero, senha: g.senhaOperadora } : null;
  };

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
            id: p.id,
            convenioId: p.convenioId,
            dataPedido: deDate(p.dataPedido),
            validoAte: p.validoAte && deDate(p.validoAte),
            arquivos: p._count.documentos,
            cbo: p.cbo,
            indicacao: !!(p.indicacaoClinica?.trim() || p.cid?.trim()),
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
          })),
      };
      contextos.set(pacienteId, c);
    }
    return c;
  };

  return agendamentos.map((a) => {
    const codigo = a.procedimento ? codigoParaGuia(a.procedimento, a.convenio?.id ?? null) : null;
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
        token: a.tokenBeneficiario && a.tokenInformadoEm ? { valor: a.tokenBeneficiario, dia: hojeISO(a.tokenInformadoEm) } : null,
        guiaAutorizada: guiaAutorizada(a.id),
      },
      contexto(a.pacienteId),
    );
    return { agendamento: a, codigo, ...analise };
  });
}

export type SessaoAnalisada = Awaited<ReturnType<typeof analisarAgendamentos>>[number];
