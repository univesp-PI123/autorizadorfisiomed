"use client";

import { useEffect, useId, useRef, useState } from "react";
import { pacienteService } from "@/lib/cliente/servicos";
import type { PacienteBusca } from "@/lib/cliente/tipos";

const dataBR = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);

export function descreverPaciente(p: PacienteBusca) {
  return [
    p.cpf && `CPF ${p.cpf}`,
    dataBR(p.dataNascimento) && `nasc. ${dataBR(p.dataNascimento)}`,
    ...p.vinculos.map((v) => `${v.convenio.nome} ${v.numeroCarteirinha}`),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Campo único de busca de paciente — nome, CPF ou carteirinha — com a lista
 * de resultados (padrão combobox: setas, Enter e Esc).
 */
export default function BuscaPaciente({
  id,
  rotulo = "Paciente",
  obrigatorio,
  selecionado,
  aoSelecionar,
}: {
  id: string;
  rotulo?: string;
  obrigatorio?: boolean;
  selecionado: PacienteBusca | null;
  aoSelecionar: (p: PacienteBusca | null) => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<PacienteBusca[]>([]);
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(-1);
  const [buscando, setBuscando] = useState(false);
  const listaId = useId();
  const ajudaId = useId();
  const entrada = useRef<HTMLInputElement>(null);

  // Busca com pequena espera enquanto a pessoa digita.
  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) return;
    let valido = true;
    const espera = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await pacienteService.busca(t);
        if (valido) {
          setResultados(r);
          setAtivo(r.length ? 0 : -1);
          setAberto(true);
        }
      } finally {
        if (valido) setBuscando(false);
      }
    }, 250);
    return () => {
      valido = false;
      clearTimeout(espera);
    };
  }, [termo]);

  const escolher = (p: PacienteBusca) => {
    aoSelecionar(p);
    setTermo("");
    setResultados([]);
    setAberto(false);
  };

  if (selecionado) {
    return (
      <div className="sb-field">
        <span className="sb-label" id={`${id}-rotulo`}>
          {rotulo}
        </span>
        <div className="paciente-escolhido" aria-labelledby={`${id}-rotulo`}>
          <div>
            <strong>{selecionado.nome}</strong>
            <span className="texto-suave">{descreverPaciente(selecionado)}</span>
          </div>
          <button
            type="button"
            className="sb-btn sb-btn--sm"
            onClick={() => {
              aoSelecionar(null);
              setTimeout(() => entrada.current?.focus(), 0);
            }}
          >
            Trocar
          </button>
        </div>
      </div>
    );
  }

  const mostrarLista = aberto && termo.trim().length >= 2;
  return (
    <div className="sb-field busca-paciente">
      <label className="sb-label" htmlFor={id}>
        {rotulo}
        {obrigatorio && (
          <span className="obrigatorio" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="busca-paciente__campo">
        <input
          ref={entrada}
          id={id}
          className="sb-input"
          role="combobox"
          aria-expanded={mostrarLista}
          aria-controls={listaId}
          aria-autocomplete="list"
          aria-activedescendant={mostrarLista && ativo >= 0 ? `${listaId}-${ativo}` : undefined}
          aria-describedby={ajudaId}
          autoComplete="off"
          placeholder="Nome, CPF ou carteirinha"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            if (e.target.value.trim().length < 2) {
              setResultados([]);
              setAberto(false);
            }
          }}
          onFocus={() => resultados.length && setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAberto(true);
              setAtivo((a) => Math.min(a + 1, resultados.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtivo((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (mostrarLista && resultados[ativo]) escolher(resultados[ativo]);
            } else if (e.key === "Escape" && mostrarLista) {
              e.stopPropagation();
              setAberto(false);
            }
          }}
        />
        {mostrarLista && resultados.length > 0 && (
          <ul id={listaId} role="listbox" className="busca-paciente__lista">
            {resultados.map((p, i) => (
              <li
                key={p.id}
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={i === ativo}
                className="busca-paciente__item"
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(p);
                }}
                onMouseEnter={() => setAtivo(i)}
              >
                <strong>{p.nome}</strong>
                <span className="texto-suave">{descreverPaciente(p) || "sem CPF e sem carteirinha"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <span id={ajudaId} className="sb-help" aria-live="polite">
        {termo.trim().length < 2
          ? "Digite ao menos 2 letras ou 3 números."
          : buscando
            ? "Buscando…"
            : resultados.length
              ? `${resultados.length} paciente(s) encontrado(s)${resultados.length === 20 ? " — refine a busca para ver outros" : ""}.`
              : "Nenhum paciente encontrado."}
      </span>
    </div>
  );
}
