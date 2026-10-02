"use client";

// Lista "A solicitar": as sessões da agenda do AnClinic a pedir hoje, já
// agrupadas como vão virar pedidos (paciente + procedimento + unidade). Aqui
// se importa a agenda do dia, se resolve o que falta e se geram os pedidos.

import Link from "next/link";
import { useCallback, useMemo, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { tirarNovoDaUrl } from "@/components/ComUrl";
import Icone from "@/components/Icone";
import ResumoImportacao from "@/components/ResumoImportacao";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import { Badge } from "@/components/ui/StatusBadge";
import { useSessao } from "@/contextos/SessaoContexto";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { autorizacaoService, importacaoService, unidadeService } from "@/lib/cliente/servicos";
import type { GrupoSolicitacao, Importacao, SituacaoSessao } from "@/lib/cliente/tipos";
import { hojeISO } from "@/lib/datas";

type Filtro = "pronta" | "pendente" | "escolar" | "negada" | "pedidas";
type Tom = "warning" | "success" | "danger" | "neutro";

const FILTROS: { valor: Filtro; rotulo: string; situacoes: SituacaoSessao[]; sub: string }[] = [
  { valor: "pronta", rotulo: "Prontas", situacoes: ["pronta"], sub: "entram no próximo pedido" },
  { valor: "pendente", rotulo: "Com pendência", situacoes: ["pendente"], sub: "falta algum dado" },
  { valor: "escolar", rotulo: "Atendimento escolar", situacoes: ["escolar"], sub: "pedir no dia" },
  { valor: "negada", rotulo: "Negadas", situacoes: ["negada"], sub: "tratar a negativa" },
  { valor: "pedidas", rotulo: "Já pedidas", situacoes: ["solicitada", "coberta"], sub: "enviadas ou autorizadas" },
];
const PARA_AGIR: SituacaoSessao[] = ["pronta", "pendente", "escolar", "negada"];

const SITUACAO: Record<SituacaoSessao, { rotulo: string; tom: Tom }> = {
  pronta: { rotulo: "Pronta", tom: "neutro" },
  pendente: { rotulo: "Com pendência", tom: "warning" },
  escolar: { rotulo: "Atendimento escolar", tom: "neutro" },
  negada: { rotulo: "Negada", tom: "danger" },
  solicitada: { rotulo: "Pedida", tom: "neutro" },
  coberta: { rotulo: "Autorizada", tom: "success" },
  fora: { rotulo: "Fora", tom: "neutro" },
  cancelada: { rotulo: "Cancelada", tom: "neutro" },
};

// Onde se resolve cada pendência.
const ONDE_RESOLVER: [RegExp, string, string][] = [
  [/clínica/, "/unidades#clinica", "Dados da clínica"],
  [/Unidade sem CNES/, "/unidades#unidades", "CNES da unidade"],
  [/código para a operadora/, "/procedimentos", "Código do procedimento"],
  [/Profissional sem|credenciado/, "/profissionais", "Cadastro do profissional"],
  [/código do prestador/, "/convenios", "Código do prestador"],
];

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const POR_PAGINA = 50; // linhas mostradas de início; o resto, sob demanda
const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const diaDaSemana = (d: string) => DIAS[new Date(`${d}T00:00:00Z`).getUTCDay()];
const nomeDo = (g: GrupoSolicitacao) => g.paciente?.nome ?? g.pacienteAnclinic ?? "paciente sem cadastro";

function Resolver({ grupo }: { grupo: GrupoSolicitacao }) {
  const links = new Map<string, string>();
  for (const p of grupo.pendencias) {
    if (/pedido médico/i.test(p) && grupo.paciente) links.set(`/pacientes/${grupo.paciente.id}#pedidos`, "Pedido médico");
    const r = ONDE_RESOLVER.find(([re]) => re.test(p));
    if (r) links.set(r[1], r[2]);
  }
  if (!links.size) return grupo.pendencias.some((p) => /carteirinha|Paciente não|Profissional não|Sem procedimento/.test(p)) ? <span className="texto-suave">No AnClinic</span> : null;
  return (
    <ul className="lista-links">
      {[...links].map(([href, rotulo]) => (
        <li key={href}>
          <Link href={href} className="link-texto">
            {rotulo}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ListaDoDia({ aoGerar, importarAoAbrir = false }: { aoGerar: () => void; importarAoAbrir?: boolean }) {
  const { usuario } = useSessao();
  const podeImportar = usuario.perfil === "admin" || usuario.perfil === "recepcionista";
  const [dia, setDia] = useState(hojeISO());
  const [filtro, setFiltro] = useState<Filtro | null>(null);
  const [mostrar, setMostrar] = useState(POR_PAGINA);
  const [gerando, setGerando] = useState<string | null>(null); // "todas" ou a chave do grupo
  const [unidadeEscolhida, setUnidadeEscolhida] = useState<Record<string, string>>({});
  const [importar, setImportar] = useState(importarAoAbrir && podeImportar);
  const [enviando, setEnviando] = useState(false);
  const [importada, setImportada] = useState<Importacao | null>(null);

  const buscar = useCallback(() => autorizacaoService.aSolicitar(dia), [dia]);
  const lista = useFetch(buscar);
  const unidades = useFetch(unidadeService.listar);

  const grupos = useMemo(() => {
    const situacoes = filtro ? FILTROS.find((f) => f.valor === filtro)!.situacoes : PARA_AGIR;
    return (lista.data?.grupos ?? []).filter((g) => situacoes.includes(g.situacao));
  }, [lista.data, filtro]);
  const contagem = (f: (typeof FILTROS)[number]) => {
    const gs = (lista.data?.grupos ?? []).filter((g) => f.situacoes.includes(g.situacao));
    return { pedidos: gs.length, sessoes: gs.reduce((n, g) => n + g.sessoes.length, 0) };
  };
  const prontas = contagem(FILTROS[0]);

  const gerar = async (agendamentoIds?: string[], chave = "todas") => {
    setGerando(chave);
    try {
      const r = await autorizacaoService.gerar({ dia, agendamentoIds });
      const partes = [r.criadas && `${r.criadas} pedido(s) gerado(s)`, r.atualizadas && `${r.atualizadas} atualizado(s)`].filter(Boolean);
      toast.success(partes.length ? `${partes.join(", ")}, com ${r.sessoes} sessão(ões).` : "Nenhuma sessão pronta para pedir.");
      lista.recarregar();
      aoGerar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível gerar os pedidos."));
      lista.recarregar();
    } finally {
      setGerando(null);
    }
  };

  const atribuirUnidade = async (g: GrupoSolicitacao) => {
    const unidadeId = unidadeEscolhida[g.chave];
    if (!unidadeId) return;
    try {
      const r = await unidadeService.atribuir({ ids: g.sessoes.map((s) => s.id), unidadeId });
      toast.success(`Unidade definida em ${r.atualizadas} sessão(ões).`);
      lista.recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível definir a unidade."));
    }
  };

  const enviarAgenda = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size) {
      toast.error("Escolha a planilha .xlsx exportada do AnClinic.");
      return;
    }
    form.set("tipo", "agenda");
    setEnviando(true);
    try {
      setImportada(await importacaoService.enviar(form));
      toast.success("Agenda importada.");
      lista.recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível importar a planilha."));
    } finally {
      setEnviando(false);
    }
  };
  const fecharImportacao = () => {
    setImportar(false);
    setImportada(null);
    tirarNovoDaUrl("importar");
  };

  const d = lista.data;
  const semSessoes = d && Object.values(d.resumo).every((n) => n === 0);

  return (
    <section className="sb-card" id="a-solicitar" aria-labelledby="titulo-a-solicitar">
      <div className="sb-card__header">
        <h2 className="sb-card__title" id="titulo-a-solicitar">
          A solicitar {dia === hojeISO() ? "hoje" : "em"} <span className="mono">{ddmm(dia)}</span>{" "}
          <span className="texto-suave" style={{ fontWeight: 400 }}>
            ({diaDaSemana(dia)})
          </span>
        </h2>
        <div className="ferramentas">
          <input
            type="date"
            className="sb-input sb-input--sm"
            value={dia}
            onChange={(e) => {
              if (!e.target.value) return;
              setDia(e.target.value);
              setMostrar(POR_PAGINA);
            }}
            aria-label="Dia do pedido"
          />
          {podeImportar && (
            <button type="button" className="sb-btn" onClick={() => setImportar(true)}>
              <Icone nome="importar" />
              Importar agenda do dia
            </button>
          )}
          <button
            type="button"
            className="sb-btn sb-btn--primary"
            onClick={() => gerar()}
            disabled={!prontas.pedidos || gerando !== null}
          >
            {gerando === "todas" ? "Gerando…" : prontas.pedidos ? `Gerar ${prontas.pedidos} pedido(s)` : "Gerar pedidos"}
          </button>
        </div>
      </div>

      <div className="sb-card__body pilha">
        <p className="texto-apoio">
          {d && (
            <>
              Sessões de <span className="mono">{d.datas.map(ddmm).join(" e ")}</span>.{" "}
            </>
          )}
          O pedido é feito na véspera; na segunda, pedem-se as de segunda e terça, e na sexta não se pedem as de segunda. O
          atendimento escolar fica para o dia, quando o profissional confirmar que está com a criança.
        </p>

        {lista.carregando && !d ? (
          <Carregando mensagem="Carregando a lista do dia…" />
        ) : lista.erro ? (
          <MensagemErro mensagem={lista.erro} onRetry={lista.recarregar} />
        ) : semSessoes ? (
          <p className="texto-suave">
            Nenhuma sessão de {d!.datas.map(ddmm).join(" e ")} na agenda importada.
            {podeImportar && " Exporte o Relatório de Agendamento do AnClinic e use “Importar agenda do dia”."}
          </p>
        ) : (
          d && (
            <>
              <div className="stats stats--5" role="group" aria-label="Filtrar a lista do dia">
                {FILTROS.map((f) => {
                  const c = contagem(f);
                  return (
                    <button
                      key={f.valor}
                      type="button"
                      className="sb-card sb-stat card-botao"
                      aria-pressed={filtro === f.valor}
                      onClick={() => {
                        setFiltro((atual) => (atual === f.valor ? null : f.valor));
                        setMostrar(POR_PAGINA);
                      }}
                    >
                      <span className="sb-stat__label">{f.rotulo}</span>
                      <span className="sb-stat__value">{c.pedidos}</span>
                      <span className="sb-stat__sub">
                        {c.sessoes} sessão(ões) · {f.sub}
                      </span>
                    </button>
                  );
                })}
              </div>

              {d.pendencias.length > 0 && (
                <details className="detalhes">
                  <summary>O que falta resolver ({d.pendencias.reduce((n, p) => n + p.quantidade, 0)} pendências)</summary>
                  <ul className="lista-simples">
                    {d.pendencias.map((p) => (
                      <li key={p.pendencia}>
                        {p.pendencia} — <span className="mono">{p.quantidade}</span> sessão(ões)
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )
        )}
      </div>

      {d && !semSessoes && (
        <div className="tabela-rolagem">
          <table className="sb-table">
            <caption className="sr-only">
              {filtro ? FILTROS.find((f) => f.valor === filtro)!.rotulo : "Pedidos a fazer"} de {d.datas.map(ddmm).join(" e ")}
            </caption>
            <thead>
              <tr>
                <th scope="col">Paciente</th>
                <th scope="col">Procedimento</th>
                <th scope="col">Unidade</th>
                <th scope="col">Sessões</th>
                <th scope="col">Situação</th>
                <th scope="col" className="sb-end">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {grupos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="vazio">
                    {filtro ? "Nada nesta situação." : "Nada a fazer: todas as sessões do dia já têm pedido ou não precisam."}
                  </td>
                </tr>
              ) : (
                grupos.slice(0, mostrar).map((g) => {
                  const noDia = g.sessoes.every((s) => s.data === dia);
                  const profissionais = [...new Set(g.sessoes.map((s) => s.profissional).filter(Boolean))];
                  return (
                    <tr key={g.chave}>
                      <td className="sb-strong">
                        {g.paciente ? <Link href={`/pacientes/${g.paciente.id}`}>{g.paciente.nome}</Link> : g.pacienteAnclinic ?? "—"}
                        {g.carteirinha && <span className="texto-suave mono">{g.carteirinha}</span>}
                      </td>
                      <td>
                        {g.procedimento?.descricao ?? "—"}
                        <span className="texto-suave">
                          {g.convenio?.nome}
                          {g.procedimento?.codigoGuia && <span className="mono"> · guia {g.procedimento.codigoGuia}</span>}
                        </span>
                      </td>
                      <td>
                        {g.unidade ? (
                          g.unidade.nome
                        ) : podeImportar && g.situacao === "pendente" ? (
                          <div className="unidade-rapida">
                            <select
                              className="sb-input sb-input--sm"
                              value={unidadeEscolhida[g.chave] ?? ""}
                              onChange={(e) => setUnidadeEscolhida((u) => ({ ...u, [g.chave]: e.target.value }))}
                              aria-label={`Unidade das sessões de ${nomeDo(g)}`}
                            >
                              <option value="">Escolha…</option>
                              {(unidades.data ?? []).map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.nome}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="sb-btn sb-btn--sm"
                              onClick={() => atribuirUnidade(g)}
                              disabled={!unidadeEscolhida[g.chave]}
                              aria-label={`Definir a unidade das sessões de ${nomeDo(g)}`}
                            >
                              Definir
                            </button>
                          </div>
                        ) : (
                          <Badge tom="warning">Sem unidade</Badge>
                        )}
                      </td>
                      <td>
                        <ul className="sessoes-lista">
                          {g.sessoes.map((s) => (
                            <li key={s.id} className="mono">
                              {ddmm(s.data)} {s.horaInicio ?? ""}
                            </li>
                          ))}
                        </ul>
                        {profissionais.length > 0 && <span className="texto-suave">{profissionais.join(", ")}</span>}
                      </td>
                      <td>
                        <Badge tom={SITUACAO[g.situacao].tom}>{SITUACAO[g.situacao].rotulo}</Badge>
                        {g.pendencias.length > 0 ? (
                          <ul className="pendencias" style={{ marginTop: 4 }}>
                            {g.pendencias.map((p) => (
                              <li key={p}>{p}</li>
                            ))}
                          </ul>
                        ) : (
                          g.motivo && <span className="texto-suave">{g.motivo}</span>
                        )}
                      </td>
                      <td className="sb-end">
                        {g.situacao === "pendente" && <Resolver grupo={g} />}
                        {g.situacao === "escolar" &&
                          (g.pendencias.length ? (
                            <Resolver grupo={g} />
                          ) : noDia ? (
                            <button
                              type="button"
                              className="sb-btn sb-btn--sm"
                              onClick={() => gerar(g.sessoes.map((s) => s.id), g.chave)}
                              disabled={gerando !== null}
                              aria-label={`Pedir agora a autorização do atendimento escolar de ${nomeDo(g)}`}
                            >
                              {gerando === g.chave ? "Pedindo…" : "Pedir agora"}
                            </button>
                          ) : (
                            <span className="texto-suave">Pedir no dia {ddmm(g.sessoes[0].data)}</span>
                          ))}
                        {g.situacao === "negada" && (
                          <div className="acoes-linha">
                            {g.autorizacaoId && (
                              <Link href={`/autorizacoes/${g.autorizacaoId}`} className="link-texto">
                                Ver negativa
                              </Link>
                            )}
                            {!g.pendencias.length && (
                              <button
                                type="button"
                                className="sb-btn sb-btn--sm"
                                onClick={() => gerar(g.sessoes.map((s) => s.id), g.chave)}
                                disabled={gerando !== null}
                                aria-label={`Pedir de novo a autorização de ${nomeDo(g)}`}
                              >
                                {gerando === g.chave ? "Pedindo…" : "Pedir de novo"}
                              </button>
                            )}
                          </div>
                        )}
                        {(g.situacao === "solicitada" || g.situacao === "coberta") && g.autorizacaoId && (
                          <Link href={`/autorizacoes/${g.autorizacaoId}`} className="link-texto">
                            Ver pedido
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {grupos.length > mostrar && (
            <div className="sb-card__body mais-linhas">
              <span className="texto-suave">
                Mostrando <span className="mono">{mostrar}</span> de <span className="mono">{grupos.length}</span>.
              </span>
              <button type="button" className="sb-btn sb-btn--sm" onClick={() => setMostrar((n) => n + POR_PAGINA * 4)}>
                Mostrar mais
              </button>
            </div>
          )}
        </div>
      )}

      <Modal
        aberto={importar}
        onFechar={fecharImportacao}
        titulo={importada ? `Agenda importada — ${importada.arquivoNome}` : "Importar agenda do dia"}
        tamanho={importada ? "xl" : "md"}
        rodape={
          importada ? (
            <button type="button" className="sb-btn sb-btn--primary" onClick={fecharImportacao}>
              Ver a lista do dia
            </button>
          ) : (
            <>
              <button type="button" className="sb-btn" onClick={fecharImportacao}>
                Cancelar
              </button>
              <button type="submit" className="sb-btn sb-btn--primary" form="form-agenda-dia" disabled={enviando}>
                <Icone nome="importar" />
                {enviando ? "Importando…" : "Importar"}
              </button>
            </>
          )
        }
      >
        {importada ? (
          <ResumoImportacao importacao={importada} />
        ) : (
          <form id="form-agenda-dia" className="pilha" onSubmit={enviarAgenda} noValidate>
            <p className="texto-apoio">
              No AnClinic, exporte o <strong style={{ fontWeight: 500 }}>Relatório de Agendamento</strong> em Excel com todas as
              unidades, de hoje e amanhã. Importar de novo atualiza as sessões; pedidos ainda não enviados acompanham as
              mudanças.
            </p>
            <div className="sb-field">
              <label className="sb-label" htmlFor="agenda-dia-arquivo">
                Planilha (.xlsx)
              </label>
              <input
                id="agenda-dia-arquivo"
                name="arquivo"
                type="file"
                className="arquivo"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
              />
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
