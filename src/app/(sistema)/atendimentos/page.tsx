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

function AtendimentosPage({ url }: { url: URLSearchParams }) {
  const { usuario } = useSessao();
  const podeRegistrar = usuario.perfil !== "financeiro";
  const podeCobrar = usuario.perfil !== "terapeuta";

  const [filtroStatus, setFiltroStatus] = useState(url.get("statusCobranca") ?? "");
  const [filtroSemAut, setFiltroSemAut] = useState(url.get("semAutorizacao") ?? "");
  const [modalAberto, setModalAberto] = useState(podeRegistrar && url.get("novo") === "1");
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
    tirarNovoDaUrl();
    setForm(formInicial());
    setAutsPaciente([]);
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await atendimentoService.criar(form);
      toast.success(form.autorizacaoId ? "Atendimento registrado." : "Atendimento registrado sem autorização.");
      fechar();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível registrar o atendimento."));
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
      toast.success("Cobrança atualizada.");
      setCobranca(null);
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível atualizar a cobrança."));
    } finally {
      setSalvando(false);
    }
  };

  const mudarCobranca = (campo: keyof FormCobranca, valor: string) =>
    setCobranca((c) => c && { ...c, form: { ...c.form, [campo]: valor } });

  const colunas = podeCobrar ? 8 : 7;

  return (
    <>
      <section className="sb-card">
        <div className="sb-card__header">
          <h2 className="sb-card__title">
            Atendimentos{" "}
            {data && (
              <span className="texto-suave mono" style={{ fontWeight: 400 }}>
                {data.pagination.total}
              </span>
            )}
          </h2>
          <div className="ferramentas">
            <select
              className="sb-input sb-input--sm"
              value={filtroStatus}
              onChange={(e) => {
                setFiltroStatus(e.target.value);
                resetar();
              }}
              aria-label="Cobrança"
            >
              <option value="">Todas as cobranças</option>
              {STATUS_COBRANCA.map((s) => (
                <option key={s} value={s}>
                  {rotuloStatus(s)}
                </option>
              ))}
            </select>
            <select
              className="sb-input sb-input--sm"
              value={filtroSemAut}
              onChange={(e) => {
                setFiltroSemAut(e.target.value);
                resetar();
              }}
              aria-label="Autorização"
            >
              <option value="">Com e sem autorização</option>
              <option value="true">Sem autorização</option>
              <option value="false">Com autorização</option>
            </select>
            {podeRegistrar && (
              <button type="button" className="sb-btn sb-btn--primary" onClick={() => setModalAberto(true)}>
                <Icone nome="mais" />
                Registrar atendimento
              </button>
            )}
          </div>
        </div>

        {carregando ? (
          <Carregando mensagem="Carregando atendimentos…" />
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
                    <th scope="col">Data</th>
                    <th scope="col">Paciente</th>
                    <th scope="col">Procedimento</th>
                    <th scope="col">Terapeuta</th>
                    <th scope="col">Autorização</th>
                    <th scope="col">Cobrança</th>
                    <th scope="col" className="sb-end">
                      Valor
                    </th>
                    {podeCobrar && (
                      <th scope="col" className="sb-end">
                        <span className="sr-only">Ações</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {atendimentos.length === 0 ? (
                    <tr>
                      <td colSpan={colunas} className="vazio">
                        Nenhum atendimento encontrado.
                      </td>
                    </tr>
                  ) : (
                    atendimentos.map((a) => (
                      <tr key={a.id}>
                        <td className="sb-mono">{formatarData(a.dataAtendimento)}</td>
                        <td className="sb-strong">
                          <Link href={`/pacientes/${a.pacienteId}`}>{a.paciente?.nome}</Link>
                        </td>
                        <td>{a.procedimento}</td>
                        <td>{a.terapeuta?.nome || "—"}</td>
                        <td>{a.semAutorizacao ? <Badge tom="danger">Sem autorização</Badge> : <Badge tom="success">Autorizado</Badge>}</td>
                        <td>
                          <StatusBadge status={a.statusCobranca} />
                        </td>
                        <td className="sb-mono sb-end">{a.valorCobrado ? formatarMoeda(a.valorCobrado) : "—"}</td>
                        {podeCobrar && (
                          <td className="sb-end">
                            <button
                              type="button"
                              className="sb-btn sb-btn--sm"
                              onClick={() => abrirCobranca(a)}
                              aria-label={`Cobrança de ${a.paciente?.nome} em ${formatarData(a.dataAtendimento)}`}
                            >
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
        titulo="Registrar atendimento"
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={fechar}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-atendimento" disabled={salvando}>
              {salvando ? "Salvando…" : "Registrar"}
            </button>
          </>
        }
      >
        <form id="form-atendimento" onSubmit={aoEnviar} noValidate>
          <div className="form-grade">
            <div className="sb-field">
              <label className="sb-label" htmlFor="at-paciente">
                Paciente<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <select id="at-paciente" name="pacienteId" className="sb-input" value={form.pacienteId} onChange={aoMudarPaciente} required>
                <option value="">Selecione…</option>
                {(pacientes?.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className={`sb-field ${form.pacienteId && !form.autorizacaoId ? "sb-field--error" : ""}`}>
              <label className="sb-label" htmlFor="at-autorizacao">
                Autorização
              </label>
              <select
                id="at-autorizacao"
                name="autorizacaoId"
                className="sb-input"
                value={form.autorizacaoId}
                onChange={aoMudar}
                aria-describedby="at-autorizacao-ajuda"
              >
                <option value="">Sem autorização vinculada</option>
                {autsPaciente.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.procedimento} — {a.convenio?.nome} ({a.quantidadeUtilizada}/{a.quantidadeAutorizada})
                  </option>
                ))}
              </select>
              <span id="at-autorizacao-ajuda" className="sb-help">
                {!form.pacienteId
                  ? "Escolha o paciente para ver as autorizações vigentes."
                  : form.autorizacaoId
                    ? "Consome uma sessão desta autorização."
                    : autsPaciente.length === 0
                      ? "Este paciente não tem autorização vigente: o atendimento ficará sem cobertura."
                      : "Sem autorização vinculada, o atendimento ficará sem cobertura."}
              </span>
            </div>
            <div className="sb-field inteira">
              <label className="sb-label" htmlFor="at-procedimento">
                Procedimento<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <input id="at-procedimento" name="procedimento" className="sb-input" value={form.procedimento} onChange={aoMudar} required />
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="at-data">
                Data<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <input id="at-data" name="dataAtendimento" type="date" className="sb-input" value={form.dataAtendimento} onChange={aoMudar} required />
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="at-valor">
                Valor cobrado (R$)
              </label>
              <input id="at-valor" name="valorCobrado" type="number" min="0" step="0.01" className="sb-input" placeholder="0,00" value={form.valorCobrado} onChange={aoMudar} />
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="at-inicio">
                Início
              </label>
              <input id="at-inicio" name="horaInicio" type="time" className="sb-input" value={form.horaInicio} onChange={aoMudar} />
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="at-fim">
                Fim
              </label>
              <input id="at-fim" name="horaFim" type="time" className="sb-input" value={form.horaFim} onChange={aoMudar} />
            </div>
            <div className="sb-field inteira">
              <label className="sb-label" htmlFor="at-evolucao">
                Evolução
              </label>
              <textarea id="at-evolucao" name="evolucao" className="sb-input" rows={3} value={form.evolucao} onChange={aoMudar} />
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
            <button type="button" className="sb-btn" onClick={() => setCobranca(null)}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-cobranca" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        {cobranca && (
          <form id="form-cobranca" onSubmit={aoSalvarCobranca} noValidate className="pilha">
            <p className="texto-apoio">
              {cobranca.atendimento.paciente?.nome} · {cobranca.atendimento.procedimento} ·{" "}
              <span className="mono">{formatarData(cobranca.atendimento.dataAtendimento)}</span>
            </p>
            <div className="form-grade">
              <div className="sb-field inteira">
                <label className="sb-label" htmlFor="cob-status">
                  Situação
                </label>
                <select id="cob-status" className="sb-input" value={cobranca.form.statusCobranca} onChange={(e) => mudarCobranca("statusCobranca", e.target.value)}>
                  {STATUS_COBRANCA.map((s) => (
                    <option key={s} value={s}>
                      {rotuloStatus(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sb-field">
                <label className="sb-label" htmlFor="cob-cobrado">
                  Valor cobrado (R$)
                </label>
                <input id="cob-cobrado" type="number" min="0" step="0.01" className="sb-input" value={cobranca.form.valorCobrado} onChange={(e) => mudarCobranca("valorCobrado", e.target.value)} />
              </div>
              <div className="sb-field">
                <label className="sb-label" htmlFor="cob-pago">
                  Valor pago (R$)
                </label>
                <input id="cob-pago" type="number" min="0" step="0.01" className="sb-input" value={cobranca.form.valorPago} onChange={(e) => mudarCobranca("valorPago", e.target.value)} />
              </div>
              {cobranca.form.statusCobranca === "glosado" && (
                <div className="sb-field inteira">
                  <label className="sb-label" htmlFor="cob-motivo">
                    Motivo da glosa
                  </label>
                  <textarea id="cob-motivo" className="sb-input" rows={2} value={cobranca.form.motivoGlosa} onChange={(e) => mudarCobranca("motivoGlosa", e.target.value)} />
                </div>
              )}
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default comUrl(AtendimentosPage);
