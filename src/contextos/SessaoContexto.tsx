"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { authService } from "@/lib/cliente/servicos";
import type { UsuarioLogado } from "@/lib/cliente/tipos";

// ehAdmin: o administrador edita cadastros, gerencia usuários e baixa os XMLs
// da operadora; o atendente só consulta os cadastros. Quem decide é a API
// (exigirAdmin); a tela só esconde o que o perfil não pode usar.
type Sessao = { usuario: UsuarioLogado; ehAdmin: boolean; sair: () => Promise<void> };

const SessaoContexto = createContext<Sessao | null>(null);

// O usuário vem do servidor (layout), que já validou o cookie de sessão.
export function SessaoProvider({ usuario, children }: { usuario: UsuarioLogado; children: ReactNode }) {
  const router = useRouter();
  const sair = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }, [router]);
  return <SessaoContexto.Provider value={{ usuario, ehAdmin: usuario.perfil === "admin", sair }}>{children}</SessaoContexto.Provider>;
}

export function useSessao() {
  const ctx = useContext(SessaoContexto);
  if (!ctx) throw new Error("useSessao deve ser usado dentro de SessaoProvider");
  return ctx;
}
