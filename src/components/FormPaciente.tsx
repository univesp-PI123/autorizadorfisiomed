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
    dataNascimento: p.dataNascimento,
    cpf: p.cpf ?? "",
    responsavel: p.responsavel ?? "",
    telefone: p.telefone ?? "",
    email: p.email ?? "",
    cid: p.cid ?? "",
    diagnostico: p.diagnostico ?? "",
    observacoes: p.observacoes ?? "",
  };
}

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
      <div className="grade-form">
        <div className="form-group inteira">
          <label className="form-label" htmlFor={`${id}-nome`}>
            Nome completo <span className="required">*</span>
          </label>
          <input id={`${id}-nome`} name="nome" type="text" className="form-control" value={form.nome} onChange={aoMudar} required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${id}-nasc`}>
            Data de nascimento <span className="required">*</span>
          </label>
          <input id={`${id}-nasc`} name="dataNascimento" type="date" className="form-control" value={form.dataNascimento} onChange={aoMudar} required />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${id}-cpf`}>
            CPF
          </label>
          <input id={`${id}-cpf`} name="cpf" type="text" inputMode="numeric" className="form-control" value={form.cpf} onChange={aoMudar} placeholder="000.000.000-00" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${id}-resp`}>
            Responsável
          </label>
          <input id={`${id}-resp`} name="responsavel" type="text" className="form-control" value={form.responsavel} onChange={aoMudar} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${id}-tel`}>
            Telefone
          </label>
          <input id={`${id}-tel`} name="telefone" type="tel" className="form-control" value={form.telefone} onChange={aoMudar} placeholder="(11) 99999-0000" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${id}-cid`}>
            CID-10
          </label>
          <input id={`${id}-cid`} name="cid" type="text" className="form-control" value={form.cid} onChange={aoMudar} placeholder="Ex.: F84.0" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor={`${id}-email`}>
            E-mail
          </label>
          <input id={`${id}-email`} name="email" type="email" className="form-control" value={form.email} onChange={aoMudar} />
        </div>
        <div className="form-group inteira">
          <label className="form-label" htmlFor={`${id}-diag`}>
            Diagnóstico
          </label>
          <textarea id={`${id}-diag`} name="diagnostico" className="form-control" value={form.diagnostico} onChange={aoMudar} rows={2} />
        </div>
        <div className="form-group inteira">
          <label className="form-label" htmlFor={`${id}-obs`}>
            Observações
          </label>
          <textarea id={`${id}-obs`} name="observacoes" className="form-control" value={form.observacoes} onChange={aoMudar} rows={2} />
        </div>
      </div>
    </form>
  );
}
