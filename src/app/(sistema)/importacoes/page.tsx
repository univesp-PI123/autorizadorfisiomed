"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import EnvioDocumentos from "@/components/EnvioDocumentos";
import Icone from "@/components/Icone";
import ResumoImportacao from "@/components/ResumoImportacao";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import { useSessao } from "@/contextos/SessaoContexto";
import { formatarDataHora } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { convenioService, importacaoService } from "@/lib/cliente/servicos";
import type { Importacao } from "@/lib/cliente/tipos";

const ROTULO_TIPO: Record<Importacao["tipo"], string> = {
  agenda: "Agenda",
  profissionais: "Profissionais",
  documentos: "Documentos",
  tabela_operadora: "Tabela da operadora",
  tuss: "Tabela TUSS",
};

function FormImportacao({
  tipo,
  titulo,
  children,
  aoImportar,
}: {
  tipo: "profissionais";
  titulo: string;
  children?: React.ReactNode;
  aoImportar: (i: Importacao) => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const aoEnviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size) {
      toast.error("Selecione a planilha .xlsx.");
      return;
    }
    form.set("tipo", tipo);
    setEnviando(true);
    try {
      const imp = await importacaoService.enviar(form);
      toast.success("Planilha importada.");
      formRef.current?.reset();
      aoImportar(imp);
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível importar a planilha."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form ref={formRef} className="sb-card" id={`importar-${tipo}`} onSubmit={aoEnviar} aria-labelledby={`titulo-${tipo}`}>
      <div className="sb-card__header">
        <h2 className="sb-card__title" id={`titulo-${tipo}`}>
          {titulo}
        </h2>
      </div>
      <div className="sb-card__body pilha">
        {children}
        <div className="sb-field">
          <label className="sb-label" htmlFor={`arquivo-${tipo}`}>
            Planilha (.xlsx)
          </label>
          <input
            id={`arquivo-${tipo}`}
            name="arquivo"
            type="file"
            className="arquivo"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
          />
        </div>
        <div>
          <button type="submit" className="sb-btn sb-btn--primary" disabled={enviando}>
            <Icone nome="importar" />
            {enviando ? "Importando…" : "Importar"}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function ImportacoesPage() {
  const { usuario } = useSessao();
  const podeImportar = usuario.perfil === "admin" || usuario.perfil === "recepcionista";
  const [aberta, setAberta] = useState<Importacao | null>(null);
  const historico = useFetch(importacaoService.listar);
  const convenios = useFetch(convenioService.listar);

  const aoImportar = (imp: Importacao) => {
    setAberta(imp);
    historico.recarregar();
  };

  return (
    <>
      {podeImportar && (
        <section className="grid-meio">
          <section className="sb-card" aria-labelledby="titulo-agenda">
            <div className="sb-card__header">
              <h2 className="sb-card__title" id="titulo-agenda">
                Agenda do AnClinic
              </h2>
            </div>
            <div className="sb-card__body pilha">
              <p className="texto-apoio">
                A agenda do dia é importada em Autorizações, na lista &ldquo;A solicitar&rdquo;: lá aparecem na hora as sessões a
                pedir, o que falta em cada uma e o botão para gerar os pedidos.
              </p>
              <div>
                <Link href="/autorizacoes?importar=1" className="sb-btn sb-btn--primary">
                  <Icone nome="importar" />
                  Importar agenda do dia
                </Link>
              </div>
            </div>
          </section>
          <FormImportacao tipo="profissionais" titulo="Profissionais credenciados" aoImportar={aoImportar}>
            <p className="texto-apoio">
              Planilha com Nome, CPF, Conselho, Número no conselho, UF e Especialidades. Com um convênio escolhido, ela vira a
              lista completa de credenciados nele.
            </p>
            <div className="sb-field">
              <label className="sb-label" htmlFor="imp-convenio">
                Credenciados no convênio
              </label>
              <select id="imp-convenio" name="convenioId" className="sb-input" defaultValue="">
                <option value="">Só atualizar os cadastros</option>
                {(convenios.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>
          </FormImportacao>
        </section>
      )}
      {podeImportar && <EnvioDocumentos aoConcluir={historico.recarregar} />}

      <section className="sb-card" id="historico" aria-labelledby="titulo-historico">
        <div className="sb-card__header">
          <h2 className="sb-card__title" id="titulo-historico">
            Histórico de importações
          </h2>
        </div>
        {historico.carregando ? (
          <Carregando />
        ) : historico.erro ? (
          <div className="sb-card__body">
            <MensagemErro mensagem={historico.erro} onRetry={historico.recarregar} />
          </div>
        ) : (
          <div className="tabela-rolagem">
            <table className="sb-table">
              <thead>
                <tr>
                  <th scope="col">Quando</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Arquivo</th>
                  <th scope="col">Por</th>
                  <th scope="col" className="sb-end">
                    Novos
                  </th>
                  <th scope="col" className="sb-end">
                    Atualizados
                  </th>
                  <th scope="col" className="sb-end">
                    Avisos
                  </th>
                  <th scope="col" className="sb-end">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(historico.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="vazio">
                      Nenhuma importação ainda.
                    </td>
                  </tr>
                ) : (
                  historico.data!.map((i) => (
                    <tr key={i.id}>
                      <td className="sb-mono">{formatarDataHora(i.createdAt)}</td>
                      <td>{ROTULO_TIPO[i.tipo]}</td>
                      <td>{i.arquivoNome}</td>
                      <td>{i.usuario?.nome ?? "—"}</td>
                      <td className="sb-mono sb-end">{i.criados}</td>
                      <td className="sb-mono sb-end">{i.atualizados}</td>
                      <td className="sb-mono sb-end">{(i.resumo.avisos ?? []).reduce((s, a) => s + a.quantidade, 0)}</td>
                      <td className="sb-end">
                        <button type="button" className="sb-btn sb-btn--sm" onClick={() => setAberta(i)}>
                          Ver relatório
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        aberto={!!aberta}
        onFechar={() => setAberta(null)}
        titulo={aberta ? `Importação de ${ROTULO_TIPO[aberta.tipo].toLowerCase()} — ${aberta.arquivoNome}` : ""}
        tamanho="xl"
        rodape={
          <button type="button" className="sb-btn" onClick={() => setAberta(null)}>
            Fechar
          </button>
        }
      >
        {aberta && <ResumoImportacao importacao={aberta} />}
      </Modal>
    </>
  );
}
