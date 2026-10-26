// Geração das guias de solicitação (SP/SADT) a partir das sessões da agenda.
//
// Só entram sessões "prontas" (regras/pendencias.ts) que ainda não têm guia
// autorizada ou em andamento na operadora. Cada sessão vira uma guia, com
// quantidade 1 (orientação da Fisiomed). Cada guia é validada contra
// o schema da ANS antes de ser gravada.

import { analisarAgendamentos } from "@/lib/agenda";
import { deDate, hojeISO } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { pedidoDaSessao } from "@/lib/regras/pendencias";
import { STATUS_EM_ANDAMENTO, STATUS_SOLICITACAO } from "@/lib/tiss/dominios";
import { montarSolicitacaoSpSadt, VERSAO_TISS } from "@/lib/tiss/solicitacao";
import { validarMensagemTiss } from "@/lib/tiss/validarXsd";

export type GuiaGerada = {
  id: string;
  numero: number;
  paciente: string;
  procedimento: string;
  codigo: string;
  /** Data (dd/mm) e hora da sessão. */
  sessao: string;
};
export type GuiaComErro = { paciente: string; procedimento: string; erros: string[] };
export type SessaoRecusada = { agendamentoId: string; paciente: string; motivo: string };

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Indicação clínica do pedido, com o CID quando ele ainda não está no texto. */
function indicacaoDoPedido(indicacao: string | null, cid: string | null): string | null {
  const texto = indicacao?.trim() || "";
  const c = cid?.trim();
  const partes = [texto, c && !texto.toUpperCase().includes(c.toUpperCase()) ? `CID ${c}` : ""].filter(Boolean);
  return partes.join(" - ") || null;
}

export async function gerarGuias(agendamentoIds: string[], usuarioId: string) {
  const [sessoes, jaPedidas] = await Promise.all([
    analisarAgendamentos({ id: { in: agendamentoIds } }),
    prisma.guiaTiss.findMany({
      where: { agendamentoIds: { hasSome: agendamentoIds }, statusOperadora: { in: [...STATUS_EM_ANDAMENTO] } },
      select: { numero: true, statusOperadora: true, agendamentoIds: true },
    }),
  ]);
  const guiaEmAndamento = new Map(jaPedidas.flatMap((g) => g.agendamentoIds.map((id) => [id, g] as const)));

  const recusadas: SessaoRecusada[] = [];
  const prontas = sessoes.filter((s) => {
    const motivo = (() => {
      if (s.situacao !== "pronta") return s.pendencias.length ? s.pendencias.join("; ") : (s.motivo ?? s.situacao);
      const g = guiaEmAndamento.get(s.agendamento.id);
      if (g) return `Guia ${g.numero} já está ${STATUS_SOLICITACAO[g.statusOperadora!].toLowerCase()} na operadora`;
      // O token só vale no dia em que o paciente o gerou.
      const t = s.agendamento.tokenInformadoEm;
      if (s.agendamento.tokenBeneficiario && t && hojeISO(t) !== hojeISO()) return `Token de ${ddmm(hojeISO(t))} venceu: pegue um novo com o paciente`;
      return null;
    })();
    if (!motivo) return true;
    recusadas.push({
      agendamentoId: s.agendamento.id,
      paciente: s.agendamento.paciente?.nome ?? s.agendamento.pacienteAnclinic ?? "—",
      motivo,
    });
    return false;
  });
  if (!prontas.length) return { guias: [], erros: [], recusadas };

  const pacienteIds = [...new Set(prontas.map((s) => s.agendamento.pacienteId!))];
  const codigos = [...new Set(prontas.map((s) => s.codigo!.codigo))];
  const [clinica, pedidos, termos] = await Promise.all([
    prisma.clinica.findFirst({ select: { razaoSocial: true } }),
    prisma.pedidoMedico.findMany({
      where: { pacienteId: { in: pacienteIds }, ativo: true },
      include: { _count: { select: { documentos: true } } },
    }),
    prisma.tussProcedimento.findMany({ where: { codigo: { in: codigos } } }),
  ]);
  const termoTuss = new Map(termos.map((t) => [t.codigo, t.termo]));
  const pedidosAnalise = pedidos.map((p) => ({
    ...p,
    dataPedido: deDate(p.dataPedido),
    validoAte: p.validoAte && deDate(p.validoAte),
    arquivos: p._count.documentos,
    indicacao: !!(p.indicacaoClinica?.trim() || p.cid?.trim()),
  }));

  const guias: GuiaGerada[] = [];
  const erros: GuiaComErro[] = [];
  for (const s of prontas) {
    const a = s.agendamento;
    const doPaciente = pedidosAnalise.filter((p) => p.pacienteId === a.pacienteId);
    const pedido = pedidoDaSessao(doPaciente, a.convenio!.id, deDate(a.data))!;
    const { codigo, tabela } = s.codigo!;
    const descricao = (tabela === "22" && termoTuss.get(codigo)) || a.procedimento!.descricao;
    const paciente = a.paciente?.nome ?? a.pacienteAnclinic ?? "—";

    const [{ numero }] = await prisma.$queryRaw<{ numero: number }[]>`
      SELECT nextval(pg_get_serial_sequence('guias_tiss', 'numero'))::int AS numero`;
    const sessao = `${ddmm(deDate(a.data))}${a.horaInicio ? ` ${a.horaInicio}` : ""}`;
    const r = montarSolicitacaoSpSadt({
      numeroGuiaPrestador: String(numero),
      sequencialTransacao: String(numero),
      agora: new Date(),
      registroAns: a.convenio!.codigoAns,
      prestador: { codigoNaOperadora: a.convenio!.codigoPrestador, nome: clinica?.razaoSocial ?? null },
      carteirinha: a.carteirinha,
      codValidacao: a.tokenBeneficiario,
      solicitante: {
        nome: pedido.medicoNome,
        conselho: pedido.conselho,
        numeroConselho: pedido.numeroConselho,
        uf: pedido.ufConselho,
        cbo: pedido.cbo,
      },
      dataSolicitacao: pedido.dataPedido,
      indicacaoClinica: indicacaoDoPedido(pedido.indicacaoClinica, pedido.cid),
      procedimentos: [{ tabela, codigo, descricao, quantidade: 1 }],
      cnes: a.unidade!.cnes,
      observacao: `Sessão: ${sessao}`,
    });
    if (!r.ok) {
      erros.push({ paciente, procedimento: descricao, erros: r.erros });
      continue;
    }
    const errosXsd = await validarMensagemTiss(r.xmlUtf8);
    if (errosXsd.length) {
      erros.push({ paciente, procedimento: descricao, erros: errosXsd });
      continue;
    }
    const guia = await prisma.guiaTiss.create({
      data: {
        numero,
        convenioId: a.convenio!.id,
        pacienteId: a.pacienteId!,
        pedidoId: pedido.id,
        agendamentoIds: [a.id],
        codigoProcedimento: codigo,
        quantidade: 1,
        versaoTiss: VERSAO_TISS,
        xml: r.xml,
        hash: r.hash,
        usuarioId,
      },
    });
    guias.push({ id: guia.id, numero, paciente, procedimento: descricao, codigo, sessao });
  }

  return { guias, erros, recusadas };
}
