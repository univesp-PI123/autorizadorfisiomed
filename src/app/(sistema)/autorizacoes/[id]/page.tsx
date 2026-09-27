"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Icone from "@/components/Icone";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import StatusBadge, { rotuloStatus } from "@/components/ui/StatusBadge";
import { useAlertas } from "@/contextos/AlertaContexto";
import { useSessao } from "@/contextos/SessaoContexto";
import { formatarData, formatarDataHora, percentualSessoes } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { autorizacaoService } from "@/lib/cliente/servicos";
import type { StatusAutorizacao } from "@/lib/cliente/tipos";
import { TRANSICOES_MANUAIS } from "@/lib/regras/transicoes";

const DADOS_VAZIOS = { motivoNegativa: "", numeroAutorizacao: "", dataResposta: "", quantidadeAutorizada: "" };

export default function AutorizacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { usuario } = useSessao();
  const { buscarAlertas } = useAlertas();
  const [modalStatus, setModalStatus] = useState(false);
  const [novoStatus, setNovoStatus] = useState<StatusAutorizacao | "">("");
  const [dadosStatus, setDadosStatus] = useState(DADOS_VAZIOS);
  const [salvando, setSalvando] = useState(false);

  const buscar = useCallback(() => autorizacaoService.buscarPorId(id), [id]);
  const { data: aut, carregando, erro, recarregar } = useFetch(buscar);

  if (carregando) return <Carregando mensagem="Carregando autorização…" />;
  if (erro || !aut) return <MensagemErro mensagem={erro ?? "Autorização não encontrada."} onRetry={recarregar} />;

  const transicoes = usuario.perfil === "terapeuta" ? [] : TRANSICOES_MANUAIS[aut.status];

  const fecharModal = () => {
    setModalStatus(false);
    setNovoStatus("");
    setDadosStatus(DADOS_VAZIOS);
  };

  const aoAtualizarStatus = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const atualizada = await autorizacaoService.atualizarStatus(id, { status: novoStatus, ...dadosStatus });
      toast.success(
        atualizada.status === novoStatus
          ? `Status alterado para ${rotuloStatus(novoStatus).toLowerCase()}.`
          : `Status alterado e, em seguida, marcado como ${rotuloStatus(atualizada.status).toLowerCase()} pelo sistema.`,
      );
      fecharModal();
      recarregar();
      buscarAlertas();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível alterar o status."));
    } finally {
      setSalvando(false);
    }
  };

  const total = aut.quantidadeAutorizada ?? aut.quantidadeSolicitada;
  const pct = percentualSessoes(aut.quantidadeUtilizada, aut.quantidadeAutorizada);

  const dados: [string, string | number, boolean?][] = [
    ["Nº da autorização", aut.numeroAutorizacao || "—", true],
    ["Protocolo", aut.protocolo || "—", true],
    ["Procedimento", aut.procedimento],
    ["Código TUSS", aut.codigoProcedimento || "—", true],
    ["Sessões solicitadas", aut.quantidadeSolicitada, true],
    ["Sessões autorizadas", aut.quantidadeAutorizada ?? "—", true],
    ["Solicitação", formatarData(aut.dataSolicitacao), true],
    ["Resposta", formatarData(aut.dataResposta), true],
    ["Início da vigência", formatarData(aut.dataInicioVigencia), true],
    ["Fim da vigência", formatarData(aut.dataFimVigencia), true],
  ];

  return (
    <>
      <div className="ferramentas">
        <Link href="/autorizacoes" className="sb-btn sb-btn--ghost">
          <Icone nome="voltar" />
          Autorizações
        </Link>
        <h2 className="card-title" style={{ fontSize: 17 }}>
          {aut.procedimento}
        </h2>
        <StatusBadge status={aut.status} />
        {transicoes.length > 0 && (
          <button type="button" className="sb-btn sb-btn--primary empurra" onClick={() => setModalStatus(true)}>
            Alterar status
          </button>
        )}
      </div>

      <div className="grid2">
        <section className="sb-card" aria-labelledby="dados-aut">
          <div className="sb-card__header">
            <h3 id="dados-aut" className="sb-card__title">
              Dados da autorização
            </h3>
          </div>
          <div className="sb-card__body pilha">
            <dl className="dl-grade">
              {dados.map(([rotulo, valor, mono]) => (
                <div key={rotulo}>
                  <dt>{rotulo}</dt>
                  <dd className={mono ? "mono" : undefined}>{valor}</dd>
                </div>
              ))}
            </dl>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span className="texto-suave">Sessões utilizadas</span>
                <span className="mono">
                  {aut.quantidadeUtilizada} de {total}
                </span>
              </div>
              {aut.quantidadeAutorizada !== null && (
                <div
                  className="progresso"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Sessões utilizadas"
                >
                  <span style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
            {aut.motivoNegativa && (
              <div className="aviso">
                <strong style={{ fontWeight: 500 }}>Motivo da negativa:</strong> {aut.motivoNegativa}
              </div>
            )}
            {aut.observacoes && (
              <p className="texto-apoio">
                <span className="texto-suave">Observações: </span>
                {aut.observacoes}
              </p>
            )}
          </div>
        </section>

        <section className="sb-card" aria-labelledby="vinculo-titulo">
          <div className="sb-card__header">
            <h3 id="vinculo-titulo" className="sb-card__title">
              Paciente e convênio
            </h3>
          </div>
          <div className="sb-card__body">
            <ul className="lista-simples">
              <li>
                <p style={{ fontWeight: 500 }}>
                  <Link href={`/pacientes/${aut.pacienteId}`}>{aut.paciente?.nome}</Link>
                </p>
                <p className="texto-suave">
                  CPF <span className="mono">{aut.paciente?.cpf || "—"}</span>
                </p>
              </li>
              <li>
                <p style={{ fontWeight: 500 }}>{aut.convenio?.nome}</p>
                <p className="texto-suave">
                  {aut.vinculo ? (
                    <>
                      Carteirinha <span className="mono">{aut.vinculo.numeroCarteirinha}</span> · Plano{" "}
                      {aut.vinculo.plano || "—"}
                    </>
                  ) : (
                    "Paciente sem carteirinha cadastrada para este convênio."
                  )}
                </p>
              </li>
              {aut.usuarioCriou && (
                <li>
                  <p className="texto-suave">Criada por {aut.usuarioCriou.nome}</p>
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>

      <section className="sb-card" aria-labelledby="historico-titulo">
        <div className="sb-card__header">
          <h3 id="historico-titulo" className="sb-card__title">
            Histórico de status
          </h3>
        </div>
        <div className="sb-card__body">
          {(aut.historico ?? []).length === 0 ? (
            <p className="texto-suave">Sem registros.</p>
          ) : (
            <ol className="linha-tempo">
              {aut.historico!.map((h) => (
                <li key={h.id}>
                  <span className="quando">{formatarDataHora(h.createdAt)}</span>
                  <span>
                    {h.statusAnterior && (
                      <>
                        <StatusBadge status={h.statusAnterior} /> <span aria-label="para">→</span>{" "}
                      </>
                    )}
                    <StatusBadge status={h.statusNovo} />{" "}
                    <span className="texto-apoio">
                      {h.usuario ? h.usuario.nome : "Sistema"}
                      {h.observacao && ` — ${h.observacao}`}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>

      <Modal
        aberto={modalStatus}
        onFechar={fecharModal}
        titulo="Alterar status"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={fecharModal}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-status" disabled={salvando || !novoStatus}>
              {salvando ? "Salvando…" : "Confirmar"}
            </button>
          </>
        }
      >
        <form id="form-status" onSubmit={aoAtualizarStatus} className="pilha">
          <div className="sb-field">
            <label className="sb-label" htmlFor="novoStatus">
              Novo status<span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <select
              id="novoStatus"
              className="sb-input"
              value={novoStatus}
              onChange={(e) => setNovoStatus(e.target.value as StatusAutorizacao)}
              required
            >
              <option value="">Selecione…</option>
              {transicoes.map((s) => (
                <option key={s} value={s}>
                  {rotuloStatus(s)}
                </option>
              ))}
            </select>
          </div>
          {novoStatus === "autorizada" && (
            <>
              <div className="sb-field">
                <label className="sb-label" htmlFor="numeroAutorizacao">
                  Número da autorização
                </label>
                <input
                  id="numeroAutorizacao"
                  className="sb-input"
                  value={dadosStatus.numeroAutorizacao}
                  onChange={(e) => setDadosStatus((d) => ({ ...d, numeroAutorizacao: e.target.value }))}
                />
              </div>
              <div className="sb-field">
                <label className="sb-label" htmlFor="qtdAut">
                  Sessões autorizadas
                </label>
                <input
                  id="qtdAut"
                  type="number"
                  min="1"
                  className="sb-input"
                  placeholder={`${aut.quantidadeSolicitada} (solicitadas)`}
                  value={dadosStatus.quantidadeAutorizada}
                  onChange={(e) => setDadosStatus((d) => ({ ...d, quantidadeAutorizada: e.target.value }))}
                  aria-describedby="qtdAut-ajuda"
                />
                <span id="qtdAut-ajuda" className="sb-help">
                  Em branco, vale a quantidade solicitada.
                </span>
              </div>
            </>
          )}
          {novoStatus === "negada" && (
            <div className="sb-field">
              <label className="sb-label" htmlFor="motivoNegativa">
                Motivo da negativa
              </label>
              <textarea
                id="motivoNegativa"
                className="sb-input"
                rows={3}
                value={dadosStatus.motivoNegativa}
                onChange={(e) => setDadosStatus((d) => ({ ...d, motivoNegativa: e.target.value }))}
              />
            </div>
          )}
          {(novoStatus === "autorizada" || novoStatus === "negada") && (
            <div className="sb-field">
              <label className="sb-label" htmlFor="dataResposta">
                Data da resposta
              </label>
              <input
                id="dataResposta"
                type="date"
                className="sb-input"
                value={dadosStatus.dataResposta}
                onChange={(e) => setDadosStatus((d) => ({ ...d, dataResposta: e.target.value }))}
                aria-describedby="dataResposta-ajuda"
              />
              <span id="dataResposta-ajuda" className="sb-help">
                Em branco, vale a data de hoje.
              </span>
            </div>
          )}
        </form>
      </Modal>
    </>
  );
}
