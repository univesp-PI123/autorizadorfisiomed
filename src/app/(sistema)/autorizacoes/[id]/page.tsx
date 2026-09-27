"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import StatusBadge, { rotuloStatus } from "@/components/ui/StatusBadge";
import { useAlertas } from "@/contextos/AlertaContexto";
import { formatarData, formatarDataHora, percentualSessoes } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { autorizacaoService } from "@/lib/cliente/servicos";
import type { StatusAutorizacao } from "@/lib/cliente/tipos";
import { TRANSICOES_MANUAIS } from "@/lib/regras/transicoes";

const DADOS_VAZIOS = { motivoNegativa: "", numeroAutorizacao: "", dataResposta: "", quantidadeAutorizada: "" };

export default function AutorizacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { buscarAlertas } = useAlertas();
  const [modalStatus, setModalStatus] = useState(false);
  const [novoStatus, setNovoStatus] = useState<StatusAutorizacao | "">("");
  const [dadosStatus, setDadosStatus] = useState(DADOS_VAZIOS);
  const [salvando, setSalvando] = useState(false);

  const buscar = useCallback(() => autorizacaoService.buscarPorId(id), [id]);
  const { data: aut, carregando, erro, recarregar } = useFetch(buscar);

  if (carregando) return <Carregando mensagem="Carregando autorização..." />;
  if (erro || !aut) return <MensagemErro mensagem={erro ?? "Autorização não encontrada."} onRetry={recarregar} />;

  const transicoes = TRANSICOES_MANUAIS[aut.status];

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
          ? "Status atualizado!"
          : `Status atualizado — e em seguida marcado como "${rotuloStatus(atualizada.status)}" pelo sistema.`,
      );
      fecharModal();
      recarregar();
      buscarAlertas();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Erro ao atualizar status."));
    } finally {
      setSalvando(false);
    }
  };

  const total = aut.quantidadeAutorizada ?? aut.quantidadeSolicitada;
  const pct = percentualSessoes(aut.quantidadeUtilizada, aut.quantidadeAutorizada);

  return (
    <div className="pilha">
      <div className="cabecalho-pagina">
        <Link href="/autorizacoes" className="btn btn-secondary btn-sm">
          ← Voltar
        </Link>
        <h2 style={{ flex: 1 }}>Autorização — {aut.procedimento}</h2>
        <StatusBadge status={aut.status} />
        {transicoes.length > 0 && (
          <button className="btn btn-primary btn-sm" onClick={() => setModalStatus(true)}>
            Atualizar status
          </button>
        )}
      </div>

      <div className="grade-2">
        <section className="card" aria-labelledby="dados-aut">
          <h3 id="dados-aut" className="titulo-secao">
            Dados da autorização
          </h3>
          <dl className="dl-grade">
            {(
              [
                ["Nº autorização", aut.numeroAutorizacao || "—"],
                ["Protocolo", aut.protocolo || "—"],
                ["Procedimento", aut.procedimento],
                ["Código", aut.codigoProcedimento || "—"],
                ["Qtd. solicitada", aut.quantidadeSolicitada],
                ["Qtd. autorizada", aut.quantidadeAutorizada ?? "—"],
                ["Data da solicitação", formatarData(aut.dataSolicitacao)],
                ["Data da resposta", formatarData(aut.dataResposta)],
                ["Início da vigência", formatarData(aut.dataInicioVigencia)],
                ["Fim da vigência", formatarData(aut.dataFimVigencia)],
              ] as const
            ).map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt>{rotulo}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
          </dl>

          <div style={{ marginTop: "16px" }}>
            <p className="texto-suave" style={{ marginBottom: "4px" }}>
              Sessões utilizadas: <strong>{aut.quantidadeUtilizada}</strong> de {total}
            </p>
            {aut.quantidadeAutorizada !== null && (
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Percentual de sessões utilizadas"
                style={{ height: "8px", background: "var(--color-gray-200)", borderRadius: "999px", overflow: "hidden" }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: pct >= 90 ? "var(--color-danger)" : pct >= 80 ? "var(--color-warning)" : "var(--color-success)",
                  }}
                />
              </div>
            )}
          </div>

          {aut.motivoNegativa && (
            <div style={{ marginTop: "12px", background: "#fee2e2", padding: "12px", borderRadius: "var(--radius)" }}>
              <strong style={{ color: "var(--color-danger)" }}>Motivo da negativa:</strong>
              <p style={{ marginTop: "4px", fontSize: "var(--font-size-sm)" }}>{aut.motivoNegativa}</p>
            </div>
          )}
          {aut.observacoes && (
            <p className="texto-suave" style={{ marginTop: "12px" }}>
              <strong>Observações:</strong> {aut.observacoes}
            </p>
          )}
        </section>

        <section className="card" aria-labelledby="vinculo-titulo">
          <h3 id="vinculo-titulo" className="titulo-secao">
            Paciente e convênio
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div className="caixa-cinza">
              <p style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>{aut.paciente?.nome}</p>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-gray-500)" }}>
                CPF: {aut.paciente?.cpf || "—"}
              </p>
              <Link href={`/pacientes/${aut.pacienteId}`} className="btn btn-ghost btn-sm" style={{ marginTop: "8px" }}>
                Ver paciente
              </Link>
            </div>
            <div className="caixa-cinza">
              <p style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>{aut.convenio?.nome}</p>
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-gray-500)" }}>
                {aut.vinculo
                  ? `Carteirinha: ${aut.vinculo.numeroCarteirinha} | Plano: ${aut.vinculo.plano || "—"}`
                  : "Paciente sem carteirinha cadastrada para este convênio."}
              </p>
            </div>
            {aut.usuarioCriou && (
              <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-gray-500)" }}>
                Criada por: {aut.usuarioCriou.nome}
              </p>
            )}
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="historico-titulo">
        <h3 id="historico-titulo" className="titulo-secao">
          Histórico de status
        </h3>
        {(aut.historico ?? []).length === 0 ? (
          <p className="texto-suave">Sem registros.</p>
        ) : (
          <ol style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
            {aut.historico!.map((h) => (
              <li key={h.id} style={{ display: "flex", gap: "12px", alignItems: "baseline", flexWrap: "wrap" }}>
                <span className="texto-suave" style={{ minWidth: "150px" }}>
                  {formatarDataHora(h.createdAt)}
                </span>
                <span>
                  {h.statusAnterior && (
                    <>
                      <StatusBadge status={h.statusAnterior} /> →{" "}
                    </>
                  )}
                  <StatusBadge status={h.statusNovo} />
                </span>
                <span className="texto-suave">
                  {h.usuario ? h.usuario.nome : "Sistema"}
                  {h.observacao && ` — ${h.observacao}`}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Modal
        aberto={modalStatus}
        onFechar={fecharModal}
        titulo="Atualizar status da autorização"
        rodape={
          <>
            <button className="btn btn-secondary" onClick={fecharModal}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="form-status" type="submit" disabled={salvando || !novoStatus}>
              {salvando ? "Salvando..." : "Confirmar"}
            </button>
          </>
        }
      >
        <form id="form-status" onSubmit={aoAtualizarStatus}>
          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label className="form-label" htmlFor="novoStatus">
              Novo status <span className="required">*</span>
            </label>
            <select
              id="novoStatus"
              className="form-control"
              value={novoStatus}
              onChange={(e) => setNovoStatus(e.target.value as StatusAutorizacao)}
              required
            >
              <option value="">Selecione...</option>
              {transicoes.map((s) => (
                <option key={s} value={s}>
                  {rotuloStatus(s)}
                </option>
              ))}
            </select>
          </div>
          {novoStatus === "autorizada" && (
            <>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label" htmlFor="numeroAutorizacao">
                  Número da autorização
                </label>
                <input
                  id="numeroAutorizacao"
                  type="text"
                  className="form-control"
                  value={dadosStatus.numeroAutorizacao}
                  onChange={(e) => setDadosStatus((d) => ({ ...d, numeroAutorizacao: e.target.value }))}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label className="form-label" htmlFor="qtdAut">
                  Quantidade autorizada
                </label>
                <input
                  id="qtdAut"
                  type="number"
                  min="1"
                  className="form-control"
                  placeholder={`Em branco = ${aut.quantidadeSolicitada} (solicitada)`}
                  value={dadosStatus.quantidadeAutorizada}
                  onChange={(e) => setDadosStatus((d) => ({ ...d, quantidadeAutorizada: e.target.value }))}
                />
              </div>
            </>
          )}
          {novoStatus === "negada" && (
            <div className="form-group">
              <label className="form-label" htmlFor="motivoNegativa">
                Motivo da negativa
              </label>
              <textarea
                id="motivoNegativa"
                className="form-control"
                rows={3}
                value={dadosStatus.motivoNegativa}
                onChange={(e) => setDadosStatus((d) => ({ ...d, motivoNegativa: e.target.value }))}
              />
            </div>
          )}
          {(novoStatus === "autorizada" || novoStatus === "negada") && (
            <div className="form-group" style={{ marginTop: "16px" }}>
              <label className="form-label" htmlFor="dataResposta">
                Data da resposta
              </label>
              <input
                id="dataResposta"
                type="date"
                className="form-control"
                value={dadosStatus.dataResposta}
                onChange={(e) => setDadosStatus((d) => ({ ...d, dataResposta: e.target.value }))}
              />
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
