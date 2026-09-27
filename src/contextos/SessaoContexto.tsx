"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { authService } from "@/lib/cliente/servicos";
import type { UsuarioLogado } from "@/lib/cliente/tipos";

type Sessao = { usuario: UsuarioLogado; sair: () => Promise<void> };

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
  return <SessaoContexto.Provider value={{ usuario, sair }}>{children}</SessaoContexto.Provider>;
}

export function useSessao() {
  const ctx = useContext(SessaoContexto);
  if (!ctx) throw new Error("useSessao deve ser usado dentro de SessaoProvider");
  return ctx;
}
