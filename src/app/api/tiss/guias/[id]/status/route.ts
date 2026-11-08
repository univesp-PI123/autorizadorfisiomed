import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { consultarStatusGuia } from "@/lib/tiss/envio";

type Params = { id: string };

// Consulta na operadora o status da guia (solicitacaoStatusAutorizacao) e
// devolve a guia atualizada. A rotina faz o mesmo sozinha enquanto a guia
// está em análise; o botão serve para não esperar a próxima rodada.
export const POST = rota<Params>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  return json(await consultarStatusGuia(id));
});
