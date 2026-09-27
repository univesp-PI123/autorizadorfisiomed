"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Icone from "@/components/Icone";
import { useAlertas } from "@/contextos/AlertaContexto";
import { AMBIENTES, ambienteDoHost } from "@/lib/ambientes";

const semAssinatura = () => () => {};

/**
 * Mostra o ambiente (tenant) em uso e permite trocar. O ponto indica a
 * conexão com o servidor (verde: ok; âmbar: sem resposta).
 */
export default function SeletorAmbiente() {
  const { conectado } = useAlertas();
  const [aberto, setAberto] = useState(false);
  const idMenu = useId();
  const raiz = useRef<HTMLDivElement>(null);
  const host = useSyncExternalStore(semAssinatura, () => window.location.hostname, () => "");
  const atual = ambienteDoHost(host);

  // Fecha ao clicar fora ou apertar Esc.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        raiz.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const trocar = (dominio: string) => {
    if (dominio === atual.dominio) return setAberto(false);
    window.location.assign(`https://${dominio}`);
  };

  return (
    <div className="ambiente" ref={raiz}>
      <button
        type="button"
        className="sb-btn ambiente__botao"
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={idMenu}
        onClick={() => setAberto((a) => !a)}
        title={conectado ? "Conectado ao servidor" : "Sem conexão com o servidor"}
      >
        <span className={`sb-status ${conectado ? "" : "sb-status--off"}`}>
          <span className="sr-only">{conectado ? "Conectado." : "Sem conexão."} Ambiente: </span>
          <span className="mono">{atual.dominio}</span>
        </span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {aberto && (
        <div className="sb-flyout__panel ambiente__menu" id={idMenu} role="menu" aria-label="Trocar de ambiente">
          <span className="sb-flyout__title">Ambiente</span>
          {AMBIENTES.map((a) => {
            const ehAtual = a.dominio === atual.dominio;
            return (
              <button
                key={a.id}
                type="button"
                role="menuitemradio"
                aria-checked={ehAtual}
                className="sb-flyout__link ambiente__item"
                onClick={() => trocar(a.dominio)}
              >
                <span className="ambiente__textos">
                  <span>{a.nome}</span>
                  <span className="texto-suave mono">{a.dominio}</span>
                </span>
                {ehAtual && <Icone nome="check" />}
              </button>
            );
          })}
          <p className="texto-suave ambiente__rodape">
            {conectado ? "Conectado ao servidor." : "Sem conexão com o servidor. Tentando novamente…"}
          </p>
        </div>
      )}
    </div>
  );
}
