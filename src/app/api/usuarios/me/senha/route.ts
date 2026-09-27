import bcrypt from "bcryptjs";
import { ErroHttp, json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaAlterarSenha, lerCorpo } from "@/lib/validacao";

export const PATCH = rota(async (req) => {
  const sessao = await exigirSessao(req);
  const { senhaAtual, novaSenha } = await lerCorpo(req, esquemaAlterarSenha);

  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: sessao.id } });
  if (!(await bcrypt.compare(senhaAtual, usuario.senhaHash))) {
    // 400, e não 401: a sessão continua válida, só a senha informada está errada.
    throw new ErroHttp(400, "Senha atual incorreta.");
  }

  await prisma.usuario.update({
    where: { id: sessao.id },
    data: { senhaHash: await bcrypt.hash(novaSenha, 12) },
  });
  return json({ message: "Senha alterada com sucesso." });
});
