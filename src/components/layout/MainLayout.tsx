"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { abaDaRota, itemDaRota } from "@/lib/navegacao";
import Rail from "./Rail";
import Topbar from "./Topbar";

export default function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const item = itemDaRota(pathname);
  const abaAtual = abaDaRota(item, pathname);

  return (
    <div className="app">
      <Suspense>
        <Rail />
      </Suspense>
      <div className="main">
        <Topbar />
        <main id="conteudo" className="content" tabIndex={-1}>
          {/* Telas que dividem um item do menu (ex.: Cadastros) ganham abas. */}
          {item?.abas && abaAtual && (
            <nav className="abas abas--secao" aria-label={item.rotulo}>
              {item.abas.map((a) => (
                <Link key={a.caminho} href={a.caminho} className="aba" aria-current={a === abaAtual ? "page" : undefined}>
                  {a.rotulo}
                </Link>
              ))}
            </nav>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
