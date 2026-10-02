"use client";

import { useCallback, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Icone from "@/components/Icone";
import ResumoImportacao from "@/components/ResumoImportacao";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import Paginacao from "@/components/ui/Paginacao";
import { Badge } from "@/components/ui/StatusBadge";
import { useSessao } from "@/contextos/SessaoContexto";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch, usePaginacao } from "@/lib/cliente/hooks";
import { convenioService, importacaoService, procedimentoService } from "@/lib/cliente/servicos";
import type { Importacao, Procedimento } from "@/lib/cliente/tipos";
import { MODELO_TABELA_OPERADORA } from "@/lib/importacao/tabelas";

type Aba = "equivalencias" | "operadora" | "tuss";

const FORM_VAZIO = { descricao: "", codigoTuss: "", tabelaTuss: "22", ativo: true, eqCodigo: "", eqDescricao: "", eqTabela: "22", eqCodigoTuss: "" };

function baixarModelo() {
  const blob = new Blob(["﻿" + MODELO_TABELA_OPERADORA], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "modelo-tabela-operadora.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Lista paginada com busca (tabela da operadora ou TUSS). */
function ListaBusca<T>({
  buscar,
  vazio,
  cabecalho,
  linha,
}: {
  buscar: (p: { page: number; limit: number; busca?: string }) => Promise<{ data: T[]; pagination: { total: number; totalPages: number } }>;
  vazio: string;
  cabecalho: React.ReactNode;
  linha: (item: T) => React.ReactNode;
}) {
  const [busca, setBusca] = useState("");
  const [aplicada, setAplicada] = useState("");
  const { pagina, limite, setPagina, resetar } = usePaginacao(50);
  const fn = useCallback(() => buscar({ page: pagina, limit: limite, busca: aplicada || undefined }), [buscar, pagina, limite, aplicada]);
  const { data, carregando, erro, recarregar } = useFetch(fn);
  return (
    <>
      <form
        className="sb-card__body ferramentas"
        role="search"
        aria-label="Buscar na tabela de procedimentos"
        onSubmit={(e) => {
          e.preventDefault();
          setAplicada(busca.trim());
          resetar();
        }}
      >
        <input type="search" className="sb-input sb-input--sm" placeholder="Código ou descrição" value={busca} onChange={(e) => setBusca(e.target.value)} aria-label="Buscar na tabela" />
        <button type="submit" className="sb-btn sb-btn--sm">
          Buscar
        </button>
        {data && <span className="texto-suave mono empurra">{data.pagination.total} código(s)</span>}
      </form>
      {carregando ? (
        <Carregando />
      ) : erro ? (
        <div className="sb-card__body">
          <MensagemErro mensagem={erro} onRetry={recarregar} />
        </div>
      ) : (
        <>
          <div className="tabela-rolagem">
            <table className="sb-table">
              <thead>{cabecalho}</thead>
              <tbody>
                {(data?.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="vazio">
                      {vazio}
                    </td>
                  </tr>
                ) : (
                  data!.data.map(linha)
                )}
              </tbody>
            </table>
          </div>
          <Paginacao pagina={pagina} totalPaginas={data?.pagination.totalPages ?? 0} total={data?.pagination.total} onPagina={setPagina} />
        </>
      )}
    </>
  );
}

export default function ProcedimentosPage() {
  const { usuario } = useSessao();
  const podeEditar = usuario.perfil === "admin" || usuario.perfil === "recepcionista";
  const convenios = useFetch(convenioService.listar);
  const [escolhido, setConvenioId] = useState("");
  const [aba, setAba] = useState<Aba>("equivalencias");
  const [editando, setEditando] = useState<Procedimento | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [termo, setTermo] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [importar, setImportar] = useState(false);
  const [tipoImp, setTipoImp] = useState<"tabela_operadora" | "tuss">("tabela_operadora");
  const [resultado, setResultado] = useState<Importacao | null>(null);

  // Operadora padrão: a primeira com envio automático, senão a primeira.
  const lista = convenios.data ?? [];
  const convenioId = escolhido || (lista.find((c) => c.integracao !== "manual") ?? lista[0])?.id || "";
  const convenio = convenios.data?.find((c) => c.id === convenioId);

  const buscar = useCallback(() => procedimentoService.listar(convenioId || undefined), [convenioId]);
  const { data, carregando, erro, recarregar } = useFetch(buscar);
  const buscarOperadora = useCallback(
    (p: { page: number; limit: number; busca?: string }) => procedimentoService.operadora({ ...p, convenioId }),
    [convenioId],
  );

  const abrir = (p: Procedimento) => {
    setEditando(p);
    setTermo(p.termoTuss ?? null);
    const e = p.equivalencia;
    setForm({
      descricao: p.descricao,
      codigoTuss: p.codigoTuss ?? "",
      tabelaTuss: p.tabelaTuss ?? "22",
      ativo: p.ativo,
      eqCodigo: e?.codigo ?? "",
      eqDescricao: e?.descricao ?? "",
      eqTabela: e?.tabela ?? "22",
      eqCodigoTuss: e?.codigoTuss ?? "",
    });
  };

  const consultarTermo = async (codigo: string) => {
    if (!/^\d{8,10}$/.test(codigo)) return setTermo(null);
    try {
      const r = await procedimentoService.tuss({ busca: codigo, limit: 1 });
      setTermo(r.data[0]?.codigo === codigo ? r.data[0].termo : "Código não encontrado na tabela TUSS importada.");
    } catch {
      setTermo(null);
    }
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!editando) return;
    setSalvando(true);
    try {
      await procedimentoService.atualizar(editando.id, {
        descricao: form.descricao,
        codigoTuss: form.codigoTuss,
        tabelaTuss: form.tabelaTuss,
        ativo: form.ativo,
        ...(convenioId && {
          equivalencia: {
            convenioId,
            codigo: form.eqCodigo,
            descricao: form.eqDescricao,
            tabela: form.eqTabela,
            codigoTuss: form.eqCodigoTuss || form.codigoTuss,
          },
        }),
      });
      toast.success("Procedimento atualizado.");
      setEditando(null);
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  };

  const aoImportar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const arquivo = fd.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size) {
      toast.error("Selecione a planilha.");
      return;
    }
    fd.set("tipo", tipoImp);
    if (tipoImp === "tabela_operadora") fd.set("convenioId", convenioId);
    setSalvando(true);
    try {
      setResultado(await importacaoService.enviar(fd));
      toast.success("Tabela importada.");
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível importar a tabela."));
    } finally {
      setSalvando(false);
    }
  };

  const semCodigo = (data ?? []).filter((p) => p.ativo && !p.equivalencia && !p.codigoTuss).length;
  const campoForm = (nome: keyof typeof FORM_VAZIO, rotulo: string, props: Record<string, unknown> = {}) => (
    <div className="sb-field">
      <label className="sb-label" htmlFor={`proc-${nome}`}>
        {rotulo}
      </label>
      <input
        id={`proc-${nome}`}
        className={`sb-input ${nome === "descricao" || nome === "eqDescricao" ? "" : "mono"}`}
        value={String(form[nome])}
        onChange={(e) => setForm((f) => ({ ...f, [nome]: e.target.value }))}
        {...props}
      />
    </div>
  );

  const abas: [Aba, string][] = [
    ["equivalencias", "Equivalências"],
    ["operadora", convenio ? `Tabela ${convenio.nome}` : "Tabela da operadora"],
    ["tuss", "TUSS (tabela 22)"],
  ];

  return (
    <>
      <section className="sb-card">
        <div className="sb-card__header">
          <h2 className="sb-card__title">Procedimentos</h2>
          <div className="ferramentas">
            {semCodigo > 0 && <Badge tom="warning">{semCodigo} sem código para a operadora</Badge>}
            <select className="sb-input sb-input--sm" value={convenioId} onChange={(e) => setConvenioId(e.target.value)} aria-label="Operadora">
              {(convenios.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {podeEditar && (
              <button type="button" className="sb-btn sb-btn--primary" onClick={() => setImportar(true)}>
                <Icone nome="importar" />
                Importar tabela
              </button>
            )}
          </div>
        </div>
        <div className="abas" role="tablist" aria-label="Tabelas de procedimentos">
          {abas.map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`aba-${id}`}
              aria-selected={aba === id}
              aria-controls={`painel-${id}`}
              className="aba"
              onClick={() => setAba(id)}
            >
              {rotulo}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
          {aba === "equivalencias" &&
            (carregando ? (
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
                      <th scope="col">AnClinic</th>
                      <th scope="col">{convenio ? `Operadora (${convenio.nome})` : "Operadora"}</th>
                      <th scope="col">TUSS 22</th>
                      <th scope="col">Na guia</th>
                      <th scope="col" className="sb-end">
                        Sessões
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
                          Nenhum procedimento ainda. Importe uma agenda do AnClinic ou a tabela da operadora.
                        </td>
                      </tr>
                    ) : (
                      data!.map((p) => {
                        const guia = p.equivalencia?.codigo ?? p.codigoTuss;
                        return (
                          <tr key={p.id}>
                            <td className="sb-strong">
                              <span className="mono">{p.codigoAnclinic}</span> {p.descricao} {!p.ativo && <Badge>Inativo</Badge>}
                            </td>
                            <td>
                              {p.equivalencia ? (
                                <>
                                  <span className="mono">{p.equivalencia.codigo}</span> {p.equivalencia.descricao}
                                </>
                              ) : (
                                <span className="texto-suave">—</span>
                              )}
                            </td>
                            <td>
                              {p.codigoTuss ? (
                                <>
                                  <span className="mono">{p.codigoTuss}</span>
                                  {p.termoTuss && <span className="texto-suave">{p.termoTuss}</span>}
                                </>
                              ) : (
                                <span className="texto-suave">—</span>
                              )}
                            </td>
                            <td className="sb-mono">{guia ?? <Badge tom="warning">Falta</Badge>}</td>
                            <td className="sb-mono sb-end">{p._count?.agendamentos ?? 0}</td>
                            {podeEditar && (
                              <td className="sb-end">
                                <button type="button" className="sb-btn sb-btn--sm" onClick={() => abrir(p)} aria-label={`Editar ${p.descricao}`}>
                                  Editar
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          {aba === "operadora" && convenioId && (
            <ListaBusca
              key={convenioId}
              buscar={buscarOperadora}
              vazio="Tabela desta operadora ainda não importada."
              cabecalho={
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Descrição</th>
                  <th scope="col">TUSS</th>
                  <th scope="col">Tabela</th>
                  <th scope="col">AnClinic</th>
                </tr>
              }
              linha={(o) => (
                <tr key={o.id}>
                  <td className="sb-mono">{o.codigo}</td>
                  <td>{o.descricao}</td>
                  <td className="sb-mono">{o.codigoTuss ?? "—"}</td>
                  <td className="sb-mono">{o.tabela}</td>
                  <td>{o.procedimento ? `${o.procedimento.codigoAnclinic} ${o.procedimento.descricao}` : "—"}</td>
                </tr>
              )}
            />
          )}
          {aba === "tuss" && (
            <ListaBusca
              buscar={procedimentoService.tuss}
              vazio="Tabela TUSS ainda não importada. Baixe a Tabela 22 no site da ANS e importe aqui."
              cabecalho={
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Termo</th>
                </tr>
              }
              linha={(t) => (
                <tr key={t.codigo}>
                  <td className="sb-mono">{t.codigo}</td>
                  <td>{t.termo}</td>
                </tr>
              )}
            />
          )}
        </div>
      </section>

      <Modal
        aberto={!!editando}
        onFechar={() => setEditando(null)}
        titulo={editando ? `Procedimento ${editando.codigoAnclinic}` : ""}
        tamanho="lg"
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
          <h3 className="subtitulo">AnClinic e TUSS</h3>
          <div className="form-grade">
            <div className="inteira">{campoForm("descricao", "Descrição")}</div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="proc-codigoTuss">
                Código TUSS (tabela 22)
              </label>
              <input
                id="proc-codigoTuss"
                inputMode="numeric"
                className="sb-input mono"
                value={form.codigoTuss}
                onChange={(e) => setForm((f) => ({ ...f, codigoTuss: e.target.value }))}
                onBlur={(e) => consultarTermo(e.target.value.trim())}
                aria-describedby="proc-termo"
              />
              <span id="proc-termo" className="sb-help" aria-live="polite">
                {termo ?? "8 dígitos."}
              </span>
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="proc-tabelaTuss">
                Tabela
              </label>
              <select id="proc-tabelaTuss" className="sb-input" value={form.tabelaTuss} onChange={(e) => setForm((f) => ({ ...f, tabelaTuss: e.target.value }))}>
                <option value="22">22 — Procedimentos e eventos (TUSS)</option>
                <option value="98">98 — Tabela própria de pacotes</option>
                <option value="00">00 — Tabela própria da operadora</option>
              </select>
            </div>
          </div>
          {convenio && (
            <>
              <h3 className="subtitulo">Na tabela da {convenio.nome}</h3>
              <div className="form-grade">
                {campoForm("eqCodigo", "Código na operadora", { "aria-describedby": "proc-eq-ajuda" })}
                <div className="inteira">{campoForm("eqDescricao", "Descrição na operadora")}</div>
                <span id="proc-eq-ajuda" className="sb-help inteira">
                  Deixe o código em branco para desfazer a equivalência. Sem ela, a guia usa o código TUSS.
                </span>
              </div>
            </>
          )}
          <label className="sb-check">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
            Ativo
          </label>
        </form>
      </Modal>

      <Modal
        aberto={importar}
        onFechar={() => {
          setImportar(false);
          setResultado(null);
        }}
        titulo="Importar tabela de procedimentos"
        tamanho={resultado ? "xl" : "md"}
        rodape={
          resultado ? (
            <button
              type="button"
              className="sb-btn"
              onClick={() => {
                setImportar(false);
                setResultado(null);
              }}
            >
              Fechar
            </button>
          ) : (
            <>
              <button type="button" className="sb-btn" onClick={() => setImportar(false)}>
                Cancelar
              </button>
              <button type="submit" className="sb-btn sb-btn--primary" form="form-importar-tabela" disabled={salvando}>
                {salvando ? "Importando…" : "Importar"}
              </button>
            </>
          )
        }
      >
        {resultado ? (
          <ResumoImportacao importacao={resultado} />
        ) : (
          <form id="form-importar-tabela" onSubmit={aoImportar} className="pilha">
            <fieldset className="sb-field">
              <legend className="sb-label">Tabela</legend>
              <div className="checks">
                <label className="sb-check">
                  <input type="radio" name="tipoImp" checked={tipoImp === "tabela_operadora"} onChange={() => setTipoImp("tabela_operadora")} />
                  Tabela da operadora ({convenio?.nome ?? "—"}) com o de/para
                </label>
                <label className="sb-check">
                  <input type="radio" name="tipoImp" checked={tipoImp === "tuss"} onChange={() => setTipoImp("tuss")} />
                  TUSS — tabela 22 da ANS
                </label>
              </div>
            </fieldset>
            <p className="texto-apoio">
              {tipoImp === "tabela_operadora" ? (
                <>
                  Colunas: <span className="mono">Código AnClinic</span> (opcional, faz o de/para),{" "}
                  <span className="mono">Código Operadora</span>, <span className="mono">Descrição Operadora</span>,{" "}
                  <span className="mono">Código TUSS</span> e <span className="mono">Tabela</span>.
                  Reimportar atualiza pelo código da operadora.{" "}
                  <button type="button" className="link-botao" onClick={baixarModelo}>
                    Baixar modelo (.csv)
                  </button>
                </>
              ) : (
                <>
                  Planilha da Tabela 22 publicada pela ANS, com as colunas <span className="mono">Código do Termo</span> e{" "}
                  <span className="mono">Termo</span>.
                </>
              )}
            </p>
            <div className="sb-field">
              <label className="sb-label" htmlFor="imp-tabela-arquivo">
                Planilha (.xlsx ou .csv)
              </label>
              <input id="imp-tabela-arquivo" name="arquivo" type="file" className="arquivo" accept=".xlsx,.csv" required />
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
