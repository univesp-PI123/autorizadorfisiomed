"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import toast from "react-hot-toast";
import Icone from "@/components/Icone";
import { lojaAcessibilidade, PADRAO, TAMANHOS_TEXTO, type Preferencias } from "@/lib/acessibilidade";

// Em telas estreitas a ampliação da interface é desligada pelo CSS
// (app.css, "Celular"); o mesmo limite de 640px vale aqui.
const TELA_ESTREITA = "(max-width: 640px)";
function assinarTela(aoMudar: () => void) {
  const mq = window.matchMedia(TELA_ESTREITA);
  mq.addEventListener("change", aoMudar);
  return () => mq.removeEventListener("change", aoMudar);
}
function useTelaEstreita() {
  return useSyncExternalStore(assinarTela, () => window.matchMedia(TELA_ESTREITA).matches, () => false);
}

export function usePreferencias() {
  return useSyncExternalStore(lojaAcessibilidade.assinar, lojaAcessibilidade.atual, lojaAcessibilidade.servidor);
}

const OPCOES: { campo: "contraste" | "links" | "movimento" | "libras"; rotulo: string; ajuda: string }[] = [
  { campo: "contraste", rotulo: "Alto contraste", ajuda: "Textos e bordas mais escuros." },
  { campo: "links", rotulo: "Sublinhar links", ajuda: "Destaca tudo que é clicável no texto." },
  { campo: "movimento", rotulo: "Reduzir animações", ajuda: "Desliga transições e movimentos." },
  { campo: "libras", rotulo: "Tradutor de Libras (VLibras)", ajuda: "Ferramenta do governo federal que traduz o texto para Libras." },
];

/** Botão + painel de acessibilidade (barra superior e tela de login). */
export default function BotaoAcessibilidade({ flutuante = false }: { flutuante?: boolean }) {
  const prefs = usePreferencias();
  const telaEstreita = useTelaEstreita();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const idPainel = useId();
  const idTexto = useId();

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAberto(false);
        raiz.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  const mudar = (parcial: Partial<Preferencias>) => lojaAcessibilidade.salvar({ ...prefs, ...parcial });
  const i = TAMANHOS_TEXTO.indexOf(prefs.texto);
  const alterado = JSON.stringify(prefs) !== JSON.stringify(PADRAO);

  return (
    <div className={`acess ${flutuante ? "acess--flutuante" : ""}`} ref={raiz}>
      <button
        type="button"
        className="sb-btn sb-btn--icon"
        aria-label="Acessibilidade"
        title="Acessibilidade"
        aria-expanded={aberto}
        aria-controls={idPainel}
        onClick={() => setAberto((a) => !a)}
      >
        <Icone nome="acessibilidade" />
      </button>
      {aberto && (
        <div className="sb-flyout__panel acess__painel" id={idPainel} role="dialog" aria-label="Opções de acessibilidade">
          <span className="sb-flyout__title">Acessibilidade</span>

          <div className="acess__grupo" role="group" aria-labelledby={idTexto}>
            <span id={idTexto} className="sb-label">
              Tamanho do texto
            </span>
            <div className="acess__texto">
              <button
                type="button"
                className="sb-btn"
                onClick={() => mudar({ texto: TAMANHOS_TEXTO[i - 1] })}
                disabled={telaEstreita || i <= 0}
                aria-label="Diminuir texto"
              >
                A−
              </button>
              <output className="mono" aria-live="polite">
                {telaEstreita ? 100 : prefs.texto}%
              </output>
              <button
                type="button"
                className="sb-btn"
                onClick={() => mudar({ texto: TAMANHOS_TEXTO[i + 1] })}
                disabled={telaEstreita || i >= TAMANHOS_TEXTO.length - 1}
                aria-label="Aumentar texto"
              >
                A+
              </button>
            </div>
            {telaEstreita && (
              <span className="sb-help">No celular, use o tamanho de fonte ou o zoom (movimento de pinça) do próprio aparelho.</span>
            )}
          </div>

          {OPCOES.map((o) => (
            <label key={o.campo} className="sb-check acess__opcao">
              <input type="checkbox" checked={prefs[o.campo]} onChange={(e) => mudar({ [o.campo]: e.target.checked })} />
              <span>
                <span className="acess__rotulo">{o.rotulo}</span>
                <span className="sb-help">{o.ajuda}</span>
              </span>
            </label>
          ))}

          <div className="acess__rodape">
            <button type="button" className="sb-btn sb-btn--ghost" onClick={() => lojaAcessibilidade.salvar(PADRAO)} disabled={!alterado}>
              Restaurar padrão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- VLibras ---------------------------------------------------------------

const URL_VLIBRAS = "https://vlibras.gov.br/app";
let scriptVLibras: Promise<void> | null = null;

function carregarVLibras() {
  scriptVLibras ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `${URL_VLIBRAS}/vlibras-plugin.js`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptVLibras = null;
      s.remove();
      reject(new Error("VLibras indisponível"));
    };
    document.body.appendChild(s);
  });
  return scriptVLibras;
}

type JanelaVLibras = Window & { VLibras?: { Widget: new (url: string) => unknown } };

/**
 * Widget do VLibras (governo federal). Só é carregado quando a pessoa ativa
 * a opção no painel de acessibilidade — o site não fala com o gov.br à toa.
 */
export function VLibras() {
  const { libras } = usePreferencias();

  useEffect(() => {
    if (!libras) return;
    let ativo = true;
    carregarVLibras()
      .then(() => {
        const w = window as JanelaVLibras;
        if (ativo && w.VLibras) new w.VLibras.Widget(URL_VLIBRAS);
      })
      .catch(() => {
        if (ativo) toast.error("Não foi possível carregar o VLibras. Verifique a conexão e tente de novo.");
      });
    return () => {
      ativo = false;
    };
  }, [libras]);

  if (!libras) return null;
  // Marcação exigida pelo widget (atributos vw* do manual do VLibras).
  const vw = { vw: "" } as Record<string, string>;
  const botao = { "vw-access-button": "" } as Record<string, string>;
  const embrulho = { "vw-plugin-wrapper": "" } as Record<string, string>;
  return (
    <div {...vw} className="enabled">
      <div {...botao} className="active" />
      <div {...embrulho}>
        <div className="vw-plugin-top-wrapper" />
      </div>
    </div>
  );
}
