import { z } from "zod";
import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { cancelarGuia } from "@/lib/tiss/envio";
import { lerCorpo } from "@/lib/validacao";

type Params = { id: string };

const esquema = z.object({
  motivo: z.string().trim().min(3, "Informe o motivo do cancelamento.").max(500),
});

// Cancela a guia na operadora (cancelaGuia). O motivo é obrigatório e fica no
// sistema: a mensagem TISS não tem esse campo.
export const POST = rota<Params>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  const { motivo } = await lerCorpo(req, esquema);
  return json(await cancelarGuia(id, motivo));
});
