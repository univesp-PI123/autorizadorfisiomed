// Campos de usuário que a API pode devolver — nunca o hash da senha.
export const CAMPOS_PUBLICOS_USUARIO = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  ativo: true,
  ultimoAcesso: true,
  createdAt: true,
} as const;
