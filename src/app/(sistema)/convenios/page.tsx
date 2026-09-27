"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import { useSessao } from "@/contextos/SessaoContexto";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { convenioService } from "@/lib/cliente/servicos";
import type { Convenio } from "@/lib/cliente/tipos";

const FORM_INICIAL = {
  nome: "",
  codigoAns: "",
  cnpj: "",
  contatoNome: "",
  contatoTelefone: "",
  contatoEmail: "",
  prazoAutorizacaoDias: "30",
  alertaAntecipacaoDias: "7",
  observacoes: "",
};

const formDoConvenio = (c: Convenio): typeof FORM_INICIAL => ({
  nome: c.nome,
  codigoAns: c.codigoAns ?? "",
  cnpj: c.cnpj ?? "",
  contatoNome: c.contatoNome ?? "",
  contatoTelefone: c.contatoTelefone ?? "",
  contatoEmail: c.contatoEmail ?? "",
  prazoAutorizacaoDias: String(c.prazoAutorizacaoDias),
  alertaAntecipacaoDias: String(c.alertaAntecipacaoDias),
  observacoes: c.observacoes ?? "",
});

// Campos simples do formulário: [nome do campo, rótulo, tipo]
const CAMPOS: [keyof typeof FORM_INICIAL, string, string][] = [
  ["codigoAns", "Código ANS", "text"],
  ["cnpj", "CNPJ", "text"],
  ["contatoNome", "Nome do contato", "text"],
  ["contatoTelefone", "Telefone", "tel"],
  ["contatoEmail", "E-mail", "email"],
];

export default function ConveniosPage() {
  const { usuario } = useSessao();
  const podeEditar = usuario.perfil === "admin" || usuario.perfil === "financeiro";
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Convenio | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);

  const { data: convenios, carregando, erro, recarregar } = useFetch(convenioService.listar);

  const aoMudar = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const abrir = (c: Convenio | null) => {
    setEditando(c);
    setForm(c ? formDoConvenio(c) : FORM_INICIAL);
    setModalAberto(true);
  };
  const fechar = () => {
    setModalAberto(false);
    setEditando(null);
    setForm(FORM_INICIAL);
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (editando) {
        await convenioService.atualizar(editando.id, form);
        toast.success("Convênio atualizado!");
      } else {
        await convenioService.criar(form);
        toast.success("Convênio cadastrado!");
      }
      fechar();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Erro ao salvar convênio."));
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <Carregando mensagem="Carregando convênios..." />;
  if (erro) return <MensagemErro mensagem={erro} onRetry={recarregar} />;

  return (
    <div>
      {podeEditar && (
        <div className="barra-acoes">
          <button className="btn btn-primary empurra" onClick={() => abrir(null)}>
            + Novo convênio
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
        {(convenios ?? []).length === 0 && <p className="texto-suave">Nenhum convênio cadastrado.</p>}
        {(convenios ?? []).map((c) => (
          <article key={c.id} className="card" aria-label={`Convênio ${c.nome}`}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
              <h3 style={{ fontWeight: 700, fontSize: "var(--font-size-base)" }}>{c.nome}</h3>
              {!c.ativo && <span className="badge badge-danger">Inativo</span>}
            </div>
            <dl className="dl-grade">
              <div>
                <dt>Cód. ANS</dt>
                <dd>{c.codigoAns || "—"}</dd>
              </div>
              <div>
                <dt>Prazo da autorização</dt>
                <dd>{c.prazoAutorizacaoDias} dias</dd>
              </div>
              <div>
                <dt>Alerta</dt>
                <dd>{c.alertaAntecipacaoDias} dias antes</dd>
              </div>
              <div>
                <dt>Contato</dt>
                <dd>{c.contatoTelefone || "—"}</dd>
              </div>
            </dl>
            {podeEditar && (
              <div style={{ marginTop: "16px" }}>
                <button className="btn btn-secondary btn-sm" onClick={() => abrir(c)} aria-label={`Editar ${c.nome}`}>
                  Editar
                </button>
              </div>
            )}
          </article>
        ))}
      </div>

      <Modal
        aberto={modalAberto}
        onFechar={fechar}
        titulo={editando ? "Editar convênio" : "Novo convênio"}
        tamanho="lg"
        rodape={
          <>
            <button className="btn btn-secondary" onClick={fechar}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="form-convenio" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        <form id="form-convenio" onSubmit={aoEnviar} noValidate>
          <div className="grade-form">
            <div className="form-group inteira">
              <label className="form-label" htmlFor="conv-nome">
                Nome <span className="required">*</span>
              </label>
              <input id="conv-nome" name="nome" type="text" className="form-control" value={form.nome} onChange={aoMudar} required />
            </div>
            {CAMPOS.map(([campo, rotulo, tipo]) => (
              <div className="form-group" key={campo}>
                <label className="form-label" htmlFor={`conv-${campo}`}>
                  {rotulo}
                </label>
                <input id={`conv-${campo}`} name={campo} type={tipo} className="form-control" value={form[campo]} onChange={aoMudar} />
              </div>
            ))}
            <div className="form-group">
              <label className="form-label" htmlFor="conv-prazo">
                Prazo da autorização (dias) <span className="required">*</span>
              </label>
              <input id="conv-prazo" name="prazoAutorizacaoDias" type="number" min="1" className="form-control" value={form.prazoAutorizacaoDias} onChange={aoMudar} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="conv-alerta">
                Alerta antecipado (dias) <span className="required">*</span>
              </label>
              <input id="conv-alerta" name="alertaAntecipacaoDias" type="number" min="1" className="form-control" value={form.alertaAntecipacaoDias} onChange={aoMudar} required />
            </div>
            <div className="form-group inteira">
              <label className="form-label" htmlFor="conv-obs">
                Observações
              </label>
              <textarea id="conv-obs" name="observacoes" className="form-control" value={form.observacoes} onChange={aoMudar} rows={2} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
