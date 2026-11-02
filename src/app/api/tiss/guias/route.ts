import { z } from "zod";
import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { gerarGuias } from "@/lib/tiss/guias";
import { lerCorpo } from "@/lib/validacao";

const esquema = z.object({
  agendamentoIds: z.array(z.string().uuid()).min(1, "Selecione ao menos uma sessão.").max(500),
});

// Gera as guias de solicitação (XML TISS) das sessões prontas escolhidas na
// agenda. Ainda não envia à operadora: o XML fica para baixar e conferir.
export const POST = rota(async (req) => {
  const usuario = await exigirSessao(req, ["admin", "recepcionista"]);
  const { agendamentoIds } = await lerCorpo(req, esquema);
  return json(await gerarGuias(agendamentoIds, usuario.id), 201);
});
