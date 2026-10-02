// Lista "A solicitar" do dia e geração dos pedidos de autorização a partir da
// agenda importada do AnClinic. As datas seguem regras/solicitacao.ts (pedido
// na véspera) e a situação de cada sessão, regras/pendencias.ts.
//
// Cada pedido junta as sessões do mesmo paciente, convênio, procedimento e
// unidade (a unidade define o CNES). As sessões ficam ligadas ao pedido: ele
// cobre só elas, e a próxima importação acerta os pedidos ainda não enviados.

import type { Prisma } from "@prisma/client";
import { analisarAgendamentos, type SessaoAnalisada } from "@/lib/agenda";
import { ErroHttp } from "@/lib/api/http";
import { deDate, paraDate } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { sessaoInativa, type SituacaoSessao } from "@/lib/regras/pendencias";
import { cabeNoPedido, datasDaJanela, fimDaSemana } from "@/lib/regras/solicitacao";

const ORDEM: SituacaoSessao[] = ["pronta", "pendente", "escolar", "negada", "solicitada", "coberta"];

export type GrupoSolicitacao = {
  chave: string;
  situacao: SituacaoSessao;
  paciente: { id: string; nome: string } | null;
  pacienteAnclinic: string | null;
  carteirinha: string | null;
  convenio: { id: string; nome: string } | null;
  procedimento: { id: string; descricao: string; codigoGuia: string | null } | null;
  unidade: { id: string; nome: string } | null;
  sessoes: { id: string; data: string; horaInicio: string | null; profissional: string | null; sala: string | null }[];
  pendencias: string[];
  motivo: string | null;
  autorizacaoId: string | null;
};

function agrupar(sessoes: SessaoAnalisada[]): GrupoSolicitacao[] {
  const grupos = new Map<string, GrupoSolicitacao>();
  for (const s of sessoes) {
    const a = s.agendamento;
    const chave = [s.situacao, a.pacienteId ?? a.pacienteAnclinic, a.convenioId, a.procedimentoId, a.unidadeId, s.autorizacaoId].join("|");
    let g = grupos.get(chave);
    if (!g) {
      g = {
        chave,
        situacao: s.situacao,
        paciente: a.paciente,
        pacienteAnclinic: a.pacienteAnclinic,
        carteirinha: a.carteirinha,
        convenio: a.convenio && { id: a.convenio.id, nome: a.convenio.nome },
        procedimento: a.procedimento && { id: a.procedimento.id, descricao: a.procedimento.descricao, codigoGuia: s.codigo?.codigo ?? null },
        unidade: a.unidade && { id: a.unidade.id, nome: a.unidade.nome },
        sessoes: [],
        pendencias: [],
        motivo: s.motivo ?? null,
        autorizacaoId: s.autorizacaoId ?? null,
      };
      grupos.set(chave, g);
    }
    g.sessoes.push({ id: a.id, data: deDate(a.data), horaInicio: a.horaInicio, profissional: a.profissional?.nome ?? null, sala: a.sala });
    for (const p of s.pendencias) if (!g.pendencias.includes(p)) g.pendencias.push(p);
  }
  const nome = (g: GrupoSolicitacao) => g.paciente?.nome ?? g.pacienteAnclinic ?? "";
  return [...grupos.values()].sort(
    (x, y) =>
      ORDEM.indexOf(x.situacao) - ORDEM.indexOf(y.situacao) ||
      x.sessoes[0].data.localeCompare(y.sessoes[0].data) ||
      nome(x).localeCompare(nome(y), "pt-BR"),
  );
}

/** Sessões que entram na lista do dia, agrupadas como vão virar pedidos. */
export async function listaDoDia(dia: string) {
  const datas = datasDaJanela(dia);
  const analisadas = await analisarAgendamentos({ data: { in: datas.map(paraDate) } });

  const resumo = Object.fromEntries(
    (["pronta", "pendente", "escolar", "negada", "solicitada", "coberta", "fora", "cancelada"] as SituacaoSessao[]).map((s) => [s, 0]),
  ) as Record<SituacaoSessao, number>;
  const contagem = new Map<string, number>();
  for (const s of analisadas) {
    resumo[s.situacao]++;
    if (s.situacao === "pendente") for (const p of s.pendencias) contagem.set(p, (contagem.get(p) ?? 0) + 1);
  }

  return {
    dia,
    datas,
    resumo,
    pendencias: [...contagem].map(([pendencia, quantidade]) => ({ pendencia, quantidade })).sort((a, b) => b.quantidade - a.quantidade),
    grupos: agrupar(analisadas.filter((s) => ORDEM.includes(s.situacao))),
  };
}

const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** "05/10 (2), 06/10 (1)" */
function descreverDatas(datas: string[]) {
  const porDia = new Map<string, number>();
  for (const d of [...datas].sort()) porDia.set(d, (porDia.get(d) ?? 0) + 1);
  return [...porDia].map(([d, n]) => `${ddmm(d)} (${n})`).join(", ");
}

function porQueNao(s: SessaoAnalisada, dia: string) {
  if (s.pendencias.length) return `Falta resolver: ${s.pendencias.join("; ")}.`;
  if (s.situacao === "escolar") return "Atendimento escolar só é pedido no dia da sessão.";
  if (s.situacao === "solicitada" || s.situacao === "coberta") return "Esta sessão já tem pedido.";
  if (s.situacao === "pronta") return "";
  return `Sessão fora da lista de ${ddmm(dia)}: ${s.motivo ?? s.situacao}.`;
}

/**
 * Gera os pedidos (status "pendente") do dia. Sem `agendamentoIds`, das
 * sessões prontas; com eles, dessas sessões — inclusive atendimento escolar
 * (no dia) e pedido negado (para pedir de novo), desde que sem pendência.
 * Um pedido do mesmo dia, ainda não enviado, recebe as sessões novas.
 */
export async function gerarSolicitacoes({ dia, usuarioId, agendamentoIds }: { dia: string; usuarioId: string; agendamentoIds?: string[] }) {
  const where: Prisma.AgendamentoWhereInput = { data: { in: datasDaJanela(dia).map(paraDate) } };
  if (agendamentoIds) where.id = { in: agendamentoIds };
  const analisadas = await analisarAgendamentos(where);
  if (agendamentoIds && analisadas.length !== new Set(agendamentoIds).size) {
    throw new ErroHttp(422, `Há sessões que não estão na lista de ${ddmm(dia)}.`);
  }

  const aceita = (s: SessaoAnalisada) =>
    s.situacao === "pronta" ||
    (!!agendamentoIds &&
      !s.pendencias.length &&
      (s.situacao === "negada" || (s.situacao === "escolar" && deDate(s.agendamento.data) === dia)));
  const recusada = agendamentoIds && analisadas.find((s) => !aceita(s));
  if (recusada) throw new ErroHttp(422, porQueNao(recusada, dia));
  const aceitas = analisadas.filter(aceita);
  if (!aceitas.length) return { criadas: 0, atualizadas: 0, sessoes: 0 };

  const grupos = new Map<string, SessaoAnalisada[]>();
  for (const s of aceitas) {
    const a = s.agendamento;
    const k = [a.pacienteId, a.convenioId, a.procedimentoId, a.unidadeId].join("|");
    grupos.set(k, [...(grupos.get(k) ?? []), s]);
  }

  return prisma.$transaction(
    async (tx) => {
      let criadas = 0;
      let atualizadas = 0;
      let sessoes = 0;
      for (const lista of grupos.values()) {
        const a0 = lista[0].agendamento;
        const pacienteId = a0.pacienteId!;
        const convenioId = a0.convenioId!;
        const codigo = lista[0].codigo?.codigo ?? null;
        const ids = lista.map((s) => s.agendamento.id);
        const datas = lista.map((s) => deDate(s.agendamento.data)).sort();
        // Sessões ligadas a um pedido negado ou cancelado podem ir para o novo.
        const liberadas = [...new Set(lista.map((s) => s.agendamento.autorizacao?.id).filter((id): id is string => !!id))];

        const existente = await tx.autorizacao.findFirst({
          where: {
            status: "pendente",
            pacienteId,
            convenioId,
            codigoProcedimento: codigo,
            unidadeId: a0.unidadeId,
            dataSolicitacao: paraDate(dia),
            agendamentos: { some: {} },
          },
          select: { id: true, agendamentos: { select: { data: true } } },
        });

        let autorizacaoId: string;
        if (existente) {
          const todas = [...existente.agendamentos.map((x) => deDate(x.data)), ...datas].sort();
          await tx.autorizacao.update({
            where: { id: existente.id },
            data: {
              quantidadeSolicitada: { increment: lista.length },
              dataInicioVigencia: paraDate(todas[0]),
              dataFimVigencia: paraDate(fimDaSemana(todas[todas.length - 1])),
            },
          });
          autorizacaoId = existente.id;
          atualizadas++;
        } else {
          const vinculo = await tx.pacienteConvenio.findUnique({ where: { pacienteId_convenioId: { pacienteId, convenioId } } });
          const criada = await tx.autorizacao.create({
            data: {
              pacienteId,
              convenioId,
              pacienteConvenioId: vinculo?.id ?? null,
              unidadeId: a0.unidadeId,
              procedimento: a0.procedimento!.descricao,
              codigoProcedimento: codigo,
              quantidadeSolicitada: lista.length,
              dataSolicitacao: paraDate(dia),
              dataInicioVigencia: paraDate(datas[0]),
              dataFimVigencia: paraDate(fimDaSemana(datas[datas.length - 1])),
              status: "pendente",
              usuarioCriouId: usuarioId,
              observacoes: `Gerado pela lista do dia. Sessões: ${descreverDatas(datas)}.`,
              historico: { create: { statusNovo: "pendente", usuarioId, observacao: "Pedido gerado a partir da agenda do AnClinic." } },
            },
          });
          autorizacaoId = criada.id;
          criadas++;
        }

        // Só liga sessões ainda livres: se outra pessoa gerou ao mesmo tempo,
        // a contagem não fecha e nada é gravado.
        const { count } = await tx.agendamento.updateMany({
          where: { id: { in: ids }, OR: [{ autorizacaoId: null }, ...(liberadas.length ? [{ autorizacaoId: { in: liberadas } }] : [])] },
          data: { autorizacaoId },
        });
        if (count !== ids.length) throw new ErroHttp(409, "A lista mudou enquanto os pedidos eram gerados. Recarregue a página.");
        sessoes += count;
      }
      return { criadas, atualizadas, sessoes };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

/**
 * Depois de importar a agenda, os pedidos ainda não enviados acompanham o
 * AnClinic: sessão desmarcada ou excluída sai do pedido (sem nenhuma, ele é
 * cancelado) e sessão remarcada para outra semana volta para a lista.
 */
export async function reconciliarPendentes() {
  const pendentes = await prisma.autorizacao.findMany({
    where: { status: "pendente", agendamentos: { some: {} } },
    select: {
      id: true,
      quantidadeSolicitada: true,
      dataSolicitacao: true,
      dataInicioVigencia: true,
      dataFimVigencia: true,
      agendamentos: { select: { id: true, data: true, statusAnclinic: true, removidoEm: true } },
    },
  });
  let canceladas = 0;
  let ajustadas = 0;
  for (const a of pendentes) {
    const pedidoEm = deDate(a.dataSolicitacao);
    const ativas = a.agendamentos.filter((s) => !s.removidoEm && !sessaoInativa(s.statusAnclinic));
    const fora = ativas.filter((s) => !cabeNoPedido(deDate(s.data), pedidoEm));
    const ficam = ativas.filter((s) => !fora.includes(s));

    await prisma.$transaction(async (tx) => {
      if (fora.length) await tx.agendamento.updateMany({ where: { id: { in: fora.map((s) => s.id) }, autorizacaoId: a.id }, data: { autorizacaoId: null } });
      if (!ficam.length) {
        const { count } = await tx.autorizacao.updateMany({ where: { id: a.id, status: "pendente" }, data: { status: "cancelada" } });
        if (count) {
          await tx.historicoStatus.create({
            data: { autorizacaoId: a.id, statusAnterior: "pendente", statusNovo: "cancelada", observacao: "Sessões desmarcadas, excluídas ou remarcadas no AnClinic (automático)." },
          });
          canceladas++;
        }
        return;
      }
      const datas = ficam.map((s) => deDate(s.data)).sort();
      const novo = { quantidadeSolicitada: ficam.length, dataInicioVigencia: datas[0], dataFimVigencia: fimDaSemana(datas[datas.length - 1]) };
      if (
        novo.quantidadeSolicitada !== a.quantidadeSolicitada ||
        novo.dataInicioVigencia !== (a.dataInicioVigencia && deDate(a.dataInicioVigencia)) ||
        novo.dataFimVigencia !== (a.dataFimVigencia && deDate(a.dataFimVigencia))
      ) {
        await tx.autorizacao.updateMany({
          where: { id: a.id, status: "pendente" },
          data: { ...novo, dataInicioVigencia: paraDate(novo.dataInicioVigencia), dataFimVigencia: paraDate(novo.dataFimVigencia) },
        });
        ajustadas++;
      }
    });
  }
  return { canceladas, ajustadas };
}
