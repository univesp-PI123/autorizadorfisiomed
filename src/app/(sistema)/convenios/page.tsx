"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import { comUrl, tirarNovoDaUrl } from "@/components/ComUrl";
import Icone from "@/components/Icone";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import { Badge } from "@/components/ui/StatusBadge";
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
type FormConvenio = typeof FORM_INICIAL;

const formDoConvenio = (c: Convenio): FormConvenio => ({
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

// [campo, rótulo, tipo, obrigatório, ocupa a linha inteira]
const CAMPOS: [keyof FormConvenio, string, string, boolean?, boolean?][] = [
  ["nome", "Nome", "text", true, true],
  ["codigoAns", "Código ANS", "text"],
  ["cnpj", "CNPJ", "text"],
  ["contatoNome", "Nome do contato", "text"],
  ["contatoTelefone", "Telefone", "tel"],
  ["contatoEmail", "E-mail", "email", false, true],
  ["prazoAutorizacaoDias", "Prazo da autorização (dias)", "number", true],
  ["alertaAntecipacaoDias", "Alertar com antecedência (dias)", "number", true],
];

function ConveniosPage({ url }: { url: URLSearchParams }) {
  const { usuario } = useSessao();
  const podeEditar = usuario.perfil === "admin" || usuario.perfil === "financeiro";
  const [editando, setEditando] = useState<Convenio | null>(null);
  const [modalAberto, setModalAberto] = useState(podeEditar && url.get("novo") === "1");
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
    tirarNovoDaUrl();
    setEditando(null);
    setForm(FORM_INICIAL);
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (editando) await convenioService.atualizar(editando.id, form);
      else await convenioService.criar(form);
      toast.success(editando ? "Convênio atualizado." : "Convênio cadastrado.");
      fechar();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível salvar o convênio."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <section className="sb-card">
        <div className="sb-card__header">
          <h2 className="sb-card__title">Convênios</h2>
          {podeEditar && (
            <button type="button" className="sb-btn sb-btn--primary" onClick={() => abrir(null)}>
              <Icone nome="mais" />
              Novo convênio
            </button>
          )}
        </div>
        {carregando ? (
          <Carregando mensagem="Carregando convênios…" />
        ) : erro ? (
          <div className="sb-card__body">
            <MensagemErro mensagem={erro} onRetry={recarregar} />
          </div>
        ) : (
          <div className="tabela-rolagem">
            <table className="sb-table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Código ANS</th>
                  <th scope="col">Contato</th>
                  <th scope="col" className="sb-end">
                    Prazo
                  </th>
                  <th scope="col" className="sb-end">
                    Alerta
                  </th>
                  <th scope="col">Situação</th>
                  {podeEditar && (
                    <th scope="col" className="sb-end">
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(convenios ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={podeEditar ? 7 : 6} className="vazio">
                      Nenhum convênio cadastrado.
                    </td>
                  </tr>
                ) : (
                  convenios!.map((c) => (
                    <tr key={c.id}>
                      <td className="sb-strong">{c.nome}</td>
                      <td className="sb-mono">{c.codigoAns || "—"}</td>
                      <td>
                        {c.contatoNome || "—"}
                        {c.contatoTelefone && <span className="texto-suave mono"> · {c.contatoTelefone}</span>}
                      </td>
                      <td className="sb-mono sb-end">{c.prazoAutorizacaoDias} d</td>
                      <td className="sb-mono sb-end">{c.alertaAntecipacaoDias} d antes</td>
                      <td>{c.ativo ? <Badge tom="success">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                      {podeEditar && (
                        <td className="sb-end">
                          <button type="button" className="sb-btn sb-btn--sm" onClick={() => abrir(c)} aria-label={`Editar ${c.nome}`}>
                            Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        aberto={modalAberto}
        onFechar={fechar}
        titulo={editando ? "Editar convênio" : "Novo convênio"}
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={fechar}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-convenio" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        <form id="form-convenio" onSubmit={aoEnviar} noValidate>
          <div className="form-grade">
            {CAMPOS.map(([campo, rotulo, tipo, obrigatorio, inteira]) => (
              <div className={`sb-field ${inteira ? "inteira" : ""}`} key={campo}>
                <label className="sb-label" htmlFor={`conv-${campo}`}>
                  {rotulo}
                  {obrigatorio && (
                    <span className="obrigatorio" aria-hidden="true">
                      *
                    </span>
                  )}
                </label>
                <input
                  id={`conv-${campo}`}
                  name={campo}
                  type={tipo}
                  min={tipo === "number" ? 1 : undefined}
                  className="sb-input"
                  value={form[campo]}
                  onChange={aoMudar}
                  required={obrigatorio}
                />
              </div>
            ))}
            <div className="sb-field inteira">
              <label className="sb-label" htmlFor="conv-observacoes">
                Observações
              </label>
              <textarea id="conv-observacoes" name="observacoes" className="sb-input" rows={2} value={form.observacoes} onChange={aoMudar} />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default comUrl(ConveniosPage);
