import type { Prisma } from "@prisma/client";
import { paginacao, respostaPaginada, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";

// Tabela 22 da TUSS (importada da ANS), com a busca por código ou termo.
export const GET = rota(async (req) => {
  await exigirSessao(req);
  const busca = req.nextUrl.searchParams.get("busca")?.trim();
  const pag = paginacao(req, 50);
  const where: Prisma.TussProcedimentoWhereInput = busca
    ? { OR: [{ codigo: { startsWith: busca.replace(/\D/g, "") || busca } }, { termo: { contains: busca, mode: "insensitive" } }] }
    : {};
  const [dados, total] = await Promise.all([
    prisma.tussProcedimento.findMany({ where, orderBy: { codigo: "asc" }, skip: pag.skip, take: pag.limit }),
    prisma.tussProcedimento.count({ where }),
  ]);
  return respostaPaginada(dados, total, pag);
});
