import bcrypt from "bcryptjs";
import { ErroHttp, filtroBooleano, json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { CAMPOS_PUBLICOS_USUARIO } from "@/lib/usuarios";
import { esquemaUsuarioNovo, lerCorpo } from "@/lib/validacao";

export const GET = rota(async (req) => {
  await exigirSessao(req, ["admin"]);
  const ativo = filtroBooleano(req.nextUrl.searchParams.get("ativo"));
  const usuarios = await prisma.usuario.findMany({
    where: ativo !== undefined ? { ativo } : {},
    select: CAMPOS_PUBLICOS_USUARIO,
    orderBy: { nome: "asc" },
  });
  return json(usuarios);
});

export const POST = rota(async (req) => {
  await exigirSessao(req, ["admin"]);
  const { senha, ...dados } = await lerCorpo(req, esquemaUsuarioNovo);
  if (await prisma.usuario.findUnique({ where: { email: dados.email } })) {
    throw new ErroHttp(409, "E-mail já cadastrado.");
  }
  const usuario = await prisma.usuario.create({
    data: { ...dados, senhaHash: await bcrypt.hash(senha, 12) },
    select: CAMPOS_PUBLICOS_USUARIO,
  });
  return json(usuario, 201);
});
