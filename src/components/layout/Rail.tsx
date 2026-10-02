"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import Icone from "@/components/Icone";
import { LogoMenu } from "@/components/Marca";
import { useAlertas } from "@/contextos/AlertaContexto";
import { useSessao } from "@/contextos/SessaoContexto";
import { ITENS_MENU } from "@/lib/navegacao";

const semInscricao = () => () => {};

// Barra lateral do Sóbrio: recolhida por padrão (só ícones), botão redondo
// para expandir e popup com as sub-opções ao passar o mouse ou focar.
export default function Rail() {
  const { usuario } = useSessao();
  const { totalAlertas } = useAlertas();
  const pathname = usePathname();
  const busca = useSearchParams().toString();
  const [aberta, setAberta] = useState(false);
  // O contador de alertas chega depois (busca no navegador): só aparece com a
  // barra já hidratada, para não divergir do HTML que veio do servidor.
  const montada = useSyncExternalStore(semInscricao, () => true, () => false);

  const itens = ITENS_MENU.filter((i) => i.perfis.includes(usuario.perfil));
  const grupos = [...new Set(itens.map((i) => i.grupo))];
  const atual = pathname + (busca ? `?${busca}` : "");

  // O popup abre no hover e também no foco (teclado). Depois de um clique com
  // o mouse o link ficaria focado e o popup aberto; por isso solta o foco.
  const soltarFoco = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (e.detail > 0) e.currentTarget.blur();
  };

  return (
    <aside className={`sb-rail ${aberta ? "sb-rail--open" : ""}`}>
      <Link href="/dashboard" className="sb-rail__brand" aria-label="Fisiomed ABA — Visão geral">
        <LogoMenu />
      </Link>
      <button
        type="button"
        className="sb-rail__toggle"
        onClick={() => setAberta((a) => !a)}
        aria-label={aberta ? "Recolher menu" : "Expandir menu"}
        aria-expanded={aberta}
      >
        <Icone nome="seta" />
      </button>

      <nav className="sb-rail__nav" aria-label="Principal">
        {grupos.map((grupo) => (
          <div key={grupo} style={{ display: "contents" }}>
            <span className="sb-rail__group">{grupo}</span>
            {itens
              .filter((i) => i.grupo === grupo)
              .map((item) => {
                const ativo = pathname === item.caminho || pathname.startsWith(item.caminho + "/");
                const subitens = item.subitens.filter((s) => !s.perfis || s.perfis.includes(usuario.perfil));
                return (
                  <div className="sb-nav-item" key={item.caminho}>
                    <Link
                      className="sb-nav-link"
                      href={item.caminho}
                      aria-current={ativo ? "page" : undefined}
                      onClick={soltarFoco}
                    >
                      <Icone nome={item.icone} />
                      <span className="sb-nav-text">{item.rotulo}</span>
                      {montada && item.caminho === "/autorizacoes" && totalAlertas > 0 && (
                        <span className="sb-rail__contador" aria-label={`${totalAlertas} vencendo em 7 dias`}>
                          {totalAlertas}
                        </span>
                      )}
                    </Link>
                    <div className="sb-flyout">
                      <div className="sb-flyout__panel" role="menu" aria-label={item.rotulo}>
                        <span className="sb-flyout__title">{item.rotulo}</span>
                        {subitens.map((s) => (
                          <Link
                            key={s.href}
                            className="sb-flyout__link"
                            role="menuitem"
                            href={s.href}
                            aria-current={s.href === atual ? "page" : undefined}
                            onClick={soltarFoco}
                          >
                            {s.rotulo}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
