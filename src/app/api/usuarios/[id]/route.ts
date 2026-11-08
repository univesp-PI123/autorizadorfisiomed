import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirAdmin } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { CAMPOS_PUBLICOS_USUARIO } from "@/lib/usuarios";
import { esquemaUsuarioEdicao, lerCorpo } from "@/lib/validacao";

// Só administradores editam usuários, e a senha não muda por aqui (cada um
// troca a própria em /api/usuarios/me/senha). No sistema antigo qualquer
// usuário logado conseguia trocar a senha de qualquer outro por esta rota.
export const PUT = rota<{ id: string }>(async (req, { params }) => {
  const admin = await exigirAdmin(req);
  const { id } = await params;
  const dados = await lerCorpo(req, esquemaUsuarioEdicao);

  const atual = await prisma.usuario.findUnique({ where: { id }, select: { perfil: true, ativo: true } });
  if (!atual) naoEncontrado("Usuário");

  // Evita que o sistema fique sem nenhum administrador por engano.
  if (id === admin.id && dados.ativo === false) {
    throw new ErroHttp(422, "Você não pode desativar a sua própria conta.");
  }
  if (id === admin.id && dados.perfil && dados.perfil !== "admin") {
    throw new ErroHttp(422, "Você não pode tirar o seu próprio perfil de administrador.");
  }
  const deixaDeSerAdmin = atual.perfil === "admin" && atual.ativo && (dados.ativo === false || (dados.perfil && dados.perfil !== "admin"));
  if (deixaDeSerAdmin && (await prisma.usuario.count({ where: { perfil: "admin", ativo: true } })) <= 1) {
    throw new ErroHttp(422, "O sistema precisa de pelo menos um administrador ativo.");
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
