"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

const TAMANHOS = { sm: "400px", md: "560px", lg: "720px", xl: "900px" };

/**
 * Modal acessível (WCAG 2.1): role="dialog", aria-modal, título associado,
 * foco preso dentro do modal, fecha com Esc e devolve o foco ao sair.
 */
export default function Modal({
  aberto,
  onFechar,
  titulo,
  children,
  rodape,
  tamanho = "md",
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  children: ReactNode;
  rodape?: ReactNode;
  tamanho?: keyof typeof TAMANHOS;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const fecharRef = useRef(onFechar);
  useEffect(() => {
    fecharRef.current = onFechar;
  });

  useEffect(() => {
    if (!aberto) return;
    const focoAnterior = document.activeElement as HTMLElement | null;
    const timeout = setTimeout(() => modalRef.current?.focus(), 50);

    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecharRef.current();
      if (e.key === "Tab" && modalRef.current) {
        const focaveis = modalRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focaveis.length === 0) return;
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };

    document.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
      focoAnterior?.focus();
    };
  }, [aberto]);

  if (!aberto) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onFechar();
      }}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
        style={{ maxWidth: TAMANHOS[tamanho] }}
      >
        <div className="modal-header">
          <h2 id={idTitulo} className="modal-title">
            {titulo}
          </h2>
          <button className="btn btn-secondary btn-sm" onClick={onFechar} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {rodape && <div className="modal-footer">{rodape}</div>}
      </div>
    </div>
  );
}
