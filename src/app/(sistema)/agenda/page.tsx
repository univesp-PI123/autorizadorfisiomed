"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { comUrl } from "@/components/ComUrl";
import Icone from "@/components/Icone";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import { Badge } from "@/components/ui/StatusBadge";
import { useSessao } from "@/contextos/SessaoContexto";
import { formatarData } from "@/lib/analiseDados";
import { useFetch } from "@/lib/cliente/hooks";
import { mensagemDeErro } from "@/lib/cliente/api";
import { agendaService, convenioService, guiaTissService, tokenService, unidadeService } from "@/lib/cliente/servicos";
import type { ResultadoGuias, SessaoAgenda, SituacaoSessao } from "@/lib/cliente/tipos";
import { hojeISO } from "@/lib/datas";

type Tom = "warning" | "success" | "neutro";
const SITUACOES: { valor: SituacaoSessao; rotulo: string; badge: string; tom: Tom; sub: string }[] = [
  { valor: "pendente", rotulo: "Com pendência", badge: "Com pendência", tom: "warning", sub: "falta algum dado para a guia" },
  { valor: "pronta", rotulo: "Prontas para solicitar", badge: "Pronta para solicitar", tom: "neutro", sub: "dados completos, sem autorização" },
  { valor: "coberta", rotulo: "Cobertas", badge: "Coberta", tom: "success", sub: "autorização vigente ou senha" },
  { valor: "fora", rotulo: "Fora da integração", badge: "Fora da integração", tom: "neutro", sub: "outros convênios ou sem autorização" },
  { valor: "cancelada", rotulo: "Canceladas", badge: "Cancelada", tom: "neutro", sub: "desmarcadas ou excluídas" },
];
const POR_VALOR = Object.fromEntries(SITUACOES.map((s) => [s.valor, s]));

// Onde se resolve cada pendência: uma tela do sistema ou, sem link, onde fazer.
const ONDE_RESOLVER: [RegExp, string, boolean][] = [
  [/clínica/, "/unidades#clinica", true],
  [/Unidade sem CNES/, "/unidades#unidades", true],
  [/código para a operadora/, "/procedimentos", true],
  [/Profissional sem/, "/profissionais?filtro=incompletos", true],
  [/credenciado/, "/profissionais", true],
  [/código do prestador|registro ANS/, "/convenios", true],
  [/pedido médico/i, "na página do paciente", false],
  [/token/, "no campo Token da sessão", false],
];
const ondeResolver = (p: string) => {
  const r = ONDE_RESOLVER.find(([re]) => re.test(p));
  return r ? { destino: r[1], link: r[2] } : { destino: "no AnClinic", link: false };
};

/**
 * Token que o paciente gera no app ou recebe por SMS. Vale só no dia: o
 * campo aparece nas sessões da Amil de hoje.
 */
function TokenSessao({ sessao, aoSalvar }: { sessao: SessaoAgenda; aoSalvar: () => void }) {
  const [valor, setValor] = useState(sessao.tokenDoDia ? (sessao.token ?? "") : "");
  const [salvando, setSalvando] = useState(false);
  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await tokenService.gravar(sessao.id, valor.trim() || null);
      toast.success(valor.trim() ? "Token gravado." : "Token apagado.");
      aoSalvar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível gravar o token."));
    } finally {
      setSalvando(false);
    }
  };
  const nome = sessao.paciente?.nome ?? sessao.pacienteAnclinic ?? "paciente";
  return (
    <form onSubmit={salvar} className="ferramentas" style={{ marginTop: 4 }}>
      <input
        className="sb-input sb-input--sm mono"
        style={{ width: "9ch" }}
        maxLength={10}
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/\s/g, ""))}
        placeholder="Token"
        aria-label={`Token do paciente ${nome} às ${sessao.horaInicio ?? "—"}`}
      />
      <button type="submit" className="sb-btn sb-btn--sm" disabled={salvando || valor.trim() === (sessao.tokenDoDia ? (sessao.token ?? "") : "")}>
        {salvando ? "Gravando…" : "Gravar"}
      </button>
    </form>
  );
}

function AgendaPage({ url }: { url: URLSearchParams }) {
  const { usuario } = useSessao();
  const [data, setData] = useState(url.get("data") ?? hojeISO());
  const [convenioId, setConvenioId] = useState(url.get("convenioId") ?? "");
  const [situacao, setSituacao] = useState<SituacaoSessao | "">((url.get("situacao") as SituacaoSessao) ?? "");
  const [busca, setBusca] = useState("");
  // "" = todas; "sem" = sessões sem unidade de atendimento; senão, o id da unidade.
  const [unidade, setUnidade] = useState(url.get("unidade") ?? "");
  const podeEditar = usuario.perfil === "admin" || usuario.perfil === "recepcionista";
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [unidadeDestino, setUnidadeDestino] = useState("");
  const [incluirPaciente, setIncluirPaciente] = useState(true);
  const [aplicando, setAplicando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [resultadoGuias, setResultadoGuias] = useState<ResultadoGuias | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const todasUnidades = useFetch(unidadeService.listar);

  const buscar = useCallback(() => agendaService.buscar({ data, convenioId: convenioId || undefined }), [data, convenioId]);
  const agenda = useFetch(buscar);
  const convenios = useFetch(convenioService.listar);

  const sessoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (agenda.data?.sessoes ?? []).filter(
      (s) =>
        (!situacao || s.situacao === situacao) &&
        (!unidade || (unidade === "sem" ? !s.unidade : s.unidade?.id === unidade)) &&
        (!termo ||
          [s.paciente?.nome ?? s.pacienteAnclinic, s.profissional?.nome, s.carteirinha]
            .some((v) => v?.toLowerCase().includes(termo))),
    );
  }, [agenda.data, situacao, unidade, busca]);
  const marcar = (id: string, sim: boolean) =>
    setMarcadas((m) => {
      const n = new Set(m);
      if (sim) n.add(id);
      else n.delete(id);
      return n;
    });

  const atribuirUnidade = async () => {
    if (!marcadas.size) return;
    setAplicando(true);
    try {
      const r = await unidadeService.atribuir({
        ids: [...marcadas],
        unidadeId: unidadeDestino === "remover" ? null : unidadeDestino,
        incluirPaciente,
      });
      toast.success(
        unidadeDestino === "remover"
          ? `Unidade retirada de ${r.atualizadas} sessão(ões).`
          : `Unidade atribuída a ${r.atualizadas} sessão(ões).`,
      );
      setMarcadas(new Set());
      agenda.recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível atribuir a unidade."));
    } finally {
      setAplicando(false);
    }
  };

  // Monta as guias de solicitação (XML TISS) das sessões prontas; cada guia é
  // enviada depois, pelo botão da sessão.
  const gerarGuias = async (ids: string[]) => {
    if (!ids.length) return;
    setGerando(true);
    try {
      const r = await guiaTissService.gerar(ids);
      setResultadoGuias(r);
      if (r.guias.length) toast.success(`${r.guias.length} guia(s) gerada(s).`);
      else toast.error("Nenhuma guia gerada. Veja o motivo abaixo.");
      setMarcadas(new Set());
      agenda.recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível gerar as guias."));
    } finally {
      setGerando(false);
    }
  };
  // Envia uma guia ao webservice da Amil; a resposta fica gravada na guia.
  const enviarGuia = async (id: string) => {
    setEnviando(id);
    try {
      const r = await guiaTissService.enviar(id);
      const detalhe = r.erroEnvio ?? (r.glosas.length ? r.glosas.join("; ") : r.senhaOperadora && `senha ${r.senhaOperadora}`);
      const texto = detalhe ? `${r.situacao}: ${detalhe}` : r.situacao;
      if (r.statusOperadora === "1" || r.statusOperadora === "7") toast.success(texto);
      else if (r.erroEnvio || r.statusOperadora === "3" || !r.statusOperadora) toast.error(texto);
      else toast(texto);
      agenda.recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível enviar a guia."));
    } finally {
      setEnviando(null);
    }
  };
  const prontas = sessoes.filter((s) => s.situacao === "pronta");

  const unidades = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of agenda.data?.sessoes ?? []) if (s.unidade) m.set(s.unidade.id, s.unidade.nome);
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [agenda.data]);

  return (
    <>
      <section className="sb-card">
        <div className="sb-card__header">
          <h2 className="sb-card__title">
            Sessões de <span className="mono">{formatarData(data)}</span>
          </h2>
          <div className="ferramentas">
            <input
              type="date"
              className="sb-input sb-input--sm"
              value={data}
              onChange={(e) => {
                if (!e.target.value) return;
                setData(e.target.value);
                setMarcadas(new Set());
              }}
              aria-label="Data"
            />
            <select className="sb-input sb-input--sm" value={convenioId} onChange={(e) => setConvenioId(e.target.value)} aria-label="Convênio">
              <option value="">Todos os convênios</option>
              {(convenios.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {(usuario.perfil === "admin" || usuario.perfil === "recepcionista") && (
              <Link href="/importacoes" className="sb-btn sb-btn--primary">
                <Icone nome="importar" />
                Importar agenda
              </Link>
            )}
          </div>
        </div>
      </section>

      {agenda.carregando && !agenda.data ? (
        <Carregando mensagem="Carregando agenda…" />
      ) : agenda.erro ? (
        <MensagemErro mensagem={agenda.erro} onRetry={agenda.recarregar} />
      ) : agenda.data && agenda.data.total === 0 ? (
        <div className="sb-card estado-central">
          <p>Nenhuma sessão importada para este dia.</p>
          <p className="texto-suave">Exporte o Relatório de Agendamento do AnClinic e importe a planilha.</p>
        </div>
      ) : (
        agenda.data && (
          <>
            <section className="stats stats--5" aria-label="Situação das sessões">
              {SITUACOES.map((s) => (
                <button
                  key={s.valor}
                  type="button"
                  className="sb-card sb-stat card-botao"
                  aria-pressed={situacao === s.valor}
                  onClick={() => setSituacao((atual) => (atual === s.valor ? "" : s.valor))}
                >
                  <span className="sb-stat__label">{s.rotulo}</span>
                  <span className="sb-stat__value">{agenda.data!.resumo[s.valor]}</span>
                  <span className="sb-stat__sub">{s.sub}</span>
                </button>
              ))}
            </section>

            {agenda.data.pendencias.length > 0 && (
              <section className="sb-card" aria-labelledby="titulo-pendencias">
                <div className="sb-card__header">
                  <h2 className="sb-card__title" id="titulo-pendencias">
                    Pendências
                  </h2>
                </div>
                <div className="tabela-rolagem">
                  <table className="sb-table">
                    <tbody>
                      {agenda.data.pendencias.map((p) => {
                        const onde = ondeResolver(p.pendencia);
                        return (
                          <tr key={p.pendencia}>
                            <td>{p.pendencia}</td>
                            <td className="sb-mono sb-end">{p.quantidade} sessões</td>
                            <td className="sb-end">
                              {onde.link ? <Link href={onde.destino}>Resolver</Link> : <span className="texto-suave">{onde.destino}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {resultadoGuias && (
              <section className="sb-card" aria-labelledby="titulo-guias">
                <div className="sb-card__header">
                  <h2 className="sb-card__title" id="titulo-guias">
                    Guias TISS geradas
                  </h2>
                  <div className="ferramentas">
                    <button type="button" className="sb-btn sb-btn--sm" onClick={() => setResultadoGuias(null)}>
                      Fechar
                    </button>
                  </div>
                </div>
                <p className="texto-suave">
                  XML de solicitação de SP/SADT (TISS 4.03.00), validado pelo schema da ANS. Para enviar à Amil, use{" "}
                  <strong>Enviar à Amil</strong> em cada sessão da lista.
                </p>
                {resultadoGuias.guias.length > 0 && (
                  <div className="tabela-rolagem">
                    <table className="sb-table">
                      <thead>
                        <tr>
                          <th scope="col">Guia</th>
                          <th scope="col">Paciente</th>
                          <th scope="col">Procedimento</th>
                          <th scope="col" className="sb-end">Sessão</th>
                          <th scope="col" className="sb-end">Arquivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultadoGuias.guias.map((g) => (
                          <tr key={g.id}>
                            <td className="sb-mono">{g.numero}</td>
                            <td className="sb-strong">{g.paciente}</td>
                            <td>
                              {g.procedimento}
                              <span className="texto-suave mono">código {g.codigo}</span>
                            </td>
                            <td className="sb-mono sb-end">{g.sessao}</td>
                            <td className="sb-end">
                              <a href={guiaTissService.urlXml(g.id)} download>
                                Baixar XML
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {resultadoGuias.erros.length > 0 && (
                  <>
                    <h3 className="sb-card__title">Não geradas</h3>
                    <ul className="pendencias">
                      {resultadoGuias.erros.map((e, i) => (
                        <li key={i}>
                          <strong>{e.paciente}</strong> — {e.procedimento}: {e.erros.join("; ")}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {resultadoGuias.recusadas.length > 0 && (
                  <>
                    <h3 className="sb-card__title">Sessões que não estavam prontas</h3>
                    <ul className="pendencias">
                      {resultadoGuias.recusadas.map((r) => (
                        <li key={r.agendamentoId}>
                          <strong>{r.paciente}</strong>: {r.motivo}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            )}

            <section className="sb-card" aria-labelledby="titulo-sessoes">
              <div className="sb-card__header">
                <h2 className="sb-card__title" id="titulo-sessoes">
                  {situacao ? POR_VALOR[situacao].rotulo : "Todas as sessões"}{" "}
                  <span className="texto-suave mono" style={{ fontWeight: 400 }}>
                    {sessoes.length}
                  </span>
                </h2>
                <div className="ferramentas">
                  <input
                    type="search"
                    className="sb-input sb-input--sm"
                    placeholder="Paciente, profissional ou carteirinha"
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    aria-label="Filtrar sessões"
                  />
                  <select
                    className="sb-input sb-input--sm"
                    value={situacao}
                    onChange={(e) => setSituacao(e.target.value as SituacaoSessao | "")}
                    aria-label="Situação"
                  >
                    <option value="">Todas as situações</option>
                    {SITUACOES.map((s) => (
                      <option key={s.valor} value={s.valor}>
                        {s.rotulo}
                      </option>
                    ))}
                  </select>
                  <select className="sb-input sb-input--sm" value={unidade} onChange={(e) => setUnidade(e.target.value)} aria-label="Unidade de atendimento">
                    <option value="">Todas as unidades</option>
                    {unidades.map(([id, nome]) => (
                      <option key={id} value={id}>
                        {nome}
                      </option>
                    ))}
                    <option value="sem">Sem unidade de atendimento ({agenda.data.semUnidade})</option>
                  </select>
                  {podeEditar && prontas.length > 0 && (
                    <button
                      type="button"
                      className="sb-btn sb-btn--primary sb-btn--sm"
                      onClick={() => gerarGuias(prontas.map((s) => s.id))}
                      disabled={gerando}
                    >
                      {gerando ? "Gerando…" : `Gerar XML das prontas (${prontas.length})`}
                    </button>
                  )}
                </div>
              </div>
              {podeEditar && marcadas.size > 0 && (
                <div className="barra-lote" role="region" aria-label="Atribuir unidade às sessões selecionadas">
                  <span>
                    <span className="mono">{marcadas.size}</span> sessão(ões) selecionada(s)
                  </span>
                  <select
                    className="sb-input sb-input--sm"
                    value={unidadeDestino}
                    onChange={(e) => setUnidadeDestino(e.target.value)}
                    aria-label="Unidade de atendimento para as sessões selecionadas"
                  >
                    <option value="">Escolha a unidade…</option>
                    {(todasUnidades.data ?? []).map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nome}
                      </option>
                    ))}
                    <option value="remover">Tirar a unidade (volta a valer a do AnClinic)</option>
                  </select>
                  <label className="sb-check">
                    <input type="checkbox" checked={incluirPaciente} onChange={(e) => setIncluirPaciente(e.target.checked)} />
                    Também as outras sessões sem unidade destes pacientes
                  </label>
                  <button type="button" className="sb-btn sb-btn--primary sb-btn--sm" onClick={atribuirUnidade} disabled={!unidadeDestino || aplicando}>
                    {aplicando ? "Aplicando…" : "Aplicar"}
                  </button>
                  <button
                    type="button"
                    className="sb-btn sb-btn--sm"
                    onClick={() => gerarGuias([...marcadas])}
                    disabled={gerando}
                    title="Só as sessões prontas para solicitar viram guia"
                  >
                    {gerando ? "Gerando…" : "Gerar XML das selecionadas"}
                  </button>
                  <button type="button" className="sb-btn sb-btn--sm" onClick={() => setMarcadas(new Set())}>
                    Limpar seleção
                  </button>
                </div>
              )}
              <div className="tabela-rolagem">
                <table className="sb-table">
                  <thead>
                    <tr>
                      {podeEditar && (
                        <th scope="col" className="col-check">
                          <input
                            type="checkbox"
                            aria-label="Selecionar todas as sessões listadas"
                            checked={sessoes.length > 0 && sessoes.every((x) => marcadas.has(x.id))}
                            onChange={(e) => setMarcadas(e.target.checked ? new Set(sessoes.map((x) => x.id)) : new Set())}
                          />
                        </th>
                      )}
                      <th scope="col">Horário</th>
                      <th scope="col">Paciente</th>
                      <th scope="col">Procedimento</th>
                      <th scope="col">Profissional</th>
                      <th scope="col">Unidade</th>
                      <th scope="col">Convênio</th>
                      <th scope="col">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessoes.length === 0 ? (
                      <tr>
                        <td colSpan={podeEditar ? 8 : 7} className="vazio">
                          Nenhuma sessão com esses filtros.
                        </td>
                      </tr>
                    ) : (
                      sessoes.map((s) => (
                        <tr key={s.id}>
                          {podeEditar && (
                            <td className="col-check">
                              <input
                                type="checkbox"
                                checked={marcadas.has(s.id)}
                                onChange={(e) => marcar(s.id, e.target.checked)}
                                aria-label={`Selecionar sessão de ${s.paciente?.nome ?? s.pacienteAnclinic ?? "sem paciente"} às ${s.horaInicio ?? "—"}`}
                              />
                            </td>
                          )}
                          <td className="sb-mono" style={{ whiteSpace: "nowrap" }}>
                            {s.horaInicio ?? "—"}
                            {s.horaFim && `–${s.horaFim}`}
                          </td>
                          <td className="sb-strong">
                            {s.paciente ? <Link href={`/pacientes/${s.paciente.id}`}>{s.paciente.nome}</Link> : s.pacienteAnclinic ?? "—"}
                            {s.carteirinha && <span className="texto-suave mono">{s.carteirinha}</span>}
                          </td>
                          <td>
                            {s.procedimento?.descricao ?? "—"}
                            {s.procedimento && (
                              <span className="texto-suave mono">
                                {s.procedimento.codigoAnclinic}
                                {s.procedimento.codigoGuia && ` · guia ${s.procedimento.codigoGuia}`}
                              </span>
                            )}
                          </td>
                          <td>{s.profissional?.nome ?? "—"}</td>
                          <td>
                            {s.unidade ? s.unidade.nome : <Badge tom="warning">Sem unidade</Badge>}
                            {s.unidadeManual && <span className="texto-suave">definida no sistema</span>}
                          </td>
                          <td>{s.convenio?.nome ?? <span className="texto-suave">{s.convenioAnclinic ?? "—"}</span>}</td>
                          <td>
                            <Badge tom={POR_VALOR[s.situacao].tom}>{POR_VALOR[s.situacao].badge}</Badge>
                            {s.pendencias.length > 0 ? (
                              <ul className="pendencias" style={{ marginTop: 4 }}>
                                {s.pendencias.map((p) => (
                                  <li key={p}>{p}</li>
                                ))}
                              </ul>
                            ) : (
                              s.motivo && <span className="texto-suave">{s.motivo}</span>
                            )}
                            {s.pedeToken && data === hojeISO() && podeEditar && s.situacao !== "cancelada" && (
                              <TokenSessao key={`${s.id}-${s.token ?? ""}`} sessao={s} aoSalvar={agenda.recarregar} />
                            )}
                            {s.guia && (
                              <span className="texto-suave">
                                Guia <span className="mono">{s.guia.numero}</span> ·{" "}
                                <a href={guiaTissService.urlXml(s.guia.id)} download>
                                  XML
                                </a>
                                {s.guia.enviada && ` · ${s.guia.situacao}`}
                                {s.guia.senha && (
                                  <>
                                    {" "}· senha <span className="mono">{s.guia.senha}</span>
                                    {s.guia.validadeSenha && ` até ${formatarData(s.guia.validadeSenha)}`}
                                  </>
                                )}
                              </span>
                            )}
                            {s.guia && (s.guia.glosas.length > 0 || s.guia.erro) && (
                              <ul className="pendencias" style={{ marginTop: 4 }}>
                                {s.guia.erro && <li>{s.guia.erro}</li>}
                                {s.guia.glosas.map((g) => (
                                  <li key={g}>Glosa {g}</li>
                                ))}
                              </ul>
                            )}
                            {s.guia?.podeEnviar && podeEditar && (
                              <button
                                type="button"
                                className="sb-btn sb-btn--sm"
                                style={{ marginTop: 4 }}
                                disabled={enviando !== null}
                                onClick={() => enviarGuia(s.guia!.id)}
                              >
                                {enviando === s.guia.id ? "Enviando…" : s.guia.enviada ? "Reenviar à Amil" : "Enviar à Amil"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )
      )}
    </>
  );
}

export default comUrl(AgendaPage);
