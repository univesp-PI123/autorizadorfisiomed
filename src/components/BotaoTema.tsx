"use client";

import { useSyncExternalStore } from "react";
import { CHAVE_TEMA } from "@/lib/tema";
import Icone from "./Icone";

// O tema fica no atributo data-theme do <html> (tokens do Sóbrio) e é lembrado
// no navegador. Um script no <head> aplica a escolha antes de a página pintar.

function assinar(aoMudar: () => void) {
  const obs = new MutationObserver(aoMudar);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
const temaAtual = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export default function BotaoTema() {
  const tema = useSyncExternalStore(assinar, temaAtual, () => "light");
  const proximo = tema === "dark" ? "light" : "dark";

  const alternar = () => {
    document.documentElement.dataset.theme = proximo;
    try {
      localStorage.setItem(CHAVE_TEMA, proximo);
    } catch {
      // navegador sem armazenamento: vale só nesta visita
    }
  };

  return (
    <button
      type="button"
      className="sb-btn sb-btn--icon"
      onClick={alternar}
      aria-label={proximo === "dark" ? "Usar tema escuro" : "Usar tema claro"}
      title={proximo === "dark" ? "Tema escuro" : "Tema claro"}
    >
      <Icone nome={tema === "dark" ? "sol" : "lua"} />
    </button>
  );
}
