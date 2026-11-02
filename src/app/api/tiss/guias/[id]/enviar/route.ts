import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { enviarGuia } from "@/lib/tiss/envio";

type Params = { id: string };

// Envia a guia ao webservice da operadora (solicitacaoProcedimento) e devolve
// a resposta já gravada na guia.
export const POST = rota<Params>(async (req, { params }) => {
  await exigirSessao(req, ["admin", "recepcionista"]);
  const { id } = await params;
  return json(await enviarGuia(id));
});
