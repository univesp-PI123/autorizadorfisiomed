import { ErroHttp, json, rota } from "@/lib/api/http";
import { analisarAgendamentos } from "@/lib/agenda";
import { exigirSessao } from "@/lib/auth/sessao";
import { deDate, ehDataISO, hojeISO, paraDate } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import type { SituacaoSessao } from "@/lib/regras/pendencias";
import { situacaoDaGuia } from "@/lib/tiss/envio";

const SITUACOES: SituacaoSessao[] = ["pendente", "pronta", "coberta", "fora", "cancelada"];

// Sessões de um dia (padrão: hoje) com a situação de cada uma em relação à
// autorização.
export const GET = rota(async (req) => {
  await exigirSessao(req, ["admin", "recepcionista", "financeiro"]);
  const sp = req.nextUrl.searchParams;
  const data = sp.get("data") || hojeISO();
  if (!ehDataISO(data)) throw new ErroHttp(422, "Data inválida.");
  const convenioId = sp.get("convenioId") || undefined;
  const situacao = sp.get("situacao") as SituacaoSessao | null;

  const sessoes = await analisarAgendamentos({ data: paraDate(data), ...(convenioId && { convenioId }) });
  // Última guia TISS gerada com cada sessão, com a resposta da operadora.
  const guias = await prisma.guiaTiss.findMany({
    where: { agendamentoIds: { hasSome: sessoes.map((s) => s.agendamento.id) } },
    select: {
      id: true, numero: true, agendamentoIds: true, enviadaEm: true, statusOperadora: true, senhaOperadora: true,
      validadeSenha: true, glosas: true, erroEnvio: true, createdAt: true, convenio: { select: { integracao: true } },
    },
    orderBy: { numero: "desc" },
  });
  const guiaDaSessao = new Map<string, (typeof guias)[number]>();
  for (const g of guias) for (const id of g.agendamentoIds) if (!guiaDaSessao.has(id)) guiaDaSessao.set(id, g);
  const resumoGuia = (g: (typeof guias)[number] | undefined) =>
    g && {
      id: g.id,
      numero: g.numero,
      situacao: situacaoDaGuia(g),
      enviada: !!g.enviadaEm,
      // Só no dia em que foi gerada: o token do paciente vale só nesse dia.
      podeEnviar: g.convenio.integracao === "tiss_amil" && !g.statusOperadora && hojeISO(g.createdAt) === hojeISO(),
      senha: g.senhaOperadora,
      validadeSenha: g.validadeSenha && deDate(g.validadeSenha),
      glosas: g.glosas,
      erro: g.erroEnvio,
    };

  const analisadas = sessoes.map(
    ({ agendamento: a, codigo, ...analise }) => ({
      id: a.id,
      idAnclinic: a.idAnclinic,
      data: deDate(a.data),
      horaInicio: a.horaInicio,
      horaFim: a.horaFim,
      paciente: a.paciente,
      pacienteAnclinic: a.pacienteAnclinic,
      convenio: a.convenio && { id: a.convenio.id, nome: a.convenio.nome },
      convenioAnclinic: a.convenioAnclinic,
      carteirinha: a.carteirinha,
      procedimento: a.procedimento && {
        id: a.procedimento.id,
        codigoAnclinic: a.procedimento.codigoAnclinic,
        descricao: a.procedimento.descricao,
        codigoGuia: codigo?.codigo ?? null,
      },
      profissional: a.profissional && {
        id: a.profissional.id,
        nome: a.profissional.nome,
        conselho: a.profissional.conselho,
        numeroConselho: a.profissional.numeroConselho,
      },
      unidade: a.unidade && { id: a.unidade.id, nome: a.unidade.nome },
      unidadeManual: a.unidadeManual,
      // Pede o token na sessão da Amil; ele só vale se foi informado no dia.
      pedeToken: a.convenio?.integracao === "tiss_amil",
      token: a.tokenBeneficiario,
      tokenDoDia: !!a.tokenInformadoEm && hojeISO(a.tokenInformadoEm) === deDate(a.data),
      statusAnclinic: a.statusAnclinic,
      agendamentosRestantes: a.agendamentosRestantes,
      atendimento: a.atendimento,
      situacao: analise.situacao,
      pendencias: analise.pendencias,
      motivo: analise.motivo,
      guia: resumoGuia(guiaDaSessao.get(a.id)) ?? null,
    }),
  );

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
    semUnidade: analisadas.filter((a) => !a.unidade).length,
    pendencias: [...contagemPendencias.entries()]
      .map(([pendencia, quantidade]) => ({ pendencia, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade),
    sessoes: situacao && SITUACOES.includes(situacao) ? analisadas.filter((a) => a.situacao === situacao) : analisadas,
  });
});
