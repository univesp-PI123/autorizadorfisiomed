import { ErroHttp, json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { deDate, ehDataISO, hojeISO, paraDate, somarDias } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { analisarSessao, type ContextoAnalise, type SituacaoSessao } from "@/lib/regras/pendencias";

const SITUACOES: SituacaoSessao[] = ["pendente", "pronta", "coberta", "fora", "cancelada"];

// Sessões de um dia com a situação de cada uma em relação à autorização.
// Sem data, mostra amanhã (a rotina é solicitar na véspera).
export const GET = rota(async (req) => {
  await exigirSessao(req, ["admin", "recepcionista", "financeiro"]);
  const sp = req.nextUrl.searchParams;
  const data = sp.get("data") || somarDias(hojeISO(), 1);
  if (!ehDataISO(data)) throw new ErroHttp(422, "Data inválida.");
  const convenioId = sp.get("convenioId") || undefined;
  const situacao = sp.get("situacao") as SituacaoSessao | null;

  const agendamentos = await prisma.agendamento.findMany({
    where: { data: paraDate(data), ...(convenioId && { convenioId }) },
    orderBy: [{ horaInicio: "asc" }, { pacienteAnclinic: "asc" }],
    include: {
      paciente: { select: { id: true, nome: true } },
      convenio: { select: { id: true, nome: true, integracao: true, codigoPrestador: true } },
      procedimento: { select: { id: true, codigoAnclinic: true, descricao: true, codigoTuss: true } },
      profissional: {
        select: {
          id: true, nome: true, conselho: true, numeroConselho: true, ufConselho: true, cbo: true,
          credenciamentos: { select: { convenioId: true } },
        },
      },
      unidade: { select: { id: true, nome: true, cnes: true } },
    },
  });

  const pacienteIds = [...new Set(agendamentos.map((a) => a.pacienteId).filter((id): id is string => !!id))];
  const [clinica, pedidos, autorizacoes] = await Promise.all([
    prisma.clinica.findFirst({ select: { id: true } }),
    prisma.pedidoMedico.findMany({
      where: { pacienteId: { in: pacienteIds }, ativo: true },
      select: { pacienteId: true, convenioId: true, dataPedido: true, validoAte: true, _count: { select: { arquivos: true } } },
    }),
    prisma.autorizacao.findMany({
      where: { pacienteId: { in: pacienteIds }, status: "autorizada" },
      select: {
        pacienteId: true, convenioId: true, codigoProcedimento: true, status: true, dataInicioVigencia: true,
        dataFimVigencia: true, quantidadeAutorizada: true, quantidadeUtilizada: true,
      },
    }),
  ]);

  const contextoPorPaciente = new Map<string, ContextoAnalise>();
  const contexto = (pacienteId: string | null): ContextoAnalise => {
    const vazio = { clinicaCadastrada: !!clinica, pedidos: [], autorizacoes: [] };
    if (!pacienteId) return vazio;
    let c = contextoPorPaciente.get(pacienteId);
    if (!c) {
      c = {
        clinicaCadastrada: !!clinica,
        pedidos: pedidos
          .filter((p) => p.pacienteId === pacienteId)
          .map((p) => ({
            convenioId: p.convenioId,
            dataPedido: deDate(p.dataPedido),
            validoAte: p.validoAte && deDate(p.validoAte),
            arquivos: p._count.arquivos,
          })),
        autorizacoes: autorizacoes
          .filter((a) => a.pacienteId === pacienteId)
          .map((a) => ({
            convenioId: a.convenioId,
            codigoProcedimento: a.codigoProcedimento,
            status: a.status,
            dataInicioVigencia: a.dataInicioVigencia && deDate(a.dataInicioVigencia),
            dataFimVigencia: a.dataFimVigencia && deDate(a.dataFimVigencia),
            saldo: a.quantidadeAutorizada === null ? null : a.quantidadeAutorizada - a.quantidadeUtilizada,
          })),
      };
      contextoPorPaciente.set(pacienteId, c);
    }
    return c;
  };

  const analisadas = agendamentos.map((a) => {
    const analise = analisarSessao(
      {
        data,
        statusAnclinic: a.statusAnclinic,
        statusFaturamento: a.statusFaturamento,
        senhaAutorizacao: a.senhaAutorizacao,
        removidoEm: a.removidoEm,
        carteirinha: a.carteirinha,
        convenioAnclinic: a.convenioAnclinic,
        pacienteId: a.pacienteId,
        convenio: a.convenio,
        procedimento: a.procedimento,
        profissional: a.profissional && {
          ...a.profissional,
          convenioIds: a.profissional.credenciamentos.map((c) => c.convenioId),
        },
        unidade: a.unidade,
      },
      contexto(a.pacienteId),
    );
    return {
      id: a.id,
      idAnclinic: a.idAnclinic,
      horaInicio: a.horaInicio,
      horaFim: a.horaFim,
      paciente: a.paciente,
      pacienteAnclinic: a.pacienteAnclinic,
      convenio: a.convenio && { id: a.convenio.id, nome: a.convenio.nome },
      convenioAnclinic: a.convenioAnclinic,
      carteirinha: a.carteirinha,
      procedimento: a.procedimento,
      profissional: a.profissional && {
        id: a.profissional.id,
        nome: a.profissional.nome,
        conselho: a.profissional.conselho,
        numeroConselho: a.profissional.numeroConselho,
      },
      unidade: a.unidade && { id: a.unidade.id, nome: a.unidade.nome },
      statusAnclinic: a.statusAnclinic,
      agendamentosRestantes: a.agendamentosRestantes,
      ...analise,
    };
  });

  const resumo = Object.fromEntries(SITUACOES.map((s) => [s, 0])) as Record<SituacaoSessao, number>;
  const contagemPendencias = new Map<string, number>();
  for (const a of analisadas) {
    resumo[a.situacao]++;
    for (const p of a.pendencias) contagemPendencias.set(p, (contagemPendencias.get(p) ?? 0) + 1);
  }

  return json({
    data,
    total: analisadas.length,
    resumo,
    pendencias: [...contagemPendencias.entries()]
      .map(([pendencia, quantidade]) => ({ pendencia, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade),
    sessoes: situacao && SITUACOES.includes(situacao) ? analisadas.filter((a) => a.situacao === situacao) : analisadas,
  });
});
