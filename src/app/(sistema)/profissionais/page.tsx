"use client";

import { useCallback, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { comUrl } from "@/components/ComUrl";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import Paginacao from "@/components/ui/Paginacao";
import { Badge } from "@/components/ui/StatusBadge";
import { useSessao } from "@/contextos/SessaoContexto";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch, usePaginacao } from "@/lib/cliente/hooks";
import { convenioService, profissionalService } from "@/lib/cliente/servicos";
import type { Profissional } from "@/lib/cliente/tipos";
import { SIGLAS_CONSELHO, UFS } from "@/lib/tiss/dominios";

const formatarCpf = (c: string) => c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

const formDoProfissional = (p: Profissional) => ({
  nome: p.nome,
  cns: p.cns ?? "",
  conselho: p.conselho ?? "",
  numeroConselho: p.numeroConselho ?? "",
  ufConselho: p.ufConselho ?? "",
  cbo: p.cbo ?? "",
  ativo: p.ativo,
  convenioIds: p.credenciamentos.map((c) => c.convenio.id),
});

function ProfissionaisPage({ url }: { url: URLSearchParams }) {
  const { ehAdmin } = useSessao();
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtro, setFiltro] = useState(url.get("filtro") ?? "");
  const [convenioId, setConvenioId] = useState(url.get("convenioId") ?? "");
  const { pagina, limite, setPagina, resetar } = usePaginacao(50);
  const [editando, setEditando] = useState<Profissional | null>(null);
  const [form, setForm] = useState<ReturnType<typeof formDoProfissional> | null>(null);
  const [salvando, setSalvando] = useState(false);

  const buscar = useCallback(
    () =>
      profissionalService.listar({
        page: pagina,
        limit: limite,
        busca: buscaAplicada || undefined,
        filtro: filtro || undefined,
        convenioId: convenioId || undefined,
      }),
    [pagina, limite, buscaAplicada, filtro, convenioId],
  );
  const { data, carregando, erro, recarregar } = useFetch(buscar);
  const convenios = useFetch(convenioService.listar);

  const abrir = (p: Profissional) => {
    setEditando(p);
    setForm(formDoProfissional(p));
  };
  const fechar = () => {
    setEditando(null);
    setForm(null);
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!editando || !form) return;
    setSalvando(true);
    try {
      await profissionalService.atualizar(editando.id, form);
      toast.success("Profissional atualizado.");
      fechar();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  };

  const campo = (nome: "nome" | "cns" | "numeroConselho" | "cbo", rotulo: string, ajuda?: string) =>
    form && (
      <div className={`sb-field ${nome === "nome" ? "inteira" : ""}`}>
        <label className="sb-label" htmlFor={`prof-${nome}`}>
          {rotulo}
        </label>
        <input
          id={`prof-${nome}`}
          className={`sb-input ${nome === "nome" ? "" : "mono"}`}
          inputMode={nome === "nome" ? undefined : "numeric"}
          value={form[nome]}
          onChange={(e) => setForm((f) => f && { ...f, [nome]: e.target.value })}
          aria-describedby={ajuda ? `prof-${nome}-ajuda` : undefined}
        />
        {ajuda && (
          <span id={`prof-${nome}-ajuda`} className="sb-help">
            {ajuda}
          </span>
        )}
      </div>
    );

  return (
    <>
      <section className="sb-card">
        <div className="sb-card__header">
          <h2 className="sb-card__title">
            Profissionais{" "}
            {data && (
              <span className="texto-suave mono" style={{ fontWeight: 400 }}>
                {data.pagination.total}
              </span>
            )}
          </h2>
          <form
            className="ferramentas"
            role="search"
            aria-label="Filtrar profissionais"
            onSubmit={(e) => {
              e.preventDefault();
              setBuscaAplicada(busca.trim());
              resetar();
            }}
          >
            <input
              type="search"
              className="sb-input sb-input--sm"
              placeholder="Nome, CPF ou nº do conselho"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              aria-label="Buscar profissional"
            />
            <select
              className="sb-input sb-input--sm"
              value={filtro}
              onChange={(e) => {
                setFiltro(e.target.value);
                resetar();
              }}
              aria-label="Filtro"
            >
              <option value="">Todos</option>
              <option value="incompletos">Com dados faltando</option>
              {convenioId && <option value="naoCredenciados">Não credenciados no convênio</option>}
            </select>
            <select
              className="sb-input sb-input--sm"
              value={convenioId}
              onChange={(e) => {
                setConvenioId(e.target.value);
                if (!e.target.value && filtro === "naoCredenciados") setFiltro("");
                resetar();
              }}
              aria-label="Credenciados no convênio"
            >
              <option value="">Qualquer convênio</option>
              {(convenios.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  Credenciados: {c.nome}
                </option>
              ))}
            </select>
          </form>
        </div>

        {carregando ? (
          <Carregando mensagem="Carregando profissionais…" />
        ) : erro ? (
          <div className="sb-card__body">
            <MensagemErro mensagem={erro} onRetry={recarregar} />
          </div>
        ) : (
          <>
            <div className="tabela-rolagem">
              <table className="sb-table">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">Conselho</th>
                    <th scope="col">CBO</th>
                    <th scope="col">Credenciado em</th>
                    <th scope="col" className="sb-end">
                      Sessões
                    </th>
                    <th scope="col" className="sb-end">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="vazio">
                        Nenhum profissional encontrado.
                      </td>
                    </tr>
                  ) : (
                    data!.data.map((p) => (
                      <tr key={p.id}>
                        <td className="sb-strong">
                          {p.nome} {!p.ativo && <Badge>Inativo</Badge>}
                          <span className="texto-suave mono">CPF {formatarCpf(p.cpf)}</span>
                        </td>
                        <td className="sb-mono">
                          {p.conselho && p.numeroConselho ? `${p.conselho} ${p.numeroConselho}/${p.ufConselho ?? "?"}` : <Badge tom="warning">Falta</Badge>}
                          {p.especialidades && <span className="texto-suave" style={{ fontFamily: "var(--font-sans)" }}>{p.especialidades}</span>}
                        </td>
                        <td className="sb-mono">{p.cbo ?? <Badge tom="warning">Falta</Badge>}</td>
                        <td>{p.credenciamentos.length ? p.credenciamentos.map((c) => c.convenio.nome).join(", ") : "—"}</td>
                        <td className="sb-mono sb-end">{p._count?.agendamentos ?? 0}</td>
                        <td className="sb-end">
                          {ehAdmin && (
                          <button type="button" className="sb-btn sb-btn--sm" onClick={() => abrir(p)} aria-label={`Editar ${p.nome}`}>
                            Editar
                          </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Paginacao pagina={pagina} totalPaginas={data?.pagination.totalPages ?? 0} total={data?.pagination.total} onPagina={setPagina} />
          </>
        )}
      </section>

      <Modal
        aberto={!!editando}
        onFechar={fechar}
        titulo="Editar profissional"
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={fechar}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-profissional" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        {editando && form && (
          <form id="form-profissional" onSubmit={aoEnviar} noValidate className="pilha">
            <p className="texto-suave mono">CPF {formatarCpf(editando.cpf)}</p>
            <div className="form-grade">
              {campo("nome", "Nome")}
              <div className="sb-field">
                <label className="sb-label" htmlFor="prof-conselho">
                  Conselho
                </label>
                <select
                  id="prof-conselho"
                  className="sb-input"
                  value={form.conselho}
                  onChange={(e) => setForm((f) => f && { ...f, conselho: e.target.value })}
                >
                  <option value="">—</option>
                  {SIGLAS_CONSELHO.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {campo("numeroConselho", "Número no conselho")}
              <div className="sb-field">
                <label className="sb-label" htmlFor="prof-uf">
                  UF do conselho
                </label>
                <select id="prof-uf" className="sb-input" value={form.ufConselho} onChange={(e) => setForm((f) => f && { ...f, ufConselho: e.target.value })}>
                  <option value="">—</option>
                  {UFS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              {campo("cbo", "CBO", "Ex.: 251510 psicólogo clínico, 223810 fonoaudiólogo, 223905 terapeuta ocupacional.")}
              {campo("cns", "CNS (cartão SUS)")}
            </div>
            <fieldset className="sb-field">
              <legend className="sb-label">Credenciado nos convênios</legend>
              <div className="checks">
                {(convenios.data ?? []).map((c) => (
                  <label key={c.id} className="sb-check">
                    <input
                      type="checkbox"
                      checked={form.convenioIds.includes(c.id)}
                      onChange={(e) =>
                        setForm(
                          (f) =>
                            f && {
                              ...f,
                              convenioIds: e.target.checked ? [...f.convenioIds, c.id] : f.convenioIds.filter((id) => id !== c.id),
                            },
                        )
                      }
                    />
                    {c.nome}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="sb-check">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => f && { ...f, ativo: e.target.checked })} />
              Ativo
            </label>
          </form>
        )}
      </Modal>
    </>
  );
}

export default comUrl(ProfissionaisPage);
