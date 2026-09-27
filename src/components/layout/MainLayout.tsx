"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import Icone from "@/components/Icone";
import { useSessao } from "@/contextos/SessaoContexto";
import { itemDaRota } from "@/lib/navegacao";
import Rail from "./Rail";
import Topbar from "./Topbar";

export default function MainLayout({ children }: { children: ReactNode }) {
  const { usuario } = useSessao();
  const pathname = usePathname();

  // Quem digitar o endereço de uma tela fora do seu perfil vê um aviso.
  // (A proteção de verdade está na API, que valida o perfil em cada rota.)
  const item = itemDaRota(pathname);
  const permitido = !item || item.perfis.includes(usuario.perfil);

  return (
    <div className="app">
      <Suspense>
        <Rail />
      </Suspense>
      <div className="main">
        <Topbar />
        <main id="conteudo" className="content" tabIndex={-1}>
          {permitido ? (
            children
          ) : (
            <div className="sb-card estado-central" role="alert">
              <Icone nome="cadeado" tamanho={24} />
              <h2 className="card-title">Acesso restrito</h2>
              <p className="texto-apoio">Seu perfil não tem acesso a esta tela.</p>
              <Link href="/dashboard" className="sb-btn">
                Voltar à visão geral
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
