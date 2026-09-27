import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";

// As unidades são criadas pela importação da agenda (pelo nome no AnClinic);
// aqui só se completam os dados (CNES, endereço).
export const GET = rota(async (req) => {
  await exigirSessao(req, ["admin", "recepcionista", "financeiro"]);
  return json(await prisma.unidade.findMany({ orderBy: { nome: "asc" } }));
});
