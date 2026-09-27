"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAlertas } from "@/contextos/AlertaContexto";
import { useSessao } from "@/contextos/SessaoContexto";
import { ITENS_MENU, ROTULO_PERFIL } from "@/lib/navegacao";

export default function Sidebar({ aberta, onFechar }: { aberta: boolean; onFechar: () => void }) {
  const { usuario, sair } = useSessao();
  const { totalAlertas } = useAlertas();
  const pathname = usePathname();

  const itens = ITENS_MENU.filter((item) => item.perfis.includes(usuario.perfil));

  // No celular o menu cobre a tela: fecha ao escolher uma opção.
  const aoNavegar = () => {
    if (window.matchMedia("(max-width: 768px)").matches) onFechar();
  };

  return (
    <>
      {aberta && <div className="sidebar-overlay" onClick={onFechar} aria-hidden="true" />}

      <nav
        className={`sidebar ${aberta ? "sidebar--open" : "sidebar--closed"}`}
        aria-label="Menu de navegação principal"
        inert={!aberta}
      >
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon" aria-hidden="true">
            🧩
          </span>
          <span className="sidebar-logo-text">Fisiomed ABA</span>
          <button className="header-menu-btn sidebar-fechar" onClick={onFechar} aria-label="Fechar menu">
            ✕
          </button>
        </div>

        <ul className="sidebar-nav">
          {itens.map((item) => {
            const ativo = pathname === item.caminho || pathname.startsWith(item.caminho + "/");
            return (
              <li key={item.caminho}>
                <Link
                  href={item.caminho}
                  className={`sidebar-link ${ativo ? "sidebar-link--active" : ""}`}
                  aria-current={ativo ? "page" : undefined}
                  onClick={aoNavegar}
                >
                  <span className="sidebar-link-icon" aria-hidden="true">
                    {item.icone}
                  </span>
                  <span className="sidebar-link-label">{item.rotulo}</span>
                  {item.caminho === "/autorizacoes" && totalAlertas > 0 && (
                    <span className="sidebar-badge" aria-label={`${totalAlertas} autorizações vencendo`}>
                      {totalAlertas}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" aria-hidden="true">
              {usuario.nome.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{usuario.nome}</span>
              <span className="sidebar-user-perfil">{ROTULO_PERFIL[usuario.perfil]}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm sidebar-logout" onClick={sair}>
            🚪 Sair
          </button>
        </div>
      </nav>
    </>
  );
}
