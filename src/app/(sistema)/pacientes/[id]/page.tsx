"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import FormPaciente, { formDoPaciente, type DadosFormPaciente } from "@/components/FormPaciente";
import Icone from "@/components/Icone";
import PedidosMedicos from "@/components/PedidosMedicos";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import StatusBadge, { Badge } from "@/components/ui/StatusBadge";
import { formatarData } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { convenioService, elegibilidadeService, pacienteService } from "@/lib/cliente/servicos";
import type { RespostaElegibilidade } from "@/lib/cliente/tipos";

const VINCULO_VAZIO = { convenioId: "", numeroCarteirinha: "", plano: "", titular: "", dataValidade: "" };

/** Resposta da elegibilidade em uma frase, com o tom do selo. */
function resumoElegibilidade(r: RespostaElegibilidade): { tom: "success" | "warning"; texto: string } {
  if (r.tipo === "falha") return { tom: "warning", texto: `Sem resposta da Amil: ${r.mensagem}` };
  if (r.tipo === "erro") return { tom: "warning", texto: `Recusada pela Amil: ${r.glosas.join("; ") || "sem motivo informado"}` };
  if (r.elegivel) {
    const extra = [r.nome, r.validade && `validade ${formatarData(r.validade)}`].filter(Boolean).join(" · ");
    return { tom: "success", texto: `Elegível${extra ? ` — ${extra}` : ""}` };
  }
  return { tom: "warning", texto: `Não elegível${r.glosas.length ? `: ${r.glosas.join("; ")}` : ""}` };
}

export default function PacienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const buscar = useCallback(() => pacienteService.buscarPorId(id), [id]);
  const { data: paciente, carregando, erro, recarregar } = useFetch(buscar);

  const [edicao, setEdicao] = useState<DadosFormPaciente | null>(null);
  const [vinculo, setVinculo] = useState<typeof VINCULO_VAZIO | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [verificando, setVerificando] = useState<string | null>(null);
  const [elegibilidade, setElegibilidade] = useState<Record<string, RespostaElegibilidade>>({});
  const buscarConvenios = useCallback(() => convenioService.listar({ ativo: true }), []);
  const { data: convenios } = useFetch(buscarConvenios);

  if (carregando) return <Carregando mensagem="Carregando paciente…" />;
  if (erro || !paciente) return <MensagemErro mensagem={erro ?? "Paciente não encontrado."} onRetry={recarregar} />;

  const salvar = async (acao: () => Promise<unknown>, sucesso: string, aoConcluir: () => void) => {
    setSalvando(true);
    try {
      await acao();
      toast.success(sucesso);
      aoConcluir();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  };

  const aoEditar = (e: FormEvent) => {
    e.preventDefault();
    if (edicao) salvar(() => pacienteService.atualizar(id, edicao), "Paciente atualizado.", () => setEdicao(null));
  };

  const verificarElegibilidade = async (vinculoId: string) => {
    setVerificando(vinculoId);
    try {
      const r = await elegibilidadeService.verificar(vinculoId);
      setElegibilidade((atual) => ({ ...atual, [vinculoId]: r }));
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível verificar a elegibilidade."));
    } finally {
      setVerificando(null);
    }
  };

  const aoVincular = (e: FormEvent) => {
    e.preventDefault();
    if (vinculo) salvar(() => pacienteService.vincularConvenio(id, vinculo), "Convênio vinculado.", () => setVinculo(null));
  };

  const desativar = () => {
    if (window.confirm(`Desativar ${paciente.nome}? O histórico é mantido.`)) {
      salvar(() => pacienteService.desativar(id), "Paciente desativado.", () => {});
    }
  };

  const conveniosDisponiveis = (convenios ?? []).filter(
    (c) => !(paciente.vinculos ?? []).some((v) => v.convenioId === c.id),
  );

  const dados: [string, string, boolean?][] = [
    ["Data de nascimento", formatarData(paciente.dataNascimento), true],
    ["CPF", paciente.cpf || "—", true],
    ["Responsável", paciente.responsavel || "—"],
    ["Telefone", paciente.telefone || "—", true],
    ["E-mail", paciente.email || "—"],
    ["CID-10", paciente.cid || "—", true],
  ];

  return (
    <>
      <div className="ferramentas">
        <Link href="/pacientes" className="sb-btn sb-btn--ghost">
          <Icone nome="voltar" />
          Pacientes
        </Link>
        <h2 className="card-title" style={{ fontSize: 17 }}>
          {paciente.nome}
        </h2>
        {!paciente.ativo && <Badge>Inativo</Badge>}
        <div className="empurra ferramentas">
          {paciente.ativo && (
            <button type="button" className="sb-btn" onClick={desativar} disabled={salvando}>
              Desativar
            </button>
          )}
          <button type="button" className="sb-btn" onClick={() => setEdicao(formDoPaciente(paciente))}>
            Editar
          </button>
        </div>
      </div>

      <div className="grid-meio">
        <section className="sb-card" aria-labelledby="dados-pessoais">
          <div className="sb-card__header">
            <h3 id="dados-pessoais" className="sb-card__title">
              Dados pessoais
            </h3>
          </div>
          <div className="sb-card__body">
            <dl className="dl-grade">
              {dados.map(([rotulo, valor, mono]) => (
                <div key={rotulo}>
                  <dt>{rotulo}</dt>
                  <dd className={mono ? "mono" : undefined}>{valor}</dd>
                </div>
              ))}
              {paciente.diagnostico && (
                <div className="inteira">
                  <dt>Diagnóstico</dt>
                  <dd>{paciente.diagnostico}</dd>
                </div>
              )}
              {paciente.observacoes && (
                <div className="inteira">
                  <dt>Observações</dt>
                  <dd>{paciente.observacoes}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>

        <section className="sb-card" aria-labelledby="convenios-titulo">
          <div className="sb-card__header">
            <h3 id="convenios-titulo" className="sb-card__title">
              Convênios
            </h3>
            {paciente.ativo && (
              <button type="button" className="sb-btn sb-btn--sm" onClick={() => setVinculo(VINCULO_VAZIO)}>
                <Icone nome="mais" />
                Vincular
              </button>
            )}
          </div>
          <div className="sb-card__body">
            {(paciente.vinculos ?? []).length === 0 ? (
              <p className="texto-suave">Nenhum convênio vinculado.</p>
            ) : (
              <ul className="lista-simples">
                {paciente.vinculos!.map((v) => (
                  <li key={v.id}>
                    <p style={{ fontWeight: 500 }}>
                      {v.convenio?.nome} {!v.ativo && <Badge>Inativo</Badge>}
                    </p>
                    <p className="texto-suave">
                      Carteirinha <span className="mono">{v.numeroCarteirinha}</span> · Plano {v.plano || "—"}
                      {v.dataValidade && (
                        <>
                          {" "}
                          · Validade <span className="mono">{formatarData(v.dataValidade)}</span>
                        </>
                      )}
                    </p>
                    {elegibilidade[v.id] && (
                      <p>
                        <Badge tom={resumoElegibilidade(elegibilidade[v.id]).tom}>
                          {resumoElegibilidade(elegibilidade[v.id]).texto}
                        </Badge>
                      </p>
                    )}
                    {v.convenio?.integracao === "tiss_amil" && v.ativo && (
                      <button
                        type="button"
                        className="sb-btn sb-btn--sm"
                        disabled={verificando !== null}
                        onClick={() => verificarElegibilidade(v.id)}
                      >
                        {verificando === v.id ? "Verificando…" : "Verificar elegibilidade na Amil"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="sb-card" aria-labelledby="autorizacoes-titulo">
        <div className="sb-card__header">
          <h3 id="autorizacoes-titulo" className="sb-card__title">
            Últimas autorizações
          </h3>
          <Link href={`/autorizacoes?pacienteId=${paciente.id}`}>Ver todas</Link>
        </div>
        <div className="tabela-rolagem">
          <table className="sb-table">
            <thead>
              <tr>
                <th scope="col">Procedimento</th>
                <th scope="col">Convênio</th>
                <th scope="col">Status</th>
                <th scope="col" className="sb-end">
                  Sessões
                </th>
                <th scope="col" className="sb-end">
                  Solicitação
                </th>
                <th scope="col" className="sb-end">
                  Fim da vigência
                </th>
              </tr>
            </thead>
            <tbody>
              {paciente.autorizacoes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="vazio">
                    Nenhuma autorização registrada.
                  </td>
                </tr>
              ) : (
                paciente.autorizacoes.map((a) => (
                  <tr key={a.id}>
                    <td className="sb-strong">
                      <Link href={`/autorizacoes/${a.id}`}>{a.procedimento}</Link>
                    </td>
                    <td>{a.convenio?.nome}</td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="sb-mono sb-end">
                      {a.quantidadeUtilizada}/{a.quantidadeAutorizada ?? a.quantidadeSolicitada}
                    </td>
                    <td className="sb-mono sb-end">{formatarData(a.dataSolicitacao)}</td>
                    <td className="sb-mono sb-end">{formatarData(a.dataFimVigencia)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PedidosMedicos pacienteId={paciente.id} convenios={convenios ?? []} />

      <Modal
        aberto={edicao !== null}
        onFechar={() => setEdicao(null)}
        titulo="Editar paciente"
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={() => setEdicao(null)}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-editar-paciente" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
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
            <button type="button" className="sb-btn" onClick={() => setVinculo(null)}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-vinculo" disabled={salvando}>
              {salvando ? "Salvando…" : "Vincular"}
            </button>
          </>
        }
      >
        {vinculo && (
          <form id="form-vinculo" onSubmit={aoVincular} noValidate>
            <div className="form-grade">
              <div className="sb-field inteira">
                <label className="sb-label" htmlFor="v-convenio">
                  Convênio<span className="obrigatorio" aria-hidden="true">*</span>
                </label>
                <select
                  id="v-convenio"
                  className="sb-input"
                  value={vinculo.convenioId}
                  onChange={(e) => setVinculo({ ...vinculo, convenioId: e.target.value })}
                  required
                >
                  <option value="">Selecione…</option>
                  {conveniosDisponiveis.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sb-field">
                <label className="sb-label" htmlFor="v-carteirinha">
                  Número da carteirinha<span className="obrigatorio" aria-hidden="true">*</span>
                </label>
                <input
                  id="v-carteirinha"
                  className="sb-input"
                  value={vinculo.numeroCarteirinha}
                  onChange={(e) => setVinculo({ ...vinculo, numeroCarteirinha: e.target.value })}
                  required
                />
              </div>
              <div className="sb-field">
                <label className="sb-label" htmlFor="v-plano">
                  Plano
                </label>
                <input id="v-plano" className="sb-input" value={vinculo.plano} onChange={(e) => setVinculo({ ...vinculo, plano: e.target.value })} />
              </div>
              <div className="sb-field">
                <label className="sb-label" htmlFor="v-titular">
                  Titular (se não for o paciente)
                </label>
                <input id="v-titular" className="sb-input" value={vinculo.titular} onChange={(e) => setVinculo({ ...vinculo, titular: e.target.value })} />
              </div>
              <div className="sb-field">
                <label className="sb-label" htmlFor="v-validade">
                  Validade da carteirinha
                </label>
                <input
                  id="v-validade"
                  type="date"
                  className="sb-input"
                  value={vinculo.dataValidade}
                  onChange={(e) => setVinculo({ ...vinculo, dataValidade: e.target.value })}
                />
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
