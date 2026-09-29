"use client";

import Link from "next/link";
import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import BuscaPaciente from "@/components/BuscaPaciente";
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
import { atendimentoService, autorizacaoService, procedimentoService } from "@/lib/cliente/servicos";
import type { Atendimento, Autorizacao, PacienteBusca, SituacaoAtendimento } from "@/lib/cliente/tipos";
import { hojeISO } from "@/lib/datas";
import { MOTIVOS_GLOSA, OUTROS } from "@/lib/glosa";

const STATUS_COBRANCA = ["pendente", "faturado", "pago", "glosado", "cancelado"];

const SITUACAO: Record<SituacaoAtendimento, { rotulo: string; tom: "warning" | "success" | "neutro" }> = {
  aguardando_confirmacao: { rotulo: "Aguardando confirmação", tom: "warning" },
  confirmado: { rotulo: "Confirmado", tom: "success" },
  cancelado: { rotulo: "Cancelado", tom: "neutro" },
};

// Sessões de 1 hora, começando em hora cheia ou meia hora.
const HORARIOS = Array.from({ length: 32 }, (_, i) => {
  const minutos = 6 * 60 + i * 30; // 06:00 a 21:30
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${minutos % 60 ? "30" : "00"}`;
});
const maisUmaHora = (h: string) => {
  const [hh, mm] = h.split(":").map(Number);
  return `${String((hh + 1) % 24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

const formInicial = () => ({
  pacienteId: "",
  autorizacaoId: "",
  procedimentoId: "",
  dataAtendimento: hojeISO(),
  horaInicio: "",
  valorCobrado: "",
});

type FormCobranca = { statusCobranca: string; valorCobrado: string; valorPago: string; motivoGlosa: string; outroMotivo: string };

function AtendimentosPage({ url }: { url: URLSearchParams }) {
  const { usuario } = useSessao();
  const operador = usuario.perfil === "admin" || usuario.perfil === "recepcionista";
  const podeCobrar = usuario.perfil !== "terapeuta";

  const [filtroStatus, setFiltroStatus] = useState(url.get("statusCobranca") ?? "");
  const [filtroSemAut, setFiltroSemAut] = useState(url.get("semAutorizacao") ?? "");
  const [filtroSituacao, setFiltroSituacao] = useState(url.get("situacao") ?? "");
  const filtroAutorizacao = url.get("autorizacaoId") ?? "";
  const hoje = hojeISO();
  const [modalAberto, setModalAberto] = useState(operador && url.get("novo") === "1");
  const [form, setForm] = useState(formInicial);
  const [autsPaciente, setAutsPaciente] = useState<Autorizacao[]>([]);
  const [paciente, setPaciente] = useState<PacienteBusca | null>(null);
  const [cobranca, setCobranca] = useState<{ atendimento: Atendimento; form: FormCobranca } | null>(null);
  const [cancelando, setCancelando] = useState<{ atendimento: Atendimento; motivo: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const { pagina, limite, setPagina, resetar } = usePaginacao(20);

  const buscar = useCallback(
    () =>
      atendimentoService.listar({
        page: pagina,
        limit: limite,
        statusCobranca: filtroStatus || undefined,
        semAutorizacao: filtroSemAut || undefined,
        situacao: filtroSituacao || undefined,
        autorizacaoId: filtroAutorizacao || undefined,
      }),
    [pagina, limite, filtroStatus, filtroSemAut, filtroSituacao, filtroAutorizacao],
  );
  const { data, carregando, erro, recarregar } = useFetch(buscar);
  const atendimentos = data?.data ?? [];

  const buscarProcedimentos = useCallback(
    () => (modalAberto ? procedimentoService.listar() : Promise.resolve(null)),
    [modalAberto],
  );
  const { data: procedimentos } = useFetch(buscarProcedimentos);

  const aoMudar = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Ao escolher o paciente, carrega as autorizações vigentes dele.
  const escolherPaciente = async (p: PacienteBusca | null) => {
    setPaciente(p);
    const pacienteId = p?.id ?? "";
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
    setPaciente(null);
  };

  const executar = async (acao: () => Promise<unknown>, sucesso: string, aoConcluir: () => void, erroPadrao: string) => {
    setSalvando(true);
    try {
      await acao();
      toast.success(sucesso);
      aoConcluir();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, erroPadrao));
    } finally {
      setSalvando(false);
    }
  };

  const aoEnviar = (e: FormEvent) => {
    e.preventDefault();
    executar(
      () => atendimentoService.criar(form),
      form.autorizacaoId ? "Atendimento registrado." : "Atendimento registrado sem autorização.",
      fechar,
      "Não foi possível registrar o atendimento.",
    );
  };

  const confirmar = (a: Atendimento) =>
    executar(() => atendimentoService.confirmar(a.id), "Atendimento confirmado.", () => {}, "Não foi possível confirmar.");

  const aoCancelar = (e: FormEvent) => {
    e.preventDefault();
    if (!cancelando) return;
    if (cancelando.motivo.trim().length < 3) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }
    executar(
      () => atendimentoService.cancelar(cancelando.atendimento.id, cancelando.motivo.trim()),
      "Atendimento cancelado.",
      () => setCancelando(null),
      "Não foi possível cancelar.",
    );
  };

  const abrirCobranca = (a: Atendimento) => {
    const motivo = a.motivoGlosa ?? "";
    const conhecido = (MOTIVOS_GLOSA as readonly string[]).includes(motivo);
    setCobranca({
      atendimento: a,
      form: {
        statusCobranca: a.statusCobranca,
        valorCobrado: a.valorCobrado ?? "",
        valorPago: a.valorPago ?? "",
        motivoGlosa: !motivo ? "" : conhecido ? motivo : OUTROS,
        outroMotivo: conhecido ? "" : motivo,
      },
    });
  };

  const aoSalvarCobranca = (e: FormEvent) => {
    e.preventDefault();
    if (!cobranca) return;
    const { outroMotivo, motivoGlosa, ...resto } = cobranca.form;
    const motivo = resto.statusCobranca === "glosado" ? (motivoGlosa === OUTROS ? outroMotivo.trim() : motivoGlosa) : "";
    if (resto.statusCobranca === "glosado" && !motivo) {
      toast.error("Informe o motivo da glosa.");
      return;
    }
    executar(
      () => atendimentoService.atualizar(cobranca.atendimento.id, { ...resto, motivoGlosa: motivo }),
      "Cobrança atualizada.",
      () => setCobranca(null),
      "Não foi possível atualizar a cobrança.",
    );
  };

  const mudarCobranca = (campo: keyof FormCobranca, valor: string) =>
    setCobranca((c) => c && { ...c, form: { ...c.form, [campo]: valor } });

  const aguardando = data?.aguardandoConfirmacao ?? 0;

  return (
    <>
      {aguardando > 0 && filtroSituacao !== "aguardando_confirmacao" && (
        <div className="aviso aviso--atencao ferramentas">
          <span>
            <span className="mono">{aguardando}</span> atendimento(s) de sessões autorizadas aguardando confirmação.
          </span>
          <button
            type="button"
            className="sb-btn sb-btn--sm empurra"
            onClick={() => {
              setFiltroSituacao("aguardando_confirmacao");
              resetar();
            }}
          >
            Ver e confirmar
          </button>
        </div>
      )}

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
            {filtroAutorizacao && (
              <Link href="/atendimentos" className="sb-btn sb-btn--ghost">
                <Icone nome="fechar" />
                Filtro por autorização
              </Link>
            )}
            <select
              className="sb-input sb-input--sm"
              value={filtroSituacao}
              onChange={(e) => {
                setFiltroSituacao(e.target.value);
                resetar();
              }}
              aria-label="Situação"
            >
              <option value="">Todas as situações</option>
              {Object.entries(SITUACAO).map(([v, s]) => (
                <option key={v} value={v}>
                  {s.rotulo}
                </option>
              ))}
            </select>
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
            {operador && (
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
                    <th scope="col">Profissional</th>
                    <th scope="col">Situação</th>
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
                      <td colSpan={podeCobrar ? 8 : 7} className="vazio">
                        Nenhum atendimento encontrado.
                      </td>
                    </tr>
                  ) : (
                    atendimentos.map((a) => (
                      <tr key={a.id}>
                        <td className="sb-mono" style={{ whiteSpace: "nowrap" }}>
                          {formatarData(a.dataAtendimento)}
                          {a.horaInicio && <span className="texto-suave">{a.horaInicio}{a.horaFim && `–${a.horaFim}`}</span>}
                        </td>
                        <td className="sb-strong">
                          <Link href={`/pacientes/${a.pacienteId}`}>{a.paciente?.nome}</Link>
                        </td>
                        <td>
                          {a.procedimento}
                          {a.semAutorizacao && <span className="texto-suave">sem autorização</span>}
                        </td>
                        <td>{a.profissional?.nome ?? a.terapeuta?.nome ?? "—"}</td>
                        <td>
                          <Badge tom={SITUACAO[a.situacao].tom}>
                            {a.situacao === "aguardando_confirmacao" && a.dataAtendimento > hoje ? "Agendada" : SITUACAO[a.situacao].rotulo}
                          </Badge>
                          {a.motivoCancelamento && <span className="texto-suave">{a.motivoCancelamento}</span>}
                        </td>
                        <td>
                          <StatusBadge status={a.statusCobranca} />
                        </td>
                        <td className="sb-mono sb-end">{a.valorCobrado ? formatarMoeda(a.valorCobrado) : "—"}</td>
                        {podeCobrar && (
                          <td className="sb-end">
                            {a.situacao === "aguardando_confirmacao" ? (
                              operador && (
                                <span className="acoes-linha">
                                  <button
                                    type="button"
                                    className="sb-btn sb-btn--sm sb-btn--primary"
                                    onClick={() => confirmar(a)}
                                    disabled={salvando || a.dataAtendimento > hoje}
                                    title={a.dataAtendimento > hoje ? "Confirme depois que a sessão acontecer." : undefined}
                                    aria-label={`Confirmar atendimento de ${a.paciente?.nome} em ${formatarData(a.dataAtendimento)}`}
                                  >
                                    Confirmar
                                  </button>
                                  <button
                                    type="button"
                                    className="sb-btn sb-btn--sm"
                                    onClick={() => setCancelando({ atendimento: a, motivo: "" })}
                                    disabled={salvando}
                                    aria-label={`Cancelar atendimento de ${a.paciente?.nome} em ${formatarData(a.dataAtendimento)}`}
                                  >
                                    Cancelar
                                  </button>
                                </span>
                              )
                            ) : (
                              a.situacao === "confirmado" && (
                                <button
                                  type="button"
                                  className="sb-btn sb-btn--sm"
                                  onClick={() => abrirCobranca(a)}
                                  aria-label={`Cobrança de ${a.paciente?.nome} em ${formatarData(a.dataAtendimento)}`}
                                >
                                  Cobrança
                                </button>
                              )
                            )}
                          </td>
                        )}
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
            <div className="inteira">
              <BuscaPaciente id="at-paciente" obrigatorio selecionado={paciente} aoSelecionar={escolherPaciente} />
            </div>
            <div className="sb-field inteira">
              <label className="sb-label" htmlFor="at-autorizacao">
                Autorização
              </label>
              <select id="at-autorizacao" name="autorizacaoId" className="sb-input" value={form.autorizacaoId} onChange={aoMudar} aria-describedby="at-autorizacao-ajuda">
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
                    : "Sem autorização vinculada, o atendimento ficará sem cobertura."}
              </span>
            </div>
            <div className="sb-field inteira">
              <label className="sb-label" htmlFor="at-procedimento">
                Procedimento<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <select id="at-procedimento" name="procedimentoId" className="sb-input" value={form.procedimentoId} onChange={aoMudar} required>
                <option value="">Selecione…</option>
                {(procedimentos ?? [])
                  .filter((p) => p.ativo)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codigoAnclinic} — {p.descricao}
                    </option>
                  ))}
              </select>
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="at-data">
                Data<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <input id="at-data" name="dataAtendimento" type="date" className="sb-input" value={form.dataAtendimento} onChange={aoMudar} required />
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="at-inicio">
                Início
              </label>
              <select id="at-inicio" name="horaInicio" className="sb-input mono" value={form.horaInicio} onChange={aoMudar} aria-describedby="at-inicio-ajuda">
                <option value="">—</option>
                {HORARIOS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <span id="at-inicio-ajuda" className="sb-help">
                {form.horaInicio ? `Sessão de 1 hora: termina às ${maisUmaHora(form.horaInicio)}.` : "Sessão de 1 hora."}
              </span>
            </div>
            <div className="sb-field">
              <label className="sb-label" htmlFor="at-valor">
                Valor cobrado (R$)
              </label>
              <input id="at-valor" name="valorCobrado" type="number" min="0" step="0.01" className="sb-input" placeholder="0,00" value={form.valorCobrado} onChange={aoMudar} />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={cancelando !== null}
        onFechar={() => setCancelando(null)}
        titulo="Cancelar atendimento"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={() => setCancelando(null)}>
              Voltar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-cancelar" disabled={salvando}>
              {salvando ? "Salvando…" : "Cancelar atendimento"}
            </button>
          </>
        }
      >
        {cancelando && (
          <form id="form-cancelar" onSubmit={aoCancelar} noValidate className="pilha">
            <p className="texto-apoio">
              {cancelando.atendimento.paciente?.nome} · {cancelando.atendimento.procedimento} ·{" "}
              <span className="mono">{formatarData(cancelando.atendimento.dataAtendimento)}</span>
            </p>
            <div className="sb-field">
              <label className="sb-label" htmlFor="cancel-motivo">
                Motivo<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <textarea
                id="cancel-motivo"
                className="sb-input"
                rows={3}
                value={cancelando.motivo}
                onChange={(e) => setCancelando((c) => c && { ...c, motivo: e.target.value })}
                required
                aria-describedby="cancel-motivo-ajuda"
              />
              <span id="cancel-motivo-ajuda" className="sb-help">
                A sessão não é descontada da autorização.
              </span>
            </div>
          </form>
        )}
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
                    Motivo da glosa<span className="obrigatorio" aria-hidden="true">*</span>
                  </label>
                  <select id="cob-motivo" className="sb-input" value={cobranca.form.motivoGlosa} onChange={(e) => mudarCobranca("motivoGlosa", e.target.value)} required>
                    <option value="">Selecione…</option>
                    {MOTIVOS_GLOSA.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                    <option value={OUTROS}>{OUTROS}</option>
                  </select>
                </div>
              )}
              {cobranca.form.statusCobranca === "glosado" && cobranca.form.motivoGlosa === OUTROS && (
                <div className="sb-field inteira">
                  <label className="sb-label" htmlFor="cob-outro">
                    Qual o motivo?<span className="obrigatorio" aria-hidden="true">*</span>
                  </label>
                  <textarea id="cob-outro" className="sb-input" rows={2} value={cobranca.form.outroMotivo} onChange={(e) => mudarCobranca("outroMotivo", e.target.value)} required />
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
