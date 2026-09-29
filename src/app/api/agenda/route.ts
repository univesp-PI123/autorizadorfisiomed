import { ErroHttp, json, rota } from "@/lib/api/http";
import { analisarAgendamentos } from "@/lib/agenda";
import { exigirSessao } from "@/lib/auth/sessao";
import { deDate, ehDataISO, hojeISO, paraDate } from "@/lib/datas";
import type { SituacaoSessao } from "@/lib/regras/pendencias";

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

  const analisadas = (await analisarAgendamentos({ data: paraDate(data), ...(convenioId && { convenioId }) })).map(
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
      statusAnclinic: a.statusAnclinic,
      agendamentosRestantes: a.agendamentosRestantes,
      atendimento: a.atendimento,
      situacao: analise.situacao,
      pendencias: analise.pendencias,
      motivo: analise.motivo,
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
