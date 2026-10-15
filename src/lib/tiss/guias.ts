// Geração das guias de solicitação (SP/SADT) a partir das sessões da agenda.
//
// Só entram sessões "prontas" (regras/pendencias.ts). As sessões do mesmo
// paciente, convênio, procedimento, pedido médico e unidade viram uma guia só,
// com a quantidade de sessões. Cada guia é validada contra o schema da ANS
// antes de ser gravada.

import { analisarAgendamentos } from "@/lib/agenda";
import { deDate } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { pedidoDaSessao } from "@/lib/regras/pendencias";
import { montarSolicitacaoSpSadt, VERSAO_TISS } from "@/lib/tiss/solicitacao";
import { validarMensagemTiss } from "@/lib/tiss/validarXsd";

export type GuiaGerada = {
  id: string;
  numero: number;
  paciente: string;
  procedimento: string;
  codigo: string;
  quantidade: number;
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
  const sessoes = await analisarAgendamentos({ id: { in: agendamentoIds } });

  const recusadas: SessaoRecusada[] = [];
  const prontas = sessoes.filter((s) => {
    if (s.situacao === "pronta") return true;
    recusadas.push({
      agendamentoId: s.agendamento.id,
      paciente: s.agendamento.paciente?.nome ?? s.agendamento.pacienteAnclinic ?? "—",
      motivo: s.pendencias.length ? s.pendencias.join("; ") : (s.motivo ?? s.situacao),
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

  // Agrupa as sessões que cabem numa guia só.
  const grupos = new Map<string, { sessoes: typeof prontas; pedido: (typeof pedidosAnalise)[number] }>();
  for (const s of prontas) {
    const a = s.agendamento;
    const doPaciente = pedidosAnalise.filter((p) => p.pacienteId === a.pacienteId);
    const pedido = pedidoDaSessao(doPaciente, a.convenio!.id, deDate(a.data))!;
    const chave = [a.pacienteId, a.convenio!.id, s.codigo!.codigo, pedido.id, a.unidade!.cnes, a.carteirinha].join("|");
    const g = grupos.get(chave);
    if (g) g.sessoes.push(s);
    else grupos.set(chave, { sessoes: [s], pedido });
  }

  const guias: GuiaGerada[] = [];
  const erros: GuiaComErro[] = [];
  for (const { sessoes: doGrupo, pedido } of grupos.values()) {
    const a = doGrupo[0].agendamento;
    const codigo = doGrupo[0].codigo!.codigo;
    const descricao = termoTuss.get(codigo) ?? a.procedimento!.descricao;
    const paciente = a.paciente?.nome ?? a.pacienteAnclinic ?? "—";

    const [{ numero }] = await prisma.$queryRaw<{ numero: number }[]>`
      SELECT nextval(pg_get_serial_sequence('guias_tiss', 'numero'))::int AS numero`;
    const datas = doGrupo
      .map((s) => `${ddmm(deDate(s.agendamento.data))}${s.agendamento.horaInicio ? ` ${s.agendamento.horaInicio}` : ""}`)
      .join(", ");
    const r = montarSolicitacaoSpSadt({
      numeroGuiaPrestador: String(numero),
      sequencialTransacao: String(numero),
      agora: new Date(),
      registroAns: a.convenio!.codigoAns,
      prestador: { codigoNaOperadora: a.convenio!.codigoPrestador, nome: clinica?.razaoSocial ?? null },
      carteirinha: a.carteirinha,
      solicitante: {
        nome: pedido.medicoNome,
        conselho: pedido.conselho,
        numeroConselho: pedido.numeroConselho,
        uf: pedido.ufConselho,
        cbo: pedido.cbo,
      },
      dataSolicitacao: pedido.dataPedido,
      indicacaoClinica: indicacaoDoPedido(pedido.indicacaoClinica, pedido.cid),
      procedimentos: [{ tabela: "22", codigo, descricao, quantidade: doGrupo.length }],
      cnes: a.unidade!.cnes,
      observacao: `Sessões: ${datas}`,
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
        agendamentoIds: doGrupo.map((s) => s.agendamento.id),
        codigoProcedimento: codigo,
        quantidade: doGrupo.length,
        versaoTiss: VERSAO_TISS,
        xml: r.xml,
        hash: r.hash,
        usuarioId,
      },
    });
    guias.push({ id: guia.id, numero, paciente, procedimento: descricao, codigo, quantidade: doGrupo.length });
  }

  return { guias, erros, recusadas };
}
