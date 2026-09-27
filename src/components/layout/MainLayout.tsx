"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useSessao } from "@/contextos/SessaoContexto";
import { itemDaRota } from "@/lib/navegacao";
import Header from "./Header";
import Sidebar from "./Sidebar";

export default function MainLayout({ children }: { children: ReactNode }) {
  const [sidebarAberta, setSidebarAberta] = useState(true);
  const { usuario } = useSessao();
  const pathname = usePathname();

  // Quem digitar o endereço de uma tela fora do seu perfil vê um aviso.
  // (A proteção de verdade está na API, que valida o perfil em cada rota.)
  const item = itemDaRota(pathname);
  const permitido = !item || item.perfis.includes(usuario.perfil);

  return (
    <div className={`main-layout ${sidebarAberta ? "sidebar-open" : "sidebar-closed"}`}>
      <Sidebar aberta={sidebarAberta} onFechar={() => setSidebarAberta(false)} />
      <div className="layout-content">
        <Header onAbrirSidebar={() => setSidebarAberta(true)} sidebarAberta={sidebarAberta} />
        <main id="main-content" className="layout-main" tabIndex={-1}>
          {permitido ? (
            children
          ) : (
            <div className="card vazio" role="alert">
              <p style={{ fontSize: "2rem" }} aria-hidden="true">
                🔒
              </p>
              <p>Seu perfil não tem acesso a esta tela.</p>
              <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: "16px" }}>
                Voltar ao Dashboard
              </Link>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
