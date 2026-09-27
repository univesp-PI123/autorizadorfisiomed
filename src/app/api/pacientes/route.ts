import type { Prisma } from "@prisma/client";
import { ErroHttp, filtroBooleano, json, paginacao, respostaPaginada, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaPaciente, lerCorpo } from "@/lib/validacao";

export const GET = rota(async (req) => {
  await exigirSessao(req);
  const sp = req.nextUrl.searchParams;
  const pag = paginacao(req);
  const busca = sp.get("busca")?.trim();
  const ativo = filtroBooleano(sp.get("ativo"));

  const where: Prisma.PacienteWhereInput = {
    ...(ativo !== undefined && { ativo }),
    ...(busca && {
      OR: [
        { nome: { contains: busca, mode: "insensitive" } },
        { cpf: { contains: busca } },
      ],
    }),
  };

  const [total, data] = await prisma.$transaction([
    prisma.paciente.count({ where }),
    prisma.paciente.findMany({
      where,
      include: {
        vinculos: { include: { convenio: { select: { id: true, nome: true } } } },
      },
      orderBy: { nome: "asc" },
      skip: pag.skip,
      take: pag.limit,
    }),
  ]);
  return respostaPaginada(data, total, pag);
});

export const POST = rota(async (req) => {
  await exigirSessao(req);
  const dados = await lerCorpo(req, esquemaPaciente);
  if (dados.cpf && (await prisma.paciente.findUnique({ where: { cpf: dados.cpf } }))) {
    throw new ErroHttp(409, "CPF já cadastrado no sistema.");
  }
  return json(await prisma.paciente.create({ data: dados }), 201);
});
