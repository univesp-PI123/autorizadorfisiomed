"use client";

import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import { Badge } from "@/components/ui/StatusBadge";
import { useSessao } from "@/contextos/SessaoContexto";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { procedimentoService } from "@/lib/cliente/servicos";
import type { Procedimento } from "@/lib/cliente/tipos";

export default function ProcedimentosPage() {
  const { usuario } = useSessao();
  const podeEditar = usuario.perfil === "admin" || usuario.perfil === "recepcionista";
  const { data, carregando, erro, recarregar } = useFetch(procedimentoService.listar);
  const [editando, setEditando] = useState<Procedimento | null>(null);
  const [form, setForm] = useState({ descricao: "", codigoTuss: "", tabelaTuss: "", ativo: true });
  const [salvando, setSalvando] = useState(false);

  const abrir = (p: Procedimento) => {
    setEditando(p);
    setForm({ descricao: p.descricao, codigoTuss: p.codigoTuss ?? "", tabelaTuss: p.tabelaTuss ?? "22", ativo: p.ativo });
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    setSalvando(true);
    try {
      await procedimentoService.atualizar(editando.id, form);
      toast.success("Procedimento atualizado.");
      setEditando(null);
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  };

  const semTuss = (data ?? []).filter((p) => p.ativo && !p.codigoTuss).length;

  return (
    <>
      <section className="sb-card">
        <div className="sb-card__header">
          <h2 className="sb-card__title">Procedimentos do AnClinic</h2>
          {semTuss > 0 && <Badge tom="warning">{semTuss} sem código TUSS</Badge>}
        </div>
        <div className="sb-card__body">
          <p className="texto-apoio">
            Os códigos do AnClinic (4440, 4415…) são internos. Para a guia, cada procedimento precisa do código TUSS usado com a
            operadora — o mesmo digitado hoje no portal. A lista é criada pela importação da agenda.
          </p>
        </div>
        {carregando ? (
          <Carregando />
        ) : erro ? (
          <div className="sb-card__body">
            <MensagemErro mensagem={erro} onRetry={recarregar} />
          </div>
        ) : (
          <div className="tabela-rolagem">
            <table className="sb-table">
              <thead>
                <tr>
                  <th scope="col">Código AnClinic</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">Código TUSS</th>
                  <th scope="col">Tabela</th>
                  <th scope="col" className="sb-end">
                    Sessões importadas
                  </th>
                  {podeEditar && (
                    <th scope="col" className="sb-end">
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="vazio">
                      Nenhum procedimento ainda. Importe uma agenda do AnClinic.
                    </td>
                  </tr>
                ) : (
                  data!.map((p) => (
                    <tr key={p.id}>
                      <td className="sb-mono">{p.codigoAnclinic}</td>
                      <td className="sb-strong">
                        {p.descricao} {!p.ativo && <Badge>Inativo</Badge>}
                      </td>
                      <td className="sb-mono">{p.codigoTuss ?? <Badge tom="warning">Falta</Badge>}</td>
                      <td className="sb-mono">{p.tabelaTuss ?? "—"}</td>
                      <td className="sb-mono sb-end">{p._count?.agendamentos ?? 0}</td>
                      {podeEditar && (
                        <td className="sb-end">
                          <button type="button" className="sb-btn sb-btn--sm" onClick={() => abrir(p)} aria-label={`Editar ${p.descricao}`}>
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
        aberto={!!editando}
        onFechar={() => setEditando(null)}
        titulo={editando ? `Procedimento ${editando.codigoAnclinic}` : ""}
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={() => setEditando(null)}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-procedimento" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        <form id="form-procedimento" onSubmit={aoEnviar} noValidate className="pilha">
          <div className="sb-field">
            <label className="sb-label" htmlFor="proc-descricao">
              Descrição
            </label>
            <input id="proc-descricao" className="sb-input" value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} required />
          </div>
          <div className="form-grade">
            <div className="sb-field">
              <label className="sb-label" htmlFor="proc-tuss">
                Código TUSS
              </label>
              <input
                id="proc-tuss"
                inputMode="numeric"
                className="sb-input mono"
                value={form.codigoTuss}
                onChange={(e) => setForm((f) => ({ ...f, codigoTuss: e.target.value }))}
                aria-describedby="proc-tuss-ajuda"
              />
              <span id="proc-tuss-ajuda" className="sb-help">
                8 dígitos (ex.: 50000470).
              </span>
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="proc-tabela">
                Tabela
              </label>
              <select id="proc-tabela" className="sb-input" value={form.tabelaTuss} onChange={(e) => setForm((f) => ({ ...f, tabelaTuss: e.target.value }))}>
                <option value="22">22 — Procedimentos e eventos (TUSS)</option>
                <option value="98">98 — Tabela própria de pacotes</option>
                <option value="00">00 — Tabela própria da operadora</option>
              </select>
            </div>
          </div>
          <label className="sb-check">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
            Ativo
          </label>
        </form>
      </Modal>
    </>
  );
}
