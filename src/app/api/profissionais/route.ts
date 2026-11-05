import type { Prisma } from "@prisma/client";
import { paginacao, respostaPaginada, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";

export const GET = rota(async (req) => {
  await exigirSessao(req);
  const sp = req.nextUrl.searchParams;
  const pag = paginacao(req, 50);
  const busca = sp.get("busca")?.trim();
  const digitos = busca?.replace(/\D/g, "");
  const convenioId = sp.get("convenioId") || undefined;
  const filtro = sp.get("filtro"); // incompletos | naoCredenciados

  const where: Prisma.ProfissionalWhereInput = {
    ...(busca && {
      OR: [
        { nome: { contains: busca, mode: "insensitive" } },
        ...(digitos ? [{ cpf: { contains: digitos } }, { numeroConselho: { contains: digitos } }] : []),
      ],
    }),
    ...(convenioId && filtro !== "naoCredenciados" && { credenciamentos: { some: { convenioId } } }),
    ...(convenioId && filtro === "naoCredenciados" && { credenciamentos: { none: { convenioId } } }),
    ...(filtro === "incompletos" && {
      AND: [{ OR: [{ conselho: null }, { numeroConselho: null }, { ufConselho: null }, { cbo: null }] }],
    }),
  };

  const [dados, total] = await Promise.all([
    prisma.profissional.findMany({
      where,
      orderBy: { nome: "asc" },
      skip: pag.skip,
      take: pag.limit,
      include: {
        credenciamentos: { select: { convenio: { select: { id: true, nome: true } } } },
        _count: { select: { agendamentos: true } },
      },
    }),
    prisma.profissional.count({ where }),
  ]);
  return respostaPaginada(dados, total, pag);
});

