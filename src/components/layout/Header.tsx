"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAlertas } from "@/contextos/AlertaContexto";
import { itemDaRota } from "@/lib/navegacao";

export default function Header({
  onAbrirSidebar,
  sidebarAberta,
}: {
  onAbrirSidebar: () => void;
  sidebarAberta: boolean;
}) {
  const pathname = usePathname();
  const { totalAlertas } = useAlertas();
  const titulo = itemDaRota(pathname)?.rotulo ?? "Fisiomed ABA";

  return (
    <header className="header">
      {!sidebarAberta && (
        <button
          className="header-menu-btn"
          onClick={onAbrirSidebar}
          aria-label="Abrir menu de navegação"
          aria-expanded={sidebarAberta}
        >
          ☰
        </button>
      )}

      <h1 className="header-title">{titulo}</h1>

      <div className="header-actions">
        {totalAlertas > 0 && (
          <Link
            href="/autorizacoes?vencendoEm=7"
            className="header-alerta"
            aria-label={`${totalAlertas} autorizações vencendo nos próximos 7 dias`}
          >
            <span aria-hidden="true">⚠️</span>
            <span>{totalAlertas} vencendo</span>
          </Link>
        )}
      </div>
    </header>
  );
}
