import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { CAMPOS_PUBLICOS_USUARIO } from "@/lib/usuarios";
import { esquemaUsuarioEdicao, lerCorpo } from "@/lib/validacao";

// Só administradores editam usuários, e a senha não muda por aqui (cada um
// troca a própria em /api/usuarios/me/senha). No sistema antigo qualquer
// usuário logado conseguia trocar a senha de qualquer outro por esta rota.
export const PUT = rota<{ id: string }>(async (req, { params }) => {
  const admin = await exigirSessao(req);
  const { id } = await params;
  const dados = await lerCorpo(req, esquemaUsuarioEdicao);

  if (!(await prisma.usuario.findUnique({ where: { id } }))) naoEncontrado("Usuário");

  // Evita que o sistema fique sem nenhum administrador por engano.
  if (id === admin.id && dados.ativo === false) {
    throw new ErroHttp(422, "Você não pode desativar a sua própria conta.");
  }
  if (dados.email) {
    const outro = await prisma.usuario.findUnique({ where: { email: dados.email } });
    if (outro && outro.id !== id) throw new ErroHttp(409, "E-mail já cadastrado.");
  }

  const usuario = await prisma.usuario.update({
    where: { id },
    data: dados,
    select: CAMPOS_PUBLICOS_USUARIO,
  });
  return json(usuario);
});
