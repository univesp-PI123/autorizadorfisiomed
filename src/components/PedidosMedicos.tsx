"use client";

import { useCallback, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Icone from "@/components/Icone";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import { Badge } from "@/components/ui/StatusBadge";
import { formatarData } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { pedidoMedicoService } from "@/lib/cliente/servicos";
import type { Convenio, PedidoMedico } from "@/lib/cliente/tipos";
import { hojeISO } from "@/lib/datas";
import { SIGLAS_CONSELHO, UFS } from "@/lib/tiss/dominios";

const tamanho = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function vigente(p: PedidoMedico, hoje: string) {
  return p.ativo && p.dataPedido <= hoje && (!p.validoAte || p.validoAte >= hoje);
}

/** Pedidos médicos do paciente: dados do médico solicitante e os PDFs anexados à solicitação. */
export default function PedidosMedicos({
  pacienteId,
  convenios,
  podeEditar,
}: {
  pacienteId: string;
  convenios: Convenio[];
  podeEditar: boolean;
}) {
  const buscar = useCallback(() => pedidoMedicoService.listar(pacienteId), [pacienteId]);
  const { data, carregando, erro, recarregar } = useFetch(buscar);
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const hoje = hojeISO();

  const aoEnviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (!form.getAll("arquivos").some((a) => a instanceof File && a.size > 0)) {
      toast.error("Anexe o PDF do pedido médico.");
      return;
    }
    setSalvando(true);
    try {
      await pedidoMedicoService.criar(pacienteId, form);
      toast.success("Pedido médico cadastrado.");
      setAberto(false);
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível salvar o pedido."));
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (p: PedidoMedico) => {
    if (p.ativo && !window.confirm("Desativar este pedido? Ele deixa de ser usado nas solicitações; os PDFs ficam guardados.")) return;
    try {
      await pedidoMedicoService.alterarAtivo(p.id, !p.ativo);
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível alterar o pedido."));
    }
  };

  return (
    <section className="sb-card" aria-labelledby="pedidos-titulo">
      <div className="sb-card__header">
        <h3 id="pedidos-titulo" className="sb-card__title">
          Pedidos médicos
        </h3>
        {podeEditar && (
          <button type="button" className="sb-btn sb-btn--sm" onClick={() => setAberto(true)}>
            <Icone nome="mais" />
            Novo pedido
          </button>
        )}
      </div>
      {carregando ? (
        <Carregando />
      ) : erro ? (
        <div className="sb-card__body">
          <MensagemErro mensagem={erro} onRetry={recarregar} />
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="sb-card__body">
          <p className="texto-suave">
            Nenhum pedido médico. Ele é anexado a cada solicitação de autorização: sem pedido válido, as sessões do paciente
            ficam com pendência.
          </p>
        </div>
      ) : (
        <div className="sb-card__body">
          <ul className="lista-simples">
            {data!.map((p) => (
              <li key={p.id} className="pilha" style={{ gap: 6 }}>
                <div className="ferramentas">
                  <span style={{ fontWeight: 500 }}>
                    {p.medicoNome} · <span className="mono">{`${p.conselho} ${p.numeroConselho}/${p.ufConselho}`}</span>
                  </span>
                  {vigente(p, hoje) ? (
                    <Badge tom="success">Válido</Badge>
                  ) : p.ativo ? (
                    <Badge tom="warning">{p.dataPedido > hoje ? "Ainda não vale" : "Vencido"}</Badge>
                  ) : (
                    <Badge>Desativado</Badge>
                  )}
                  {podeEditar && (
                    <button type="button" className="sb-btn sb-btn--sm empurra" onClick={() => alternar(p)}>
                      {p.ativo ? "Desativar" : "Reativar"}
                    </button>
                  )}
                </div>
                <p className="texto-suave">
                  Pedido de <span className="mono">{formatarData(p.dataPedido)}</span>
                  {p.validoAte && (
                    <>
                      {" "}· válido até <span className="mono">{formatarData(p.validoAte)}</span>
                    </>
                  )}
                  {p.cid && (
                    <>
                      {" "}· CID <span className="mono">{p.cid}</span>
                    </>
                  )}
                  {" "}· {p.convenio?.nome ?? "qualquer convênio"}
                </p>
                {p.indicacaoClinica && <p className="texto-apoio">{p.indicacaoClinica}</p>}
                <ul className="lista-arquivos">
                  {p.arquivos.map((a) => (
                    <li key={a.id}>
                      <a href={pedidoMedicoService.urlArquivo(p.id, a.id)} target="_blank" rel="noopener">
                        <Icone nome="pdf" />
                        {a.nomeOriginal}
                        <span className="texto-suave mono">{tamanho(a.tamanho)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Novo pedido médico"
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={() => setAberto(false)}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-pedido" disabled={salvando}>
              {salvando ? "Enviando…" : "Salvar"}
            </button>
          </>
        }
      >
        <form id="form-pedido" onSubmit={aoEnviar} noValidate className="pilha">
          <div className="form-grade">
            <div className="sb-field inteira">
              <label className="sb-label" htmlFor="ped-medico">
                Médico solicitante<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <input id="ped-medico" name="medicoNome" className="sb-input" required />
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="ped-conselho">
                Conselho
              </label>
              <select id="ped-conselho" name="conselho" className="sb-input" defaultValue="CRM">
                {SIGLAS_CONSELHO.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="ped-numero">
                Número<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <input id="ped-numero" name="numeroConselho" inputMode="numeric" className="sb-input mono" required />
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="ped-uf">
                UF<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <select id="ped-uf" name="ufConselho" className="sb-input" defaultValue="SP">
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="ped-cbo">
                CBO do médico
              </label>
              <input id="ped-cbo" name="cbo" inputMode="numeric" className="sb-input mono" placeholder="Ex.: 225124 (pediatra)" />
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="ped-data">
                Data do pedido<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <input id="ped-data" name="dataPedido" type="date" className="sb-input" defaultValue={hoje} required />
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="ped-validade">
                Válido até
              </label>
              <input id="ped-validade" name="validoAte" type="date" className="sb-input" />
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="ped-cid">
                CID-10
              </label>
              <input id="ped-cid" name="cid" className="sb-input mono" placeholder="F84.0" />
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="ped-convenio">
                Convênio
              </label>
              <select id="ped-convenio" name="convenioId" className="sb-input" defaultValue="">
                <option value="">Qualquer convênio</option>
                {convenios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="sb-field inteira">
              <label className="sb-label" htmlFor="ped-indicacao">
                Indicação clínica
              </label>
              <textarea id="ped-indicacao" name="indicacaoClinica" className="sb-input" rows={2} />
            </div>
            <div className="sb-field inteira">
              <label className="sb-label" htmlFor="ped-arquivos">
                PDFs (pedido médico e relatório)<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <input
                id="ped-arquivos"
                name="arquivos"
                type="file"
                className="arquivo"
                accept="application/pdf,.pdf"
                multiple
                required
                aria-describedby="ped-arquivos-ajuda"
              />
              <span id="ped-arquivos-ajuda" className="sb-help">
                Até 5 arquivos PDF, 10 MB cada. Selecione os dois de uma vez (Ctrl + clique).
              </span>
            </div>
          </div>
        </form>
      </Modal>
    </section>
  );
}
