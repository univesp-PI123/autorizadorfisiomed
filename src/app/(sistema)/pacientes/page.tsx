"use client";

import Link from "next/link";
import { useCallback, useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import FormPaciente, { FORM_PACIENTE_VAZIO as FORM_INICIAL } from "@/components/FormPaciente";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import Paginacao from "@/components/ui/Paginacao";
import { formatarData } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch, usePaginacao } from "@/lib/cliente/hooks";
import { pacienteService } from "@/lib/cliente/servicos";


export default function PacientesPage() {
  const [busca, setBusca] = useState("");
  const [filtroAtivo, setFiltroAtivo] = useState("true");
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const { pagina, limite, setPagina, resetar } = usePaginacao(20);

  const buscar = useCallback(
    () => pacienteService.listar({ page: pagina, limit: limite, busca: busca || undefined, ativo: filtroAtivo || undefined }),
    [pagina, limite, busca, filtroAtivo],
  );
  const { data, carregando, erro, recarregar } = useFetch(buscar);
  const pacientes = data?.data ?? [];

  const aoMudar = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const fechar = () => {
    setModalAberto(false);
    setForm(FORM_INICIAL);
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await pacienteService.criar(form);
      toast.success("Paciente cadastrado com sucesso!");
      fechar();
      recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Erro ao salvar paciente."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div>
      <div className="barra-acoes">
        <input
          type="search"
          className="form-control"
          placeholder="Buscar por nome ou CPF..."
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            resetar();
          }}
          aria-label="Buscar pacientes"
          style={{ maxWidth: "300px" }}
        />
        <select
          className="form-control"
          value={filtroAtivo}
          onChange={(e) => {
            setFiltroAtivo(e.target.value);
            resetar();
          }}
          aria-label="Filtrar por situação"
          style={{ maxWidth: "160px" }}
        >
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
          <option value="">Todos</option>
        </select>
        <button className="btn btn-primary empurra" onClick={() => setModalAberto(true)}>
          + Novo paciente
        </button>
      </div>

      {carregando && <Carregando mensagem="Carregando pacientes..." />}
      {erro && <MensagemErro mensagem={erro} onRetry={recarregar} />}

      {!carregando && !erro && (
        <>
          <div className="table-container">
            <table aria-label="Lista de pacientes">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Data nasc.</th>
                  <th scope="col">CPF</th>
                  <th scope="col">Responsável</th>
                  <th scope="col">Telefone</th>
                  <th scope="col">CID</th>
                  <th scope="col">Convênios</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {pacientes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="vazio">
                      Nenhum paciente encontrado.
                    </td>
                  </tr>
                ) : (
                  pacientes.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.nome}</strong>
                      </td>
                      <td>{formatarData(p.dataNascimento)}</td>
                      <td>{p.cpf || "—"}</td>
                      <td>{p.responsavel || "—"}</td>
                      <td>{p.telefone || "—"}</td>
                      <td>{p.cid || "—"}</td>
                      <td>
                        {(p.vinculos ?? []).map((v) => (
                          <span key={v.id} className="badge badge-info" style={{ marginRight: "4px" }}>
                            {v.convenio?.nome}
                          </span>
                        ))}
                      </td>
                      <td>
                        <Link href={`/pacientes/${p.id}`} className="btn btn-secondary btn-sm" aria-label={`Ver ${p.nome}`}>
                          Ver
                        </Link>
                      </td>
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
        titulo="Novo paciente"
        tamanho="lg"
        rodape={
          <>
            <button className="btn btn-secondary" onClick={fechar}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="form-paciente" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </>
        }
      >
        <FormPaciente id="form-paciente" form={form} aoMudar={aoMudar} aoEnviar={aoEnviar} />
      </Modal>
    </div>
  );
}
