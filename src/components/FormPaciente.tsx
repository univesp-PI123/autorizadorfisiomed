"use client";

import type { ChangeEvent, FormEvent } from "react";
import type { Paciente } from "@/lib/cliente/tipos";

export const FORM_PACIENTE_VAZIO = {
  nome: "",
  dataNascimento: "",
  cpf: "",
  responsavel: "",
  telefone: "",
  email: "",
  cid: "",
  diagnostico: "",
  observacoes: "",
};

export type DadosFormPaciente = typeof FORM_PACIENTE_VAZIO;

/** Preenche o formulário com os dados de um paciente existente (edição). */
export function formDoPaciente(p: Paciente): DadosFormPaciente {
  return {
    nome: p.nome,
    dataNascimento: p.dataNascimento ?? "",
    cpf: p.cpf ?? "",
    responsavel: p.responsavel ?? "",
    telefone: p.telefone ?? "",
    email: p.email ?? "",
    cid: p.cid ?? "",
    diagnostico: p.diagnostico ?? "",
    observacoes: p.observacoes ?? "",
  };
}

type Campo = {
  nome: keyof DadosFormPaciente;
  rotulo: string;
  tipo?: string;
  obrigatorio?: boolean;
  exemplo?: string;
  inteira?: boolean;
  area?: boolean;
  inputMode?: "numeric" | "tel" | "email";
};

const CAMPOS: Campo[] = [
  { nome: "nome", rotulo: "Nome completo", obrigatorio: true, inteira: true },
  { nome: "dataNascimento", rotulo: "Data de nascimento", tipo: "date", obrigatorio: true },
  { nome: "cpf", rotulo: "CPF", exemplo: "000.000.000-00", inputMode: "numeric" },
  { nome: "responsavel", rotulo: "Responsável" },
  { nome: "telefone", rotulo: "Telefone", tipo: "tel", exemplo: "(11) 99999-0000" },
  { nome: "email", rotulo: "E-mail", tipo: "email", exemplo: "nome@email.com" },
  { nome: "cid", rotulo: "CID-10", exemplo: "F84.0" },
  { nome: "diagnostico", rotulo: "Diagnóstico", inteira: true, area: true },
  { nome: "observacoes", rotulo: "Observações", inteira: true, area: true },
];

export default function FormPaciente({
  id,
  form,
  aoMudar,
  aoEnviar,
}: {
  id: string;
  form: DadosFormPaciente;
  aoMudar: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  aoEnviar: (e: FormEvent) => void;
}) {
  return (
    <form id={id} onSubmit={aoEnviar} noValidate>
      <div className="form-grade">
        {CAMPOS.map((c) => (
          <div className={`sb-field ${c.inteira ? "inteira" : ""}`} key={c.nome}>
            <label className="sb-label" htmlFor={`${id}-${c.nome}`}>
              {c.rotulo}
              {c.obrigatorio && (
                <span className="obrigatorio" aria-hidden="true">
                  *
                </span>
              )}
            </label>
            {c.area ? (
              <textarea id={`${id}-${c.nome}`} name={c.nome} className="sb-input" rows={2} value={form[c.nome]} onChange={aoMudar} />
            ) : (
              <input
                id={`${id}-${c.nome}`}
                name={c.nome}
                type={c.tipo ?? "text"}
                inputMode={c.inputMode}
                className="sb-input"
                placeholder={c.exemplo}
                value={form[c.nome]}
                onChange={aoMudar}
                required={c.obrigatorio}
              />
            )}
          </div>
        ))}
      </div>
    </form>
  );
}
