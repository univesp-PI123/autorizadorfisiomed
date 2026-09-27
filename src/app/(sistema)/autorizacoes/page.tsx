"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import Paginacao from "@/components/ui/Paginacao";
import StatusBadge, { rotuloStatus } from "@/components/ui/StatusBadge";
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

// Os filtros iniciais vêm da URL (links do dashboard, do alerta e do paciente).
// A chave força recriar a tela quando a URL muda estando nela.
export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <PaginaComParametros />
    </Suspense>
  );
}

function PaginaComParametros() {
  const sp = useSearchParams();
  return <AutorizacoesPage key={sp.toString()} />;
}

function AutorizacoesPage() {
  const sp = useSearchParams();
  const [filtroStatus, setFiltroStatus] = useState(sp.get("status") ?? "");
  const [vencendoEm, setVencendoEm] = useState(sp.get("vencendoEm") ?? "");
  const filtroPaciente = sp.get("pacienteId") ?? "";
  const [modalAberto, setModalAberto] = useState(false);
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

  // Listas para o formulário: só carregam quando o modal abre.
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
    setForm(formInicial());
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await autorizacaoService.criar(form);
      toast.success("Autorização criada com sucesso!");
      fechar();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Erro ao criar autorização."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div className="barra-acoes">
        <select
          className="form-control"
          value={filtroStatus}
          onChange={(e) => {
            setFiltroStatus(e.target.value);
            resetar();
          }}
          aria-label="Filtrar por status"
          style={{ maxWidth: "180px" }}
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
          className="form-control"
          value={vencendoEm}
          onChange={(e) => {
            setVencendoEm(e.target.value);
            resetar();
          }}
          aria-label="Filtrar por vencimento"
          style={{ maxWidth: "200px" }}
        >
          <option value="">Todos os vencimentos</option>
          <option value="7">Vencendo em 7 dias</option>
          <option value="15">Vencendo em 15 dias</option>
          <option value="30">Vencendo em 30 dias</option>
        </select>

        {filtroPaciente && (
          <Link href="/autorizacoes" className="btn btn-ghost btn-sm">
            ✕ Filtro por paciente
          </Link>
        )}

        <button className="btn btn-primary empurra" onClick={() => setModalAberto(true)}>
          + Nova autorização
        </button>
      </div>

      {carregando && <Carregando mensagem="Carregando autorizações..." />}
      {erro && <MensagemErro mensagem={erro} onRetry={recarregar} />}

      {!carregando && !erro && (
        <>
          <div className="table-container">
            <table aria-label="Lista de autorizações">
              <thead>
                <tr>
                  <th scope="col">Paciente</th>
                  <th scope="col">Convênio</th>
                  <th scope="col">Procedimento</th>
                  <th scope="col">Nº autorização</th>
                  <th scope="col">Fim da vigência</th>
                  <th scope="col">Sessões</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {autorizacoes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="vazio">
                      Nenhuma autorização encontrada.
                    </td>
                  </tr>
                ) : (
                  autorizacoes.map((a) => {
                    const dias = diasParaVencimento(a.dataFimVigencia);
                    return (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.paciente?.nome}</strong>
                        </td>
                        <td>{a.convenio?.nome}</td>
                        <td>{a.procedimento}</td>
                        <td>{a.numeroAutorizacao || "—"}</td>
                        <td>
                          {formatarData(a.dataFimVigencia)}
                          {a.status === "autorizada" && dias !== null && dias >= 0 && dias <= 7 && (
                            <span className="badge badge-danger" style={{ marginLeft: "6px" }} title={`Vence em ${dias} dia(s)`}>
                              {dias}d
                            </span>
                          )}
                        </td>
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
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <Paginacao pagina={pagina} totalPaginas={data?.pagination.totalPages ?? 0} onPagina={setPagina} />
        </>
      )}

      <Modal
        aberto={modalAberto}
        onFechar={fechar}
        titulo="Nova autorização"
        tamanho="lg"
        rodape={
          <>
            <button className="btn btn-secondary" onClick={fechar}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="form-autorizacao" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        <form id="form-autorizacao" onSubmit={aoEnviar} noValidate>
          <div className="grade-form">
            <div className="form-group">
              <label className="form-label" htmlFor="aut-paciente">
                Paciente <span className="required">*</span>
              </label>
              <select id="aut-paciente" name="pacienteId" className="form-control" value={form.pacienteId} onChange={aoMudar} required>
                <option value="">Selecione...</option>
                {(pacientes?.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="aut-convenio">
                Convênio <span className="required">*</span>
              </label>
              <select id="aut-convenio" name="convenioId" className="form-control" value={form.convenioId} onChange={aoMudar} required>
                <option value="">Selecione...</option>
                {(convenios ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="aut-procedimento">
                Procedimento <span className="required">*</span>
              </label>
              <input id="aut-procedimento" name="procedimento" type="text" className="form-control" value={form.procedimento} onChange={aoMudar} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="aut-codigo">
                Código TUSS
              </label>
              <input id="aut-codigo" name="codigoProcedimento" type="text" className="form-control" value={form.codigoProcedimento} onChange={aoMudar} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="aut-qtd">
                Quantidade solicitada <span className="required">*</span>
              </label>
              <input id="aut-qtd" name="quantidadeSolicitada" type="number" min="1" className="form-control" value={form.quantidadeSolicitada} onChange={aoMudar} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="aut-data">
                Data da solicitação
              </label>
              <input id="aut-data" name="dataSolicitacao" type="date" className="form-control" value={form.dataSolicitacao} onChange={aoMudar} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="aut-inicio">
                Início da vigência
              </label>
              <input id="aut-inicio" name="dataInicioVigencia" type="date" className="form-control" value={form.dataInicioVigencia} onChange={aoMudar} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="aut-fim">
                Fim da vigência
              </label>
              <input id="aut-fim" name="dataFimVigencia" type="date" className="form-control" value={form.dataFimVigencia} onChange={aoMudar} />
            </div>
            <div className="form-group inteira">
              <label className="form-label" htmlFor="aut-obs">
                Observações
              </label>
              <textarea id="aut-obs" name="observacoes" className="form-control" value={form.observacoes} onChange={aoMudar} rows={2} />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
