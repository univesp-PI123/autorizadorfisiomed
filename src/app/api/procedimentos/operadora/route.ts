import type { Prisma } from "@prisma/client";
import { ErroHttp, paginacao, respostaPaginada, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";

// Tabela de procedimentos de uma operadora (importada), com a busca.
export const GET = rota(async (req) => {
  await exigirSessao(req, ["admin", "recepcionista", "financeiro"]);
  const sp = req.nextUrl.searchParams;
  const convenioId = sp.get("convenioId");
  if (!convenioId) throw new ErroHttp(422, "Escolha o convênio.");
  const busca = sp.get("busca")?.trim();
  const pag = paginacao(req, 50);
  const where: Prisma.ProcedimentoOperadoraWhereInput = {
    convenioId,
    ...(busca && {
      OR: [
        { codigo: { contains: busca } },
        { codigoTuss: { contains: busca } },
        { descricao: { contains: busca, mode: "insensitive" } },
      ],
    }),
  };
  const [dados, total] = await Promise.all([
    prisma.procedimentoOperadora.findMany({
      where,
      orderBy: { codigo: "asc" },
      skip: pag.skip,
      take: pag.limit,
      include: { procedimento: { select: { id: true, codigoAnclinic: true, descricao: true } } },
    }),
    prisma.procedimentoOperadora.count({ where }),
  ]);
  return respostaPaginada(dados, total, pag);
});
