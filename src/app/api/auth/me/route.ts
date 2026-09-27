import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";

export const GET = rota(async (req) => json(await exigirSessao(req)));
