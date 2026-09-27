"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import FormPaciente, { formDoPaciente, type DadosFormPaciente } from "@/components/FormPaciente";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import { formatarData } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { convenioService, pacienteService } from "@/lib/cliente/servicos";

const VINCULO_VAZIO = { convenioId: "", numeroCarteirinha: "", plano: "", titular: "", dataValidade: "" };

export default function PacienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const buscar = useCallback(() => pacienteService.buscarPorId(id), [id]);
  const { data: paciente, carregando, erro, recarregar } = useFetch(buscar);

  const [edicao, setEdicao] = useState<DadosFormPaciente | null>(null);
  const [vinculo, setVinculo] = useState<typeof VINCULO_VAZIO | null>(null);
  const [salvando, setSalvando] = useState(false);
  const buscarConvenios = useCallback(() => convenioService.listar({ ativo: true }), []);
  const { data: convenios } = useFetch(buscarConvenios);

  if (carregando) return <Carregando mensagem="Carregando dados do paciente..." />;
  if (erro || !paciente) return <MensagemErro mensagem={erro ?? "Paciente não encontrado."} onRetry={recarregar} />;

  const salvar = async (acao: () => Promise<unknown>, sucesso: string, aoConcluir: () => void) => {
    setSalvando(true);
    try {
      await acao();
      toast.success(sucesso);
      aoConcluir();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Erro ao salvar."));
    } finally {
      setSalvando(false);
    }
  };

  const aoEditar = (e: FormEvent) => {
    e.preventDefault();
    if (edicao) salvar(() => pacienteService.atualizar(id, edicao), "Paciente atualizado!", () => setEdicao(null));
  };

  const aoVincular = (e: FormEvent) => {
    e.preventDefault();
    if (vinculo) salvar(() => pacienteService.vincularConvenio(id, vinculo), "Convênio vinculado!", () => setVinculo(null));
  };

  const desativar = () => {
    if (window.confirm(`Desativar ${paciente.nome}? O histórico é mantido.`)) {
      salvar(() => pacienteService.desativar(id), "Paciente desativado.", () => {});
    }
  };

  const conveniosDisponiveis = (convenios ?? []).filter(
    (c) => !(paciente.vinculos ?? []).some((v) => v.convenioId === c.id),
  );

  return (
    <div className="pilha">
      <div className="cabecalho-pagina">
        <Link href="/pacientes" className="btn btn-secondary btn-sm">
          ← Voltar
        </Link>
        <h2>{paciente.nome}</h2>
        {!paciente.ativo && <span className="badge badge-danger">Inativo</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setEdicao(formDoPaciente(paciente))}>
            Editar
          </button>
          {paciente.ativo && (
            <button className="btn btn-ghost btn-sm" onClick={desativar} disabled={salvando}>
              Desativar
            </button>
          )}
        </div>
      </div>

      <div className="grade-2">
        <section className="card" aria-labelledby="dados-pessoais">
          <h3 id="dados-pessoais" className="titulo-secao">
            Dados pessoais
          </h3>
          <dl className="dl-grade">
            {(
              [
                ["Data de nascimento", formatarData(paciente.dataNascimento)],
                ["CPF", paciente.cpf || "—"],
                ["Responsável", paciente.responsavel || "—"],
                ["Telefone", paciente.telefone || "—"],
                ["E-mail", paciente.email || "—"],
                ["CID-10", paciente.cid || "—"],
              ] as const
            ).map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt>{rotulo}</dt>
                <dd>{valor}</dd>
              </div>
            ))}
            {paciente.diagnostico && (
              <div style={{ gridColumn: "1 / -1" }}>
                <dt>Diagnóstico</dt>
                <dd>{paciente.diagnostico}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="card" aria-labelledby="convenios-titulo">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", gap: "8px", flexWrap: "wrap" }}>
            <h3 id="convenios-titulo" style={{ fontWeight: 700 }}>
              Convênios
            </h3>
            <div style={{ display: "flex", gap: "8px" }}>
              <Link href={`/autorizacoes?pacienteId=${paciente.id}`} className="btn btn-ghost btn-sm">
                Ver autorizações
              </Link>
              {paciente.ativo && (
                <button className="btn btn-primary btn-sm" onClick={() => setVinculo(VINCULO_VAZIO)}>
                  + Vincular
                </button>
              )}
            </div>
          </div>
          {(paciente.vinculos ?? []).length === 0 ? (
            <p className="texto-suave">Nenhum convênio vinculado.</p>
          ) : (
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "12px" }}>
              {paciente.vinculos!.map((v) => (
                <li key={v.id} className="caixa-cinza">
                  <p style={{ fontWeight: 700, fontSize: "var(--font-size-sm)" }}>{v.convenio?.nome}</p>
                  <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-gray-500)" }}>
                    Carteirinha: {v.numeroCarteirinha} | Plano: {v.plano || "—"}
                    {v.dataValidade && ` | Validade: ${formatarData(v.dataValidade)}`}
                  </p>
                  {!v.ativo && (
                    <span className="badge badge-danger" style={{ marginTop: "4px" }}>
                      Inativo
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card" aria-labelledby="autorizacoes-titulo">
        <h3 id="autorizacoes-titulo" className="titulo-secao">
          Últimas autorizações
        </h3>
        {paciente.autorizacoes.length === 0 ? (
          <p className="texto-suave">Nenhuma autorização registrada.</p>
        ) : (
          <div className="table-container">
            <table aria-label="Autorizações do paciente">
              <thead>
                <tr>
                  <th scope="col">Procedimento</th>
                  <th scope="col">Convênio</th>
                  <th scope="col">Solicitação</th>
                  <th scope="col">Fim da vigência</th>
                  <th scope="col">Sessões</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paciente.autorizacoes.map((a) => (
                  <tr key={a.id}>
                    <td>{a.procedimento}</td>
                    <td>{a.convenio?.nome}</td>
                    <td>{formatarData(a.dataSolicitacao)}</td>
                    <td>{formatarData(a.dataFimVigencia)}</td>
                    <td>
                      {a.quantidadeUtilizada}/{a.quantidadeAutorizada ?? a.quantidadeSolicitada}
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td>
                      <Link href={`/autorizacoes/${a.id}`} className="btn btn-secondary btn-sm">
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        aberto={edicao !== null}
        onFechar={() => setEdicao(null)}
        titulo="Editar paciente"
        tamanho="lg"
        rodape={
          <>
            <button className="btn btn-secondary" onClick={() => setEdicao(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="form-editar-paciente" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {edicao && (
          <FormPaciente
            id="form-editar-paciente"
            form={edicao}
            aoMudar={(e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setEdicao((f) => f && { ...f, [e.target.name]: e.target.value })
            }
            aoEnviar={aoEditar}
          />
        )}
      </Modal>

      <Modal
        aberto={vinculo !== null}
        onFechar={() => setVinculo(null)}
        titulo="Vincular convênio"
        rodape={
          <>
            <button className="btn btn-secondary" onClick={() => setVinculo(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="form-vinculo" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Vincular"}
            </button>
          </>
        }
      >
        {vinculo && (
          <form id="form-vinculo" onSubmit={aoVincular} noValidate>
            <div className="grade-form">
              <div className="form-group inteira">
                <label className="form-label" htmlFor="v-convenio">
                  Convênio <span className="required">*</span>
                </label>
                <select
                  id="v-convenio"
                  className="form-control"
                  value={vinculo.convenioId}
                  onChange={(e) => setVinculo({ ...vinculo, convenioId: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {conveniosDisponiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="v-carteirinha">
                  Nº da carteirinha <span className="required">*</span>
                </label>
                <input
                  id="v-carteirinha"
                  className="form-control"
                  value={vinculo.numeroCarteirinha}
                  onChange={(e) => setVinculo({ ...vinculo, numeroCarteirinha: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="v-plano">
                  Plano
                </label>
                <input
                  id="v-plano"
                  className="form-control"
                  value={vinculo.plano}
                  onChange={(e) => setVinculo({ ...vinculo, plano: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="v-titular">
                  Titular (se não for o paciente)
                </label>
                <input
                  id="v-titular"
                  className="form-control"
                  value={vinculo.titular}
                  onChange={(e) => setVinculo({ ...vinculo, titular: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="v-validade">
                  Validade da carteirinha
                </label>
                <input
                  id="v-validade"
                  type="date"
                  className="form-control"
                  value={vinculo.dataValidade}
                  onChange={(e) => setVinculo({ ...vinculo, dataValidade: e.target.value })}
                />
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
