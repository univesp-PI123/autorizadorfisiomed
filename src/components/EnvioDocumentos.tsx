"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Icone from "@/components/Icone";
import { Badge } from "@/components/ui/StatusBadge";
import { mensagemDeErro } from "@/lib/cliente/api";
import { documentoService } from "@/lib/cliente/servicos";
import type { ResultadoDocumento, TipoDocumento } from "@/lib/cliente/tipos";

const POR_ENVIO = 10; // o servidor aceita até 10 PDFs por requisição

const STATUS: Record<ResultadoDocumento["status"], { rotulo: string; tom: "success" | "warning" | "danger" | "neutro" }> = {
  vinculado: { rotulo: "Vinculado", tom: "success" },
  sem_paciente: { rotulo: "Sem paciente", tom: "warning" },
  duplicado: { rotulo: "Já enviado", tom: "neutro" },
  ignorado: { rotulo: "Ignorado", tom: "neutro" },
  erro: { rotulo: "Erro", tom: "danger" },
};

const VINCULO: Record<NonNullable<ResultadoDocumento["vinculoPor"]>, string> = {
  cpf: "CPF no nome do arquivo",
  carteirinha: "carteirinha no nome do arquivo",
  nome_no_plano: "nome e nascimento do plano",
  pasta: "nome da pasta",
  escolhido: "escolhido",
};

type Escolhido = { arquivo: File; caminho: string };

/** Caminho dentro da pasta escolhida ("PACIENTES/MARIA SILVA/plano.pdf"); vazio quando são arquivos soltos. */
const caminhoDe = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? "";

/**
 * Na pasta de pacientes (uma pasta por paciente, com o nome dele), valem só os
 * PDFs direto na pasta do paciente: subpastas guardam documentos antigos, e a
 * liminar não vai na solicitação.
 */
function motivoParaIgnorar(f: File): string | null {
  if (/liminar/i.test(f.name)) return "Liminar: não vai na solicitação.";
  if (caminhoDe(f).split("/").length >= 4) return "Em subpasta (documento antigo).";
  return null;
}

/** Partes de até 10 arquivos, sem separar os arquivos de uma mesma pasta. */
function emPartes(lista: Escolhido[]) {
  const pastas = new Map<string, Escolhido[]>();
  for (const e of lista) {
    const pasta = e.caminho.split("/").slice(0, -1).join("/");
    pastas.set(pasta, [...(pastas.get(pasta) ?? []), e]);
  }
  const partes: Escolhido[][] = [];
  let atual: Escolhido[] = [];
  for (const grupo of pastas.values()) {
    // Planos primeiro: os pedidos criados por eles recebem os demais PDFs.
    const ordenado = [...grupo].sort((a, b) => Number(/plano/i.test(b.arquivo.name)) - Number(/plano/i.test(a.arquivo.name)));
    if (atual.length + ordenado.length > POR_ENVIO && atual.length) {
      partes.push(atual);
      atual = [];
    }
    for (const e of ordenado) {
      if (atual.length === POR_ENVIO) {
        partes.push(atual);
        atual = [];
      }
      atual.push(e);
    }
  }
  if (atual.length) partes.push(atual);
  return partes;
}

export function TabelaResultados({ resultados }: { resultados: ResultadoDocumento[] }) {
  const ordem = { erro: 0, sem_paciente: 1, duplicado: 2, ignorado: 3, vinculado: 4 };
  return (
    <div className="tabela-rolagem">
      <table className="sb-table">
        <thead>
          <tr>
            <th scope="col">Arquivo</th>
            <th scope="col">Situação</th>
            <th scope="col">Paciente</th>
            <th scope="col">Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {[...resultados]
            .sort((a, b) => ordem[a.status] - ordem[b.status])
            .map((r, i) => (
              <tr key={`${r.arquivo}-${i}`}>
                <td className="quebra">{r.arquivo}</td>
                <td>
                  <Badge tom={STATUS[r.status].tom}>{STATUS[r.status].rotulo}</Badge>
                </td>
                <td>{r.paciente ? <Link href={`/pacientes/${r.paciente.id}`}>{r.paciente.nome}</Link> : "—"}</td>
                <td className="texto-apoio">
                  {r.motivo ??
                    [
                      r.vinculoPor && `pelo ${VINCULO[r.vinculoPor]}`,
                      r.pedido?.criado ? "pedido médico criado a partir do plano" : r.pedido ? "ligado ao pedido médico" : "sem pedido médico (avulso)",
                      r.anterioresApagados && `substituiu ${r.anterioresApagados} pedido(s) anterior(es)`,
                    ]
                      .filter(Boolean)
                      .join("; ")}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Envio em lote de PDFs (planos terapêuticos, pedidos médicos, relatórios). O
 * paciente é achado pelo nome da pasta dele, pelo CPF ou pela carteirinha no
 * nome do arquivo — ou, no plano terapêutico, pelo nome e nascimento do PDF.
 */
export default function EnvioDocumentos({ aoConcluir }: { aoConcluir: () => void }) {
  const [tipoPadrao, setTipoPadrao] = useState<TipoDocumento>("pedido_medico");
  const [arquivos, setArquivos] = useState<Escolhido[]>([]);
  const [ignorados, setIgnorados] = useState<ResultadoDocumento[]>([]);
  const [enviados, setEnviados] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoDocumento[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const escolher = (lista: FileList | null) => {
    const todos = [...(lista ?? [])];
    const pdfs = todos.filter((f) => /\.pdf$/i.test(f.name));
    const fora = pdfs.map((f) => ({ f, motivo: motivoParaIgnorar(f) })).filter((x) => x.motivo);
    setArquivos(pdfs.filter((f) => !motivoParaIgnorar(f)).map((f) => ({ arquivo: f, caminho: caminhoDe(f) })));
    setIgnorados(fora.map(({ f, motivo }) => ({ arquivo: caminhoDe(f) || f.name, status: "ignorado", motivo: motivo! })));
    setResultados(null);
    if (todos.length > pdfs.length) toast(`${todos.length - pdfs.length} arquivo(s) que não são PDF ficaram de fora.`);
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!arquivos.length) {
      toast.error("Selecione os PDFs ou uma pasta.");
      return;
    }
    const partes = emPartes(arquivos);
    const todos: ResultadoDocumento[] = [...ignorados];
    let importacaoId = "";
    setEnviando(true);
    setEnviados(0);
    try {
      for (const [i, parte] of partes.entries()) {
        const fd = new FormData();
        fd.set("tipoPadrao", tipoPadrao);
        if (importacaoId) fd.set("importacaoId", importacaoId);
        // Os ignorados vão no primeiro envio, só para constar no relatório.
        if (i === 0 && ignorados.length) fd.set("ignorados", JSON.stringify(ignorados.map(({ arquivo, motivo }) => ({ arquivo, motivo }))));
        for (const a of parte) {
          fd.append("arquivos", a.arquivo);
          fd.append("caminhos", a.caminho);
        }
        const r = await documentoService.enviarLote(fd);
        importacaoId = r.importacaoId;
        todos.push(...r.resultados);
        setEnviados((n) => n + parte.length);
        setResultados([...todos]);
      }
      const ok = todos.filter((r) => r.status === "vinculado").length;
      toast.success(`${ok} de ${todos.length - ignorados.length} documento(s) vinculados.`);
      formRef.current?.reset();
      setArquivos([]);
      setIgnorados([]);
    } catch (err) {
      toast.error(mensagemDeErro(err, "O envio foi interrompido."));
    } finally {
      setEnviando(false);
      aoConcluir();
    }
  };

  return (
    <form ref={formRef} className="sb-card" id="importar-documentos" onSubmit={aoEnviar} aria-labelledby="titulo-documentos">
      <div className="sb-card__header">
        <h2 className="sb-card__title" id="titulo-documentos">
          Documentos dos pacientes (planos e pedidos médicos)
        </h2>
      </div>
      <div className="sb-card__body pilha">
        <p className="texto-apoio">
          <strong style={{ fontWeight: 500 }}>Pasta de pacientes:</strong> escolha a pasta que tem uma pasta por paciente, com o
          nome dele — não é preciso renomear os arquivos. De cada paciente entram só os PDFs que estão direto na pasta dele (o
          pedido médico e o plano terapêutico mais recentes); subpastas, como a de documentos antigos, e liminares ficam de
          fora. Arquivos soltos são reconhecidos pelo <strong style={{ fontWeight: 500 }}>CPF</strong> ou pela{" "}
          <strong style={{ fontWeight: 500 }}>carteirinha</strong> no nome (ex.: <span className="mono">530683703_PLANO_TERAPEUTICO.pdf</span>).
        </p>
        <p className="texto-apoio">
          O plano terapêutico da Amil cria o pedido médico (médico, CRM, CID e sessões por semana) e substitui o pedido
          anterior do paciente, que sai do sistema com os PDFs dele.
        </p>
        <div className="form-grade">
          <div className="sb-field">
            <label className="sb-label" htmlFor="doc-pasta">
              Pasta de pacientes
            </label>
            <input
              id="doc-pasta"
              type="file"
              className="arquivo"
              // Seleção de pasta (Chrome, Edge e Firefox).
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              onChange={(e) => escolher(e.target.files)}
            />
          </div>
          <div className="sb-field">
            <label className="sb-label" htmlFor="doc-arquivos">
              Ou PDFs soltos
            </label>
            <input id="doc-arquivos" type="file" className="arquivo" accept="application/pdf,.pdf" multiple onChange={(e) => escolher(e.target.files)} />
          </div>
          <div className="sb-field">
            <label className="sb-label" htmlFor="doc-tipo">
              Tipo, quando o nome do arquivo não disser
            </label>
            <select id="doc-tipo" className="sb-input" value={tipoPadrao} onChange={(e) => setTipoPadrao(e.target.value as TipoDocumento)}>
              <option value="pedido_medico">Pedido médico</option>
              <option value="relatorio">Relatório</option>
              <option value="plano_terapeutico">Plano terapêutico</option>
              <option value="outro">Outro</option>
            </select>
          </div>
        </div>
        {(arquivos.length > 0 || ignorados.length > 0) && !enviando && (
          <p className="texto-suave">
            <span className="mono">{arquivos.length}</span> PDF(s) para enviar
            {ignorados.length > 0 && (
              <>
                {" "}· <span className="mono">{ignorados.length}</span> de fora (subpastas e liminares)
              </>
            )}
            .
          </p>
        )}
        {enviando && (
          <div>
            <p className="texto-suave" aria-live="polite">
              Enviando <span className="mono">{enviados}</span> de <span className="mono">{arquivos.length}</span>…
            </p>
            <div className="progresso" role="progressbar" aria-valuemin={0} aria-valuemax={arquivos.length} aria-valuenow={enviados} aria-label="Envio dos documentos">
              <span style={{ width: `${(enviados / Math.max(arquivos.length, 1)) * 100}%` }} />
            </div>
          </div>
        )}
        <div>
          <button type="submit" className="sb-btn sb-btn--primary" disabled={enviando}>
            <Icone nome="importar" />
            {enviando ? "Enviando…" : "Enviar documentos"}
          </button>
        </div>
        {resultados && resultados.length > 0 && <TabelaResultados resultados={resultados} />}
      </div>
    </form>
  );
}
