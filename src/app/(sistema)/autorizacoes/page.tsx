"use client";

import Link from "next/link";
import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import { comUrl, tirarNovoDaUrl } from "@/components/ComUrl";
import Icone from "@/components/Icone";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import Paginacao from "@/components/ui/Paginacao";
import StatusBadge, { Badge, rotuloStatus } from "@/components/ui/StatusBadge";
import { useSessao } from "@/contextos/SessaoContexto";
import { diasParaVencimento, formatarData } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch, usePaginacao } from "@/lib/cliente/hooks";
import { autorizacaoService, convenioService, pacienteService } from "@/lib/cliente/servicos";
import { hojeISO } from "@/lib/datas";

const STATUS = ["pendente", "em_analise", "autorizada", "negada", "vencida", "cancelada", "esgotada"];

const formInicial = () => ({
  pacienteId: "",
  convenioId: "",
  procedimento: "",
  codigoProcedimento: "",
  quantidadeSolicitada: "1",
  dataSolicitacao: hojeISO(),
  dataInicioVigencia: "",
  dataFimVigencia: "",
  observacoes: "",
});

function AutorizacoesPage({ url }: { url: URLSearchParams }) {
  const { usuario } = useSessao();
  const [filtroStatus, setFiltroStatus] = useState(url.get("status") ?? "");
  const [vencendoEm, setVencendoEm] = useState(url.get("vencendoEm") ?? "");
  const filtroPaciente = url.get("pacienteId") ?? "";
  const [modalAberto, setModalAberto] = useState(url.get("novo") === "1" && usuario.perfil !== "terapeuta");
  const [form, setForm] = useState(formInicial);
  const [salvando, setSalvando] = useState(false);
  const { pagina, limite, setPagina, resetar } = usePaginacao(20);

  const buscar = useCallback(
    () =>
      autorizacaoService.listar({
        page: pagina,
        limit: limite,
        status: filtroStatus || undefined,
        pacienteId: filtroPaciente || undefined,
        vencendoEm: vencendoEm || undefined,
      }),
    [pagina, limite, filtroStatus, filtroPaciente, vencendoEm],
  );
  const { data, carregando, erro, recarregar } = useFetch(buscar);
  const autorizacoes = data?.data ?? [];

  // Listas do formulário: só carregam quando o modal abre.
  const buscarPacientes = useCallback(
    () => (modalAberto ? pacienteService.listar({ limit: 200, ativo: true }) : Promise.resolve(null)),
    [modalAberto],
  );
  const buscarConvenios = useCallback(
    () => (modalAberto ? convenioService.listar({ ativo: true }) : Promise.resolve(null)),
    [modalAberto],
  );
  const { data: pacientes } = useFetch(buscarPacientes);
  const { data: convenios } = useFetch(buscarConvenios);

  const aoMudar = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const fechar = () => {
    setModalAberto(false);
    tirarNovoDaUrl();
    setForm(formInicial());
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await autorizacaoService.criar(form);
      toast.success("Autorização criada como pendente.");
      fechar();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível criar a autorização."));
    } finally {
      setSalvando(false);
    }
  };

  const campo = (nome: keyof ReturnType<typeof formInicial>, rotulo: string, props: Record<string, unknown> = {}) => (
    <div className="sb-field">
      <label className="sb-label" htmlFor={`aut-${nome}`}>
        {rotulo}
        {"required" in props && (
          <span className="obrigatorio" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input id={`aut-${nome}`} name={nome} className="sb-input" value={form[nome]} onChange={aoMudar} {...props} />
    </div>
  );

  return (
    <>
      <section className="sb-card">
        <div className="sb-card__header">
          <h2 className="sb-card__title">
            Autorizações{" "}
            {data && (
              <span className="texto-suave mono" style={{ fontWeight: 400 }}>
                {data.pagination.total}
              </span>
            )}
          </h2>
          <div className="ferramentas">
            {filtroPaciente && (
              <Link href="/autorizacoes" className="sb-btn sb-btn--ghost">
                <Icone nome="fechar" />
                Filtro por paciente
              </Link>
            )}
            <select
              className="sb-input sb-input--sm"
              value={filtroStatus}
              onChange={(e) => {
                setFiltroStatus(e.target.value);
                resetar();
              }}
              aria-label="Status"
              disabled={!!vencendoEm}
            >
              <option value="">Todos os status</option>
              {STATUS.map((s) => (
                <option key={s} value={s}>
                  {rotuloStatus(s)}
                </option>
              ))}
            </select>
            <select
              className="sb-input sb-input--sm"
              value={vencendoEm}
              onChange={(e) => {
                setVencendoEm(e.target.value);
                resetar();
              }}
              aria-label="Vencimento"
            >
              <option value="">Qualquer vencimento</option>
              <option value="7">Vencendo em 7 dias</option>
              <option value="15">Vencendo em 15 dias</option>
              <option value="30">Vencendo em 30 dias</option>
            </select>
            {usuario.perfil !== "terapeuta" && (
              <button type="button" className="sb-btn sb-btn--primary" onClick={() => setModalAberto(true)}>
                <Icone nome="mais" />
                Nova autorização
              </button>
            )}
          </div>
        </div>

        {carregando ? (
          <Carregando mensagem="Carregando autorizações…" />
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
                    <th scope="col">Paciente</th>
                    <th scope="col">Convênio</th>
                    <th scope="col">Procedimento</th>
                    <th scope="col">Nº autorização</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="sb-end">
                      Sessões
                    </th>
                    <th scope="col" className="sb-end">
                      Fim da vigência
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {autorizacoes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="vazio">
                        Nenhuma autorização encontrada.
                      </td>
                    </tr>
                  ) : (
                    autorizacoes.map((a) => {
                      const dias = diasParaVencimento(a.dataFimVigencia);
                      const vencendo = a.status === "autorizada" && dias !== null && dias >= 0 && dias <= 7;
                      return (
                        <tr key={a.id}>
                          <td className="sb-strong">
                            <Link href={`/autorizacoes/${a.id}`}>{a.paciente?.nome}</Link>
                          </td>
                          <td>{a.convenio?.nome}</td>
                          <td>{a.procedimento}</td>
                          <td className="sb-mono">{a.numeroAutorizacao || "—"}</td>
                          <td>
                            <StatusBadge status={a.status} />
                          </td>
                          <td className="sb-mono sb-end">
                            {a.quantidadeUtilizada}/{a.quantidadeAutorizada ?? a.quantidadeSolicitada}
                          </td>
                          <td className="sb-mono sb-end">
                            {vencendo && (
                              <>
                                <Badge tom="warning">{dias === 0 ? "hoje" : `${dias} d`}</Badge>{" "}
                              </>
                            )}
                            {formatarData(a.dataFimVigencia)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Paginacao
              pagina={pagina}
              totalPaginas={data?.pagination.totalPages ?? 0}
              total={data?.pagination.total}
              onPagina={setPagina}
            />
          </>
        )}
      </section>

      <Modal
        aberto={modalAberto}
        onFechar={fechar}
        titulo="Nova autorização"
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={fechar}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-autorizacao" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        <form id="form-autorizacao" onSubmit={aoEnviar} noValidate>
          <div className="form-grade">
            <div className="sb-field">
              <label className="sb-label" htmlFor="aut-pacienteId">
                Paciente<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <select id="aut-pacienteId" name="pacienteId" className="sb-input" value={form.pacienteId} onChange={aoMudar} required>
                <option value="">Selecione…</option>
                {(pacientes?.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="aut-convenioId">
                Convênio<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <select id="aut-convenioId" name="convenioId" className="sb-input" value={form.convenioId} onChange={aoMudar} required>
                <option value="">Selecione…</option>
                {(convenios ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            {campo("procedimento", "Procedimento", { required: true, placeholder: "Sessão de ABA" })}
            {campo("codigoProcedimento", "Código TUSS")}
            {campo("quantidadeSolicitada", "Sessões solicitadas", { required: true, type: "number", min: 1 })}
            {campo("dataSolicitacao", "Data da solicitação", { type: "date" })}
            {campo("dataInicioVigencia", "Início da vigência", { type: "date" })}
            {campo("dataFimVigencia", "Fim da vigência", { type: "date" })}
            <div className="sb-field inteira">
              <label className="sb-label" htmlFor="aut-observacoes">
                Observações
              </label>
              <textarea id="aut-observacoes" name="observacoes" className="sb-input" rows={2} value={form.observacoes} onChange={aoMudar} />
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default comUrl(AutorizacoesPage);
