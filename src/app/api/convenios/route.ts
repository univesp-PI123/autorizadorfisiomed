import type { Prisma } from "@prisma/client";
import { ErroHttp, filtroBooleano, json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaConvenio, lerCorpo } from "@/lib/validacao";

export const GET = rota(async (req) => {
  await exigirSessao(req);
  const sp = req.nextUrl.searchParams;
  const busca = sp.get("busca")?.trim();
  const ativo = filtroBooleano(sp.get("ativo"));
  const where: Prisma.ConvenioWhereInput = {
    ...(ativo !== undefined && { ativo }),
    ...(busca && { nome: { contains: busca, mode: "insensitive" } }),
  };
  return json(await prisma.convenio.findMany({ where, orderBy: { nome: "asc" } }));
});

export const POST = rota(async (req) => {
  await exigirSessao(req, ["admin", "financeiro"]);
  const dados = await lerCorpo(req, esquemaConvenio);
  if (await prisma.convenio.findUnique({ where: { nome: dados.nome } })) {
    throw new ErroHttp(409, "Convênio com este nome já existe.");
  }
  return json(await prisma.convenio.create({ data: dados }), 201);
});
