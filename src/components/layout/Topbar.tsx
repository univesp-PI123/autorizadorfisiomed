"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import BotaoAcessibilidade from "@/components/Acessibilidade";
import BotaoTema from "@/components/BotaoTema";
import Icone from "@/components/Icone";
import { useAlertas } from "@/contextos/AlertaContexto";
import { useSessao } from "@/contextos/SessaoContexto";
import { itemDaRota, ROTULO_PERFIL } from "@/lib/navegacao";

// Títulos das páginas de detalhe (o menu só conhece as raízes).
function tituloDaPagina(pathname: string, rotuloRaiz: string) {
  if (/^\/pacientes\/[^/]+$/.test(pathname)) return "Paciente";
  if (/^\/autorizacoes\/[^/]+$/.test(pathname)) return "Autorização";
  return rotuloRaiz;
}

export default function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { usuario, sair } = useSessao();
  const { totalAlertas } = useAlertas();
  const [busca, setBusca] = useState("");

  const item = itemDaRota(pathname);
  const titulo = tituloDaPagina(pathname, item?.rotulo ?? "Fisiomed ABA");
  const podeBuscarPacientes = ["admin", "recepcionista", "terapeuta"].includes(usuario.perfil);

  const aoBuscar = (e: FormEvent) => {
    e.preventDefault();
    const termo = busca.trim();
    router.push(termo ? `/pacientes?busca=${encodeURIComponent(termo)}` : "/pacientes");
    setBusca("");
  };

  return (
    <header className="topbar">
      <div className="topbar__title">
        <nav className="caption" aria-label="Você está em">
          {item?.grupo ?? "Geral"} / {item && titulo !== item.rotulo ? (
            <>
              <Link href={item.caminho}>{item.rotulo}</Link> / {titulo}
            </>
          ) : (
            titulo
          )}
        </nav>
        <h1 className="page-title">{titulo}</h1>
      </div>

      {podeBuscarPacientes && (
        <form className="busca" role="search" onSubmit={aoBuscar}>
          <input
            className="sb-input sb-input--sm"
            type="search"
            placeholder="Buscar paciente por nome ou CPF…"
            aria-label="Buscar paciente por nome ou CPF"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ width: 260 }}
          />
        </form>
      )}

      <div className="topbar__acoes">
        {totalAlertas > 0 && (
          <Link href="/autorizacoes?vencendoEm=7" className="sb-badge sb-badge--warning" title="Autorizações vencendo em 7 dias">
            {totalAlertas} vencendo
          </Link>
        )}
        <div className="topbar__usuario">
          <strong>{usuario.nome}</strong>
          <span>{ROTULO_PERFIL[usuario.perfil]}</span>
        </div>
        <BotaoAcessibilidade />
        <BotaoTema />
        <button type="button" className="sb-btn sb-btn--icon" onClick={sair} aria-label="Sair" title="Sair">
          <Icone nome="sair" />
        </button>
      </div>
    </header>
  );
}
