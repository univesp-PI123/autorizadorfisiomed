"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { comUrl } from "@/components/ComUrl";
import Icone from "@/components/Icone";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import { Badge } from "@/components/ui/StatusBadge";
import { useSessao } from "@/contextos/SessaoContexto";
import { formatarData } from "@/lib/analiseDados";
import { useFetch } from "@/lib/cliente/hooks";
import { agendaService, convenioService } from "@/lib/cliente/servicos";
import type { SituacaoSessao } from "@/lib/cliente/tipos";
import { hojeISO, somarDias } from "@/lib/datas";

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
  [/TUSS/, "/procedimentos", true],
  [/Profissional sem/, "/profissionais?filtro=incompletos", true],
  [/credenciado/, "/profissionais", true],
  [/código do prestador/, "/convenios", true],
  [/pedido médico/i, "na página do paciente", false],
];
const ondeResolver = (p: string) => {
  const r = ONDE_RESOLVER.find(([re]) => re.test(p));
  return r ? { destino: r[1], link: r[2] } : { destino: "no AnClinic", link: false };
};

function AgendaPage({ url }: { url: URLSearchParams }) {
  const { usuario } = useSessao();
  const [data, setData] = useState(url.get("data") ?? somarDias(hojeISO(), 1));
  const [convenioId, setConvenioId] = useState(url.get("convenioId") ?? "");
  const [situacao, setSituacao] = useState<SituacaoSessao | "">((url.get("situacao") as SituacaoSessao) ?? "");
  const [busca, setBusca] = useState("");

  const buscar = useCallback(() => agendaService.buscar({ data, convenioId: convenioId || undefined }), [data, convenioId]);
  const agenda = useFetch(buscar);
  const convenios = useFetch(convenioService.listar);

  const sessoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (agenda.data?.sessoes ?? []).filter(
      (s) =>
        (!situacao || s.situacao === situacao) &&
        (!termo ||
          [s.paciente?.nome ?? s.pacienteAnclinic, s.profissional?.nome, s.carteirinha]
            .some((v) => v?.toLowerCase().includes(termo))),
    );
  }, [agenda.data, situacao, busca]);

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
              onChange={(e) => e.target.value && setData(e.target.value)}
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
                    O que falta para solicitar
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
                </div>
              </div>
              <div className="tabela-rolagem">
                <table className="sb-table">
                  <thead>
                    <tr>
                      <th scope="col">Horário</th>
                      <th scope="col">Paciente</th>
                      <th scope="col">Procedimento</th>
                      <th scope="col">Profissional</th>
                      <th scope="col">Convênio</th>
                      <th scope="col">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessoes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="vazio">
                          Nenhuma sessão com esses filtros.
                        </td>
                      </tr>
                    ) : (
                      sessoes.map((s) => (
                        <tr key={s.id}>
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
                                {s.procedimento.codigoTuss && ` · TUSS ${s.procedimento.codigoTuss}`}
                              </span>
                            )}
                          </td>
                          <td>
                            {s.profissional?.nome ?? "—"}
                            {s.unidade && <span className="texto-suave">{s.unidade.nome}</span>}
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
