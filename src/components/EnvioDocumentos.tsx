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
  erro: { rotulo: "Erro", tom: "danger" },
};

const VINCULO: Record<NonNullable<ResultadoDocumento["vinculoPor"]>, string> = {
  cpf: "CPF no nome do arquivo",
  carteirinha: "carteirinha no nome do arquivo",
  nome_no_plano: "nome e nascimento do plano",
  escolhido: "escolhido",
};

export function TabelaResultados({ resultados }: { resultados: ResultadoDocumento[] }) {
  const ordem = { erro: 0, sem_paciente: 1, duplicado: 2, vinculado: 3 };
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
 * paciente é achado pelo CPF ou pela carteirinha no nome do arquivo — ou, no
 * plano terapêutico, pelo nome e nascimento lidos do PDF.
 */
export default function EnvioDocumentos({ aoConcluir }: { aoConcluir: () => void }) {
  const [tipoPadrao, setTipoPadrao] = useState<TipoDocumento>("pedido_medico");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [enviados, setEnviados] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoDocumento[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const escolher = (lista: FileList | null) => {
    const pdfs = [...(lista ?? [])].filter((f) => /\.pdf$/i.test(f.name));
    setArquivos(pdfs);
    setResultados(null);
    if (lista && lista.length > pdfs.length) toast(`${lista.length - pdfs.length} arquivo(s) que não são PDF foram ignorados.`);
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!arquivos.length) {
      toast.error("Selecione os PDFs ou uma pasta.");
      return;
    }
    // Planos primeiro: os pedidos criados por eles recebem os demais PDFs.
    const fila = [...arquivos].sort((a, b) => Number(/plano/i.test(b.name)) - Number(/plano/i.test(a.name)));
    const todos: ResultadoDocumento[] = [];
    let importacaoId = "";
    setEnviando(true);
    setEnviados(0);
    try {
      for (let i = 0; i < fila.length; i += POR_ENVIO) {
        const fd = new FormData();
        fd.set("tipoPadrao", tipoPadrao);
        if (importacaoId) fd.set("importacaoId", importacaoId);
        for (const a of fila.slice(i, i + POR_ENVIO)) fd.append("arquivos", a);
        const r = await documentoService.enviarLote(fd);
        importacaoId = r.importacaoId;
        todos.push(...r.resultados);
        setEnviados(Math.min(i + POR_ENVIO, fila.length));
        setResultados([...todos]);
      }
      const ok = todos.filter((r) => r.status === "vinculado").length;
      toast.success(`${ok} de ${todos.length} documento(s) vinculados.`);
      formRef.current?.reset();
      setArquivos([]);
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
          O paciente é identificado pelo <strong style={{ fontWeight: 500 }}>CPF</strong> ou pelo{" "}
          <strong style={{ fontWeight: 500 }}>número da carteirinha</strong> no nome do arquivo (ex.:{" "}
          <span className="mono">123.456.789-09_pedido.pdf</span>, <span className="mono">530683703_PLANO_TERAPEUTICO.pdf</span>).
          No plano terapêutico da Amil, também pelo nome e nascimento escritos nele; e o plano cria o pedido médico com o
          médico, CRM, CID e as sessões por semana.
        </p>
        <div className="form-grade">
          <div className="sb-field">
            <label className="sb-label" htmlFor="doc-arquivos">
              PDFs
            </label>
            <input id="doc-arquivos" type="file" className="arquivo" accept="application/pdf,.pdf" multiple onChange={(e) => escolher(e.target.files)} />
          </div>
          <div className="sb-field">
            <label className="sb-label" htmlFor="doc-pasta">
              Ou uma pasta inteira
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
        {arquivos.length > 0 && !enviando && (
          <p className="texto-suave">
            <span className="mono">{arquivos.length}</span> PDF(s) selecionado(s).
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
