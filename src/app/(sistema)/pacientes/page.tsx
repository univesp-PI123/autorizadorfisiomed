"use client";

import Link from "next/link";
import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import { comUrl, tirarNovoDaUrl } from "@/components/ComUrl";
import FormPaciente, { FORM_PACIENTE_VAZIO } from "@/components/FormPaciente";
import Icone from "@/components/Icone";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import Paginacao from "@/components/ui/Paginacao";
import { Badge } from "@/components/ui/StatusBadge";
import { formatarData } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch, usePaginacao } from "@/lib/cliente/hooks";
import { pacienteService } from "@/lib/cliente/servicos";

function PacientesPage({ url }: { url: URLSearchParams }) {
  const [busca, setBusca] = useState(url.get("busca") ?? "");
  const [filtroAtivo, setFiltroAtivo] = useState(url.get("ativo") ?? "true");
  const [modalAberto, setModalAberto] = useState(url.get("novo") === "1");
  const [form, setForm] = useState(FORM_PACIENTE_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const { pagina, limite, setPagina, resetar } = usePaginacao(20);

  const buscar = useCallback(
    () =>
      pacienteService.listar({
        page: pagina,
        limit: limite,
        busca: busca.trim() || undefined,
        ativo: filtroAtivo || undefined,
      }),
    [pagina, limite, busca, filtroAtivo],
  );
  const { data, carregando, erro, recarregar } = useFetch(buscar);
  const pacientes = data?.data ?? [];

  const aoMudar = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const fechar = () => {
    setModalAberto(false);
    tirarNovoDaUrl();
    setForm(FORM_PACIENTE_VAZIO);
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await pacienteService.criar(form);
      toast.success("Paciente cadastrado.");
      fechar();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível salvar o paciente."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <section className="sb-card">
        <div className="sb-card__header">
          <h2 className="sb-card__title">
            Pacientes{" "}
            {data && (
              <span className="texto-suave mono" style={{ fontWeight: 400 }}>
                {data.pagination.total}
              </span>
            )}
          </h2>
          <div className="ferramentas">
            <input
              type="search"
              className="sb-input sb-input--sm"
              placeholder="Nome ou CPF…"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                resetar();
              }}
              aria-label="Buscar pacientes por nome ou CPF"
            />
            <select
              className="sb-input sb-input--sm"
              value={filtroAtivo}
              onChange={(e) => {
                setFiltroAtivo(e.target.value);
                resetar();
              }}
              aria-label="Situação"
            >
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
              <option value="">Todos</option>
            </select>
            <button type="button" className="sb-btn sb-btn--primary" onClick={() => setModalAberto(true)}>
              <Icone nome="mais" />
              Novo paciente
            </button>
          </div>
        </div>

        {carregando ? (
          <Carregando mensagem="Carregando pacientes…" />
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
                    <th scope="col">Nascimento</th>
                    <th scope="col">CPF</th>
                    <th scope="col">Responsável</th>
                    <th scope="col">Telefone</th>
                    <th scope="col">CID</th>
                    <th scope="col">Convênios</th>
                  </tr>
                </thead>
                <tbody>
                  {pacientes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="vazio">
                        Nenhum paciente encontrado.
                      </td>
                    </tr>
                  ) : (
                    pacientes.map((p) => (
                      <tr key={p.id}>
                        <td className="sb-strong">
                          <Link href={`/pacientes/${p.id}`}>{p.nome}</Link>
                          {!p.ativo && (
                            <>
                              {" "}
                              <Badge>Inativo</Badge>
                            </>
                          )}
                        </td>
                        <td className="sb-mono">{formatarData(p.dataNascimento)}</td>
                        <td className="sb-mono">{p.cpf || "—"}</td>
                        <td>{p.responsavel || "—"}</td>
                        <td className="sb-mono">{p.telefone || "—"}</td>
                        <td className="sb-mono">{p.cid || "—"}</td>
                        <td>{(p.vinculos ?? []).map((v) => v.convenio?.nome).join(", ") || "—"}</td>
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
        titulo="Novo paciente"
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={fechar}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-paciente" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        <FormPaciente id="form-paciente" form={form} aoMudar={aoMudar} aoEnviar={aoEnviar} />
      </Modal>
    </>
  );
}

export default comUrl(PacientesPage);
