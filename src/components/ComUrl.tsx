"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ComponentType } from "react";
import Carregando from "@/components/ui/Carregando";

/**
 * Envolve uma tela cujos filtros iniciais vêm da URL (links do menu, do
 * dashboard e dos alertas). A chave recria a tela quando a URL muda estando
 * nela — assim um novo link sempre aplica os filtros dele.
 */
export function comUrl(Tela: ComponentType<{ url: URLSearchParams }>) {
  function ComParametros() {
    const url = useSearchParams();
    return <Tela key={url.toString()} url={url} />;
  }
  return function PaginaComUrl() {
    return (
      <Suspense fallback={<Carregando />}>
        <ComParametros />
      </Suspense>
    );
  };
}

/**
 * Tira o "?novo=1" (ou outro parâmetro, como "?importar=1") do endereço ao
 * fechar um formulário aberto por link, para que recarregar a página não o
 * abra de novo.
 */
export function tirarNovoDaUrl(parametro = "novo") {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(parametro)) return;
  url.searchParams.delete(parametro);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}
