"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import Paginacao from "@/components/ui/Paginacao";
import StatusBadge, { rotuloStatus } from "@/components/ui/StatusBadge";
import { useSessao } from "@/contextos/SessaoContexto";
import { formatarData, formatarMoeda } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch, usePaginacao } from "@/lib/cliente/hooks";
import { atendimentoService, autorizacaoService, pacienteService } from "@/lib/cliente/servicos";
import type { Atendimento, Autorizacao } from "@/lib/cliente/tipos";
import { hojeISO } from "@/lib/datas";

const STATUS_COBRANCA = ["pendente", "faturado", "pago", "glosado", "cancelado"];

const formInicial = () => ({
  pacienteId: "",
  autorizacaoId: "",
  procedimento: "",
  dataAtendimento: hojeISO(),
  horaInicio: "",
  horaFim: "",
  valorCobrado: "",
  evolucao: "",
});

type FormCobranca = { statusCobranca: string; valorCobrado: string; valorPago: string; motivoGlosa: string };

export default function Pagina() {
  return (
    <Suspense fallback={<Carregando />}>
      <PaginaComParametros />
    </Suspense>
  );
}

function PaginaComParametros() {
  const sp = useSearchParams();
  return <AtendimentosPage key={sp.toString()} />;
}

function AtendimentosPage() {
  const sp = useSearchParams();
  const { usuario } = useSessao();
  const podeRegistrar = usuario.perfil !== "financeiro";
  const podeCobrar = usuario.perfil === "admin" || usuario.perfil === "financeiro" || usuario.perfil === "recepcionista";

  const [filtroStatus, setFiltroStatus] = useState(sp.get("statusCobranca") ?? "");
  const [filtroSemAut, setFiltroSemAut] = useState(sp.get("semAutorizacao") ?? "");
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(formInicial);
  const [autsPaciente, setAutsPaciente] = useState<Autorizacao[]>([]);
  const [cobranca, setCobranca] = useState<{ atendimento: Atendimento; form: FormCobranca } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { pagina, limite, setPagina, resetar } = usePaginacao(20);

  const buscar = useCallback(
    () =>
      atendimentoService.listar({
        page: pagina,
        limit: limite,
        statusCobranca: filtroStatus || undefined,
        semAutorizacao: filtroSemAut || undefined,
      }),
    [pagina, limite, filtroStatus, filtroSemAut],
  );
  const { data, carregando, erro, recarregar } = useFetch(buscar);
  const atendimentos = data?.data ?? [];

  const buscarPacientes = useCallback(
    () => (modalAberto ? pacienteService.listar({ limit: 200, ativo: true }) : Promise.resolve(null)),
    [modalAberto],
  );
  const { data: pacientes } = useFetch(buscarPacientes);

  const aoMudar = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Ao escolher o paciente, carrega as autorizações vigentes dele.
  const aoMudarPaciente = async (e: ChangeEvent<HTMLSelectElement>) => {
    const pacienteId = e.target.value;
    setForm((f) => ({ ...f, pacienteId, autorizacaoId: "" }));
    setAutsPaciente([]);
    if (!pacienteId) return;
    try {
      const res = await autorizacaoService.listar({ pacienteId, status: "autorizada", limit: 50 });
      setAutsPaciente(res.data);
    } catch {
      setAutsPaciente([]);
    }
  };

  const fechar = () => {
    setModalAberto(false);
    setForm(formInicial());
    setAutsPaciente([]);
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await atendimentoService.criar(form);
      toast.success(form.autorizacaoId ? "Atendimento registrado!" : "Atendimento registrado SEM autorização.");
      fechar();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Erro ao registrar atendimento."));
    } finally {
      setSalvando(false);
    }
  };

  const abrirCobranca = (a: Atendimento) =>
    setCobranca({
      atendimento: a,
      form: {
        statusCobranca: a.statusCobranca,
        valorCobrado: a.valorCobrado ?? "",
        valorPago: a.valorPago ?? "",
        motivoGlosa: a.motivoGlosa ?? "",
      },
    });

  const aoSalvarCobranca = async (e: FormEvent) => {
    e.preventDefault();
    if (!cobranca) return;
    setSalvando(true);
    try {
      await atendimentoService.atualizar(cobranca.atendimento.id, cobranca.form);
      toast.success("Cobrança atualizada!");
      setCobranca(null);
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Erro ao atualizar cobrança."));
    } finally {
      setSalvando(false);
    }
  };

  const mudarCobranca = (campo: keyof FormCobranca, valor: string) =>
    setCobranca((c) => c && { ...c, form: { ...c.form, [campo]: valor } });

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
          aria-label="Filtrar por cobrança"
          style={{ maxWidth: "200px" }}
        >
          <option value="">Todas as cobranças</option>
          {STATUS_COBRANCA.map((s) => (
            <option key={s} value={s}>
              {rotuloStatus(s)}
            </option>
          ))}
        </select>
        <select
          className="form-control"
          value={filtroSemAut}
          onChange={(e) => {
            setFiltroSemAut(e.target.value);
            resetar();
          }}
          aria-label="Filtrar por autorização"
          style={{ maxWidth: "220px" }}
        >
          <option value="">Com e sem autorização</option>
          <option value="true">Sem autorização</option>
          <option value="false">Com autorização</option>
        </select>
        {podeRegistrar && (
          <button className="btn btn-primary empurra" onClick={() => setModalAberto(true)}>
            + Registrar atendimento
          </button>
        )}
      </div>

      {carregando && <Carregando mensagem="Carregando atendimentos..." />}
      {erro && <MensagemErro mensagem={erro} onRetry={recarregar} />}

      {!carregando && !erro && (
        <>
          <div className="table-container">
            <table aria-label="Lista de atendimentos">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Paciente</th>
                  <th scope="col">Procedimento</th>
                  <th scope="col">Terapeuta</th>
                  <th scope="col">Autorização</th>
                  <th scope="col">Cobrança</th>
                  <th scope="col">Valor</th>
                  {podeCobrar && <th scope="col">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {atendimentos.length === 0 ? (
                  <tr>
                    <td colSpan={podeCobrar ? 8 : 7} className="vazio">
                      Nenhum atendimento encontrado.
                    </td>
                  </tr>
                ) : (
                  atendimentos.map((a) => (
                    <tr key={a.id}>
                      <td>{formatarData(a.dataAtendimento)}</td>
                      <td>
                        <strong>{a.paciente?.nome}</strong>
                      </td>
                      <td>{a.procedimento}</td>
                      <td>{a.terapeuta?.nome || "—"}</td>
                      <td>
                        {a.semAutorizacao ? (
                          <span className="badge badge-danger">Sem autorização</span>
                        ) : (
                          <span className="badge badge-success">Com autorização</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={a.statusCobranca} />
                      </td>
                      <td>{a.valorCobrado ? formatarMoeda(a.valorCobrado) : "—"}</td>
                      {podeCobrar && (
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => abrirCobranca(a)}>
                            Cobrança
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
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
        titulo="Registrar atendimento"
        tamanho="lg"
        rodape={
          <>
            <button className="btn btn-secondary" onClick={fechar}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="form-atendimento" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Registrar"}
            </button>
          </>
        }
      >
        <form id="form-atendimento" onSubmit={aoEnviar} noValidate>
          <div className="grade-form">
            <div className="form-group">
              <label className="form-label" htmlFor="at-paciente">
                Paciente <span className="required">*</span>
              </label>
              <select id="at-paciente" name="pacienteId" className="form-control" value={form.pacienteId} onChange={aoMudarPaciente} required>
                <option value="">Selecione...</option>
                {(pacientes?.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="at-autorizacao">
                Autorização
              </label>
              <select id="at-autorizacao" name="autorizacaoId" className="form-control" value={form.autorizacaoId} onChange={aoMudar}>
                <option value="">Sem autorização vinculada</option>
                {autsPaciente.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.procedimento} — {a.convenio?.nome} ({a.quantidadeUtilizada}/{a.quantidadeAutorizada})
                  </option>
                ))}
              </select>
              {form.pacienteId && !form.autorizacaoId && (
                <span className="form-error">
                  {autsPaciente.length === 0
                    ? "Este paciente não tem autorização vigente: o atendimento ficará sem cobertura."
                    : "Sem autorização vinculada, o atendimento ficará sem cobertura."}
                </span>
              )}
            </div>
            <div className="form-group inteira">
              <label className="form-label" htmlFor="at-procedimento">
                Procedimento <span className="required">*</span>
              </label>
              <input id="at-procedimento" name="procedimento" type="text" className="form-control" value={form.procedimento} onChange={aoMudar} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="at-data">
                Data <span className="required">*</span>
              </label>
              <input id="at-data" name="dataAtendimento" type="date" className="form-control" value={form.dataAtendimento} onChange={aoMudar} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="at-valor">
                Valor cobrado (R$)
              </label>
              <input id="at-valor" name="valorCobrado" type="number" min="0" step="0.01" className="form-control" value={form.valorCobrado} onChange={aoMudar} placeholder="0,00" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="at-inicio">
                Hora de início
              </label>
              <input id="at-inicio" name="horaInicio" type="time" className="form-control" value={form.horaInicio} onChange={aoMudar} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="at-fim">
                Hora de fim
              </label>
              <input id="at-fim" name="horaFim" type="time" className="form-control" value={form.horaFim} onChange={aoMudar} />
            </div>
            <div className="form-group inteira">
              <label className="form-label" htmlFor="at-evolucao">
                Evolução
              </label>
              <textarea id="at-evolucao" name="evolucao" className="form-control" value={form.evolucao} onChange={aoMudar} rows={3} />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={cobranca !== null}
        onFechar={() => setCobranca(null)}
        titulo="Cobrança do atendimento"
        rodape={
          <>
            <button className="btn btn-secondary" onClick={() => setCobranca(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="form-cobranca" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        {cobranca && (
          <form id="form-cobranca" onSubmit={aoSalvarCobranca} noValidate>
            <p className="texto-suave" style={{ marginBottom: "12px" }}>
              {cobranca.atendimento.paciente?.nome} — {cobranca.atendimento.procedimento} em{" "}
              {formatarData(cobranca.atendimento.dataAtendimento)}
            </p>
            <div className="grade-form">
              <div className="form-group inteira">
                <label className="form-label" htmlFor="cob-status">
                  Situação
                </label>
                <select
                  id="cob-status"
                  className="form-control"
                  value={cobranca.form.statusCobranca}
                  onChange={(e) => mudarCobranca("statusCobranca", e.target.value)}
                >
                  {STATUS_COBRANCA.map((s) => (
                    <option key={s} value={s}>
                      {rotuloStatus(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cob-cobrado">
                  Valor cobrado (R$)
                </label>
                <input
                  id="cob-cobrado"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={cobranca.form.valorCobrado}
                  onChange={(e) => mudarCobranca("valorCobrado", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cob-pago">
                  Valor pago (R$)
                </label>
                <input
                  id="cob-pago"
                  type="number"
                  min="0"
                  step="0.01"
                  className="form-control"
                  value={cobranca.form.valorPago}
                  onChange={(e) => mudarCobranca("valorPago", e.target.value)}
                />
              </div>
              {cobranca.form.statusCobranca === "glosado" && (
                <div className="form-group inteira">
                  <label className="form-label" htmlFor="cob-motivo">
                    Motivo da glosa
                  </label>
                  <textarea
                    id="cob-motivo"
                    className="form-control"
                    rows={2}
                    value={cobranca.form.motivoGlosa}
                    onChange={(e) => mudarCobranca("motivoGlosa", e.target.value)}
                  />
                </div>
              )}
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
