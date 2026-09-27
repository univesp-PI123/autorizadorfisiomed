import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { ErroHttp, rota } from "@/lib/api/http";
import {
  bloqueado,
  ipDaRequisicao,
  limparFalhas,
  registrarFalha,
} from "@/lib/auth/limiteTentativas";
import { criarToken, gravarCookieSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaLogin, lerCorpo } from "@/lib/validacao";

// Hash de uma senha qualquer: comparado quando o e-mail não existe, para que a
// resposta demore o mesmo tempo e não revele quais e-mails estão cadastrados.
let hashFicticio: string | undefined;
const obterHashFicticio = () => (hashFicticio ??= bcrypt.hashSync("usuario-inexistente", 12));

export const POST = rota(async (req) => {
  const ip = ipDaRequisicao(req.headers);
  if (bloqueado(ip)) {
    throw new ErroHttp(429, "Muitas tentativas de login. Aguarde 15 minutos e tente novamente.");
  }

  const { email, senha } = await lerCorpo(req, esquemaLogin);
  const usuario = await prisma.usuario.findUnique({ where: { email } });
  const senhaConfere = await bcrypt.compare(senha, usuario?.senhaHash ?? obterHashFicticio());

  if (!usuario || !usuario.ativo || !senhaConfere) {
    registrarFalha(ip);
    throw new ErroHttp(401, "E-mail ou senha inválidos.");
  }
  limparFalhas(ip);

  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { ultimoAcesso: new Date() },
  });

  const res = NextResponse.json({
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
  });
  gravarCookieSessao(res, req, await criarToken(usuario.id));
  return res;
});
