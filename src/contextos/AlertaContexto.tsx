"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { autorizacaoService } from "@/lib/cliente/servicos";
import type { Autorizacao } from "@/lib/cliente/tipos";

type Alertas = { alertas: Autorizacao[]; totalAlertas: number; buscarAlertas: () => Promise<void> };

const AlertaContexto = createContext<Alertas | null>(null);

const INTERVALO_MS = 5 * 60 * 1000;

// Autorizações vencendo em 7 dias, atualizadas a cada 5 minutos.
export function AlertaProvider({ children }: { children: ReactNode }) {
  const [alertas, setAlertas] = useState<Autorizacao[]>([]);

  const buscarAlertas = useCallback(async () => {
    try {
      const res = await autorizacaoService.alertasVencimento(7);
      setAlertas(res.autorizacoes);
    } catch {
      // Silencioso: alerta indisponível não deve travar a tela.
    }
  }, []);

  useEffect(() => {
    const primeira = setTimeout(buscarAlertas, 0);
    const intervalo = setInterval(buscarAlertas, INTERVALO_MS);
    return () => {
      clearTimeout(primeira);
      clearInterval(intervalo);
    };
  }, [buscarAlertas]);

  return (
    <AlertaContexto.Provider value={{ alertas, totalAlertas: alertas.length, buscarAlertas }}>
      {children}
    </AlertaContexto.Provider>
  );
}

export function useAlertas() {
  const ctx = useContext(AlertaContexto);
  if (!ctx) throw new Error("useAlertas deve ser usado dentro de AlertaProvider");
  return ctx;
}
