import { ErroHttp, json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { ehDataISO, hojeISO } from "@/lib/datas";
import { gerarSolicitacoes, listaDoDia } from "@/lib/solicitacoes";
import { esquemaGerarSolicitacoes, lerCorpo } from "@/lib/validacao";

const PERFIS = ["admin", "recepcionista", "financeiro"] as const;

// Sessões da agenda do AnClinic a pedir hoje (ou no dia informado), agrupadas
// como vão virar pedidos, com o que falta em cada uma.
export const GET = rota(async (req) => {
  await exigirSessao(req, [...PERFIS]);
  const dia = req.nextUrl.searchParams.get("dia") || hojeISO();
  if (!ehDataISO(dia)) throw new ErroHttp(422, "Data inválida.");
  return json(await listaDoDia(dia));
});

// Gera os pedidos (status "pendente"): todas as sessões prontas do dia, ou só
// as sessões escolhidas (atendimento escolar no dia, pedido negado).
export const POST = rota(async (req) => {
  const usuario = await exigirSessao(req, [...PERFIS]);
  const dados = await lerCorpo(req, esquemaGerarSolicitacoes);
  const resultado = await gerarSolicitacoes({ dia: dados.dia ?? hojeISO(), usuarioId: usuario.id, agendamentoIds: dados.agendamentoIds });
  return json(resultado, resultado.criadas ? 201 : 200);
});
