import { z } from "zod";
import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { verificarElegibilidade } from "@/lib/tiss/envio";
import { lerCorpo } from "@/lib/validacao";

const esquema = z.object({ vinculoId: z.string().uuid() });

// Verifica na Amil (webservice TISS) se a carteirinha do vínculo está elegível.
export const POST = rota(async (req) => {
  await exigirSessao(req, ["admin", "recepcionista"]);
  const { vinculoId } = await lerCorpo(req, esquema);
  return json(await verificarElegibilidade(vinculoId));
});
