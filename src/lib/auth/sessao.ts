import type { PerfilUsuario } from "@prisma/client";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import { ErroHttp } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";

// A sessão é um JWT guardado num cookie httpOnly: o JavaScript da página não
// consegue lê-lo, o que protege o login contra roubo por XSS (o sistema antigo
// guardava o token no localStorage).

export const COOKIE_SESSAO = "sga_sessao";
const DURACAO_SEGUNDOS = 8 * 60 * 60; // 8 horas, como no sistema antigo

export type UsuarioSessao = {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
};

function chave() {
  const segredo = process.env.JWT_SECRET;
  if (!segredo || segredo.length < 32 || segredo.startsWith("troque")) {
    throw new Error(
      "JWT_SECRET ausente, curto demais (mínimo 32 caracteres) ou ainda com o valor de exemplo.",
    );
  }
  return new TextEncoder().encode(segredo);
}

export async function criarToken(usuarioId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(usuarioId)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SEGUNDOS}s`)
    .sign(chave());
}

export function gravarCookieSessao(res: NextResponse, req: NextRequest, token: string) {
  res.cookies.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    // Só marca "secure" quando o acesso é por HTTPS (o Nginx informa em
    // X-Forwarded-Proto). Assim o login funciona antes de instalar o certificado.
    secure: requisicaoHttps(req),
    path: "/",
    maxAge: DURACAO_SEGUNDOS,
  });
}

export function apagarCookieSessao(res: NextResponse) {
  res.cookies.set(COOKIE_SESSAO, "", { httpOnly: true, path: "/", maxAge: 0 });
}

function requisicaoHttps(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return proto.split(",")[0].trim() === "https";
}

/**
 * Valida o token e confere no banco se o usuário ainda existe e está ativo —
 * assim desativar um usuário ou trocar o perfil vale na hora, sem esperar o
 * token expirar.
 */
async function usuarioDoToken(token: string | undefined): Promise<UsuarioSessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { id: true, nome: true, email: true, perfil: true, ativo: true },
    });
    if (!usuario || !usuario.ativo) return null;
    return { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
  } catch {
    return null;
  }
}

/** Para route handlers: exige login e, opcionalmente, um dos perfis. */
export async function exigirSessao(
  req: NextRequest,
  perfis?: PerfilUsuario[],
): Promise<UsuarioSessao> {
  const usuario = await usuarioDoToken(req.cookies.get(COOKIE_SESSAO)?.value);
  if (!usuario) throw new ErroHttp(401, "Sessão expirada. Faça login novamente.");
  if (perfis && !perfis.includes(usuario.perfil)) {
    throw new ErroHttp(403, `Acesso negado. Perfis permitidos: ${perfis.join(", ")}.`);
  }
  return usuario;
}

/** Para páginas (server components): devolve o usuário logado ou null. */
export async function sessaoDaPagina(): Promise<UsuarioSessao | null> {
  const loja = await cookies();
  return usuarioDoToken(loja.get(COOKIE_SESSAO)?.value);
}
