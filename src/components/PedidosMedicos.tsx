"use client";

import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import GradePlano from "@/components/GradePlano";
import Icone from "@/components/Icone";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import { Badge } from "@/components/ui/StatusBadge";
import { formatarData } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { documentoService, pedidoMedicoService } from "@/lib/cliente/servicos";
import type { Convenio, DocumentoResumo, PedidoMedico, TipoDocumento } from "@/lib/cliente/tipos";
import { hojeISO } from "@/lib/datas";
import { SIGLAS_CONSELHO, UFS } from "@/lib/tiss/dominios";

export const ROTULO_TIPO_DOC: Record<TipoDocumento, string> = {
  pedido_medico: "Pedido médico",
  plano_terapeutico: "Plano terapêutico",
  relatorio: "Relatório",
  outro: "Documento",
};

const tamanho = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

function vigente(p: PedidoMedico, hoje: string) {
  return p.ativo && p.dataPedido <= hoje && (!p.validoAte || p.validoAte >= hoje);
}

export function ListaDocumentos({ documentos }: { documentos: DocumentoResumo[] }) {
  return (
    <ul className="lista-arquivos">
      {documentos.map((d) => (
        <li key={d.id}>
          <a href={documentoService.url(d.id)} target="_blank" rel="noopener">
            <Icone nome="pdf" />
            {d.nomeOriginal}
          </a>
          <span className="texto-suave">
            {ROTULO_TIPO_DOC[d.tipo]} · <span className="mono">{tamanho(d.tamanho)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

const FORM_VAZIO = () => ({
  medicoNome: "",
  conselho: "CRM",
  numeroConselho: "",
  ufConselho: "SP",
  cbo: "",
  dataPedido: hojeISO(),
  validoAte: "",
  cid: "",
  convenioId: "",
  indicacaoClinica: "",
});

/** Pedidos médicos do paciente: médico solicitante, plano terapêutico e os PDFs anexados à solicitação. */
export default function PedidosMedicos({
  pacienteId,
  convenios,
  podeEditar,
}: {
  pacienteId: string;
  convenios: Convenio[];
  podeEditar: boolean;
}) {
  const buscar = useCallback(() => pedidoMedicoService.listar(pacienteId), [pacienteId]);
  const { data, carregando, erro, recarregar } = useFetch(buscar);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [plano, setPlano] = useState<File | null>(null);
  const [outros, setOutros] = useState<File[]>([]);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [manterAnteriores, setManterAnteriores] = useState(false);
  const hoje = hojeISO();
  const pedidos = data?.pedidos ?? [];
  const avulsos = data?.avulsos ?? [];

  const mudar = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const fechar = () => {
    setAberto(false);
    setForm(FORM_VAZIO());
    setPlano(null);
    setOutros([]);
    setManterAnteriores(false);
  };

  // Ao escolher o plano terapêutico, lê o PDF e preenche médico, CRM, CID e data.
  const aoEscolherPlano = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0] ?? null;
    setPlano(arquivo);
    if (!arquivo) return;
    const fd = new FormData();
    fd.set("arquivo", arquivo);
    setLendo(true);
    try {
      const p = await pedidoMedicoService.lerPlano(fd);
      setForm((f) => ({
        ...f,
        medicoNome: p.medico.nome ?? f.medicoNome,
        numeroConselho: p.medico.crm ?? f.numeroConselho,
        cid: p.cid ?? f.cid,
        dataPedido: p.dataSolicitacao ?? f.dataPedido,
      }));
      toast.success(`Plano lido: ${p.itens.reduce((s, i) => s + i.total, 0)} sessões por semana. Confira os campos.`);
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível ler o plano."));
    } finally {
      setLendo(false);
    }
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    const arquivos = [...(plano ? [plano] : []), ...outros];
    if (!arquivos.length) {
      toast.error("Anexe o plano terapêutico ou o PDF do pedido médico.");
      return;
    }
    const fd = new FormData();
    for (const [k, v] of Object.entries(form)) fd.set(k, v);
    for (const a of arquivos) fd.append("arquivos", a);
    if (manterAnteriores) fd.set("manterAnteriores", "true");
    setSalvando(true);
    try {
      const r = await pedidoMedicoService.criar(pacienteId, fd);
      toast.success(
        r.anterioresApagados ? `Pedido médico cadastrado; ${r.anterioresApagados} pedido(s) anterior(es) substituído(s).` : "Pedido médico cadastrado.",
      );
      fechar();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível salvar o pedido."));
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (p: PedidoMedico) => {
    if (p.ativo && !window.confirm("Desativar este pedido? Ele deixa de ser usado nas solicitações; os PDFs ficam guardados.")) return;
    try {
      await pedidoMedicoService.alterarAtivo(p.id, !p.ativo);
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível alterar o pedido."));
    }
  };

  const ligar = async (doc: DocumentoResumo, pedidoId: string) => {
    if (!pedidoId) return;
    try {
      await documentoService.ligarAoPedido(doc.id, pedidoId);
      toast.success("Documento ligado ao pedido.");
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível ligar o documento."));
    }
  };

  const campo = (nome: keyof ReturnType<typeof FORM_VAZIO>, rotulo: string, props: Record<string, unknown> = {}) => (
    <div className={`sb-field ${props.inteira ? "inteira" : ""}`}>
      <label className="sb-label" htmlFor={`ped-${nome}`}>
        {rotulo}
        {"required" in props && (
          <span className="obrigatorio" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <input id={`ped-${nome}`} name={nome} className="sb-input" value={form[nome]} onChange={mudar} {...{ ...props, inteira: undefined }} />
    </div>
  );

  return (
    <section className="sb-card" aria-labelledby="pedidos-titulo">
      <div className="sb-card__header">
        <h3 id="pedidos-titulo" className="sb-card__title">
          Pedidos médicos e plano terapêutico
        </h3>
        {podeEditar && (
          <button type="button" className="sb-btn sb-btn--sm" onClick={() => setAberto(true)}>
            <Icone nome="mais" />
            Novo pedido
          </button>
        )}
      </div>
      {carregando ? (
        <Carregando />
      ) : erro ? (
        <div className="sb-card__body">
          <MensagemErro mensagem={erro} onRetry={recarregar} />
        </div>
      ) : (
        <div className="sb-card__body pilha">
          {pedidos.length === 0 && (
            <p className="texto-suave">
              Nenhum pedido médico. Ele acompanha cada solicitação de autorização: sem pedido válido, as sessões do paciente
              ficam com pendência. Envie o plano terapêutico aqui ou em Importações → Documentos.
            </p>
          )}
          {pedidos.length > 0 && (
            <ul className="lista-simples">
              {pedidos.map((p) => (
                <li key={p.id} className="pilha" style={{ gap: 8 }}>
                  <div className="ferramentas">
                    <span style={{ fontWeight: 500 }}>
                      {p.medicoNome} · <span className="mono">{`${p.conselho} ${p.numeroConselho}/${p.ufConselho}`}</span>
                    </span>
                    {vigente(p, hoje) ? (
                      <Badge tom="success">Válido</Badge>
                    ) : p.ativo ? (
                      <Badge tom="warning">{p.dataPedido > hoje ? "Ainda não vale" : "Vencido"}</Badge>
                    ) : (
                      <Badge>Desativado</Badge>
                    )}
                    {p.sessoesSemanais !== null && <Badge>{p.sessoesSemanais} sessões/semana</Badge>}
                    {podeEditar && (
                      <button type="button" className="sb-btn sb-btn--sm empurra" onClick={() => alternar(p)}>
                        {p.ativo ? "Desativar" : "Reativar"}
                      </button>
                    )}
                  </div>
                  <p className="texto-suave">
                    Pedido de <span className="mono">{formatarData(p.dataPedido)}</span>
                    {p.validoAte ? (
                      <>
                        {" "}· válido até <span className="mono">{formatarData(p.validoAte)}</span>
                      </>
                    ) : (
                      " · sem data de validade"
                    )}
                    {p.cid && (
                      <>
                        {" "}· CID <span className="mono">{p.cid}</span>
                      </>
                    )}
                    {" "}· {p.convenio?.nome ?? "qualquer convênio"}
                  </p>
                  {p.observacoes && <p className="texto-suave">{p.observacoes}</p>}
                  {p.planoItens && p.planoItens.length > 0 && <GradePlano itens={p.planoItens} />}
                  <ListaDocumentos documentos={p.documentos} />
                </li>
              ))}
            </ul>
          )}
          {avulsos.length > 0 && (
            <div>
              <h4 className="subtitulo">Documentos sem pedido</h4>
              <ul className="lista-simples">
                {avulsos.map((d) => (
                  <li key={d.id} className="ferramentas">
                    <ListaDocumentos documentos={[d]} />
                    {podeEditar && pedidos.length > 0 && (
                      <select
                        className="sb-input sb-input--sm empurra"
                        defaultValue=""
                        onChange={(e) => ligar(d, e.target.value)}
                        aria-label={`Ligar ${d.nomeOriginal} a um pedido`}
                      >
                        <option value="">Ligar ao pedido…</option>
                        {pedidos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {formatarData(p.dataPedido)} · {p.medicoNome}
                          </option>
                        ))}
                      </select>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Modal
        aberto={aberto}
        onFechar={fechar}
        titulo="Novo pedido médico"
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={fechar}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-pedido" disabled={salvando || lendo}>
              {salvando ? "Enviando…" : "Salvar"}
            </button>
          </>
        }
      >
        <form id="form-pedido" onSubmit={aoEnviar} noValidate className="pilha">
          <div className="sb-field">
            <label className="sb-label" htmlFor="ped-plano">
              Plano terapêutico (PDF)
            </label>
            <input id="ped-plano" type="file" className="arquivo" accept="application/pdf,.pdf" onChange={aoEscolherPlano} aria-describedby="ped-plano-ajuda" />
            <span id="ped-plano-ajuda" className="sb-help" aria-live="polite">
              {lendo ? "Lendo o plano…" : "O formulário da Amil preenche médico, CRM, CID, data e as sessões por semana."}
            </span>
          </div>
          <div className="form-grade">
            {campo("medicoNome", "Médico solicitante", { required: true, inteira: true })}
            <div className="sb-field">
              <label className="sb-label" htmlFor="ped-conselho">
                Conselho
              </label>
              <select id="ped-conselho" name="conselho" className="sb-input" value={form.conselho} onChange={mudar}>
                {SIGLAS_CONSELHO.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {campo("numeroConselho", "Número", { required: true, inputMode: "numeric" })}
            <div className="sb-field">
              <label className="sb-label" htmlFor="ped-ufConselho">
                UF<span className="obrigatorio" aria-hidden="true">*</span>
              </label>
              <select id="ped-ufConselho" name="ufConselho" className="sb-input" value={form.ufConselho} onChange={mudar}>
                {UFS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {campo("cbo", "CBO do médico", { inputMode: "numeric", placeholder: "Ex.: 225124 (pediatra)" })}
            {campo("dataPedido", "Data do pedido", { required: true, type: "date" })}
            {campo("validoAte", "Válido até (em branco: 1 ano)", { type: "date" })}
            {campo("cid", "CID-10", { placeholder: "F84.0" })}
            <div className="sb-field">
              <label className="sb-label" htmlFor="ped-convenioId">
                Convênio
              </label>
              <select id="ped-convenioId" name="convenioId" className="sb-input" value={form.convenioId} onChange={mudar}>
                <option value="">Qualquer convênio</option>
                {convenios.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="sb-field inteira">
              <label className="sb-label" htmlFor="ped-indicacaoClinica">
                Indicação clínica
              </label>
              <textarea id="ped-indicacaoClinica" name="indicacaoClinica" className="sb-input" rows={2} value={form.indicacaoClinica} onChange={mudar} />
            </div>
            <div className="sb-field inteira">
              <label className="sb-label" htmlFor="ped-arquivos">
                Outros PDFs (pedido médico, relatório)
              </label>
              <input
                id="ped-arquivos"
                type="file"
                className="arquivo"
                accept="application/pdf,.pdf"
                multiple
                onChange={(e) => setOutros([...(e.target.files ?? [])])}
                aria-describedby="ped-arquivos-ajuda"
              />
              <span id="ped-arquivos-ajuda" className="sb-help">
                Até 5 PDFs no total, 10 MB cada.
              </span>
            </div>
            {pedidos.length > 0 && (
              <div className="sb-field inteira">
                <label className="sb-check">
                  <input type="checkbox" checked={manterAnteriores} onChange={(e) => setManterAnteriores(e.target.checked)} aria-describedby="ped-manter-ajuda" />
                  Manter os pedidos anteriores
                </label>
                <span id="ped-manter-ajuda" className="sb-help">
                  Sem marcar, este pedido substitui os anteriores e os PDFs deles saem do sistema (o histórico fica no arquivo da
                  clínica). Marque só quando o paciente tiver dois pedidos valendo, como um para outra terapia.
                </span>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </section>
  );
}
