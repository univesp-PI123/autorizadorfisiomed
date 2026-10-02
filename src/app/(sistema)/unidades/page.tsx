"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";
import toast from "react-hot-toast";
import Icone from "@/components/Icone";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import { Badge } from "@/components/ui/StatusBadge";
import { useSessao } from "@/contextos/SessaoContexto";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { clinicaService, unidadeService } from "@/lib/cliente/servicos";
import type { Clinica, Unidade } from "@/lib/cliente/tipos";

const CAMPOS_UNIDADE = [
  ["nome", "Nome no sistema", true],
  ["cnes", "CNES"],
  ["cep", "CEP"],
  ["tipoLogradouro", "Tipo de logradouro"],
  ["logradouro", "Logradouro", true],
  ["numero", "Número"],
  ["complemento", "Complemento"],
  ["bairro", "Bairro"],
  ["municipio", "Município"],
  ["uf", "UF"],
] as const;
type CampoUnidade = (typeof CAMPOS_UNIDADE)[number][0];
type FormUnidade = Record<CampoUnidade, string>;

const formDaUnidade = (u: Unidade): FormUnidade =>
  Object.fromEntries(CAMPOS_UNIDADE.map(([c]) => [c, u[c] ?? ""])) as FormUnidade;

const formatarCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

function FormClinica({ clinica, podeEditar, aoSalvar }: { clinica: Clinica | null; podeEditar: boolean; aoSalvar: () => void }) {
  const [form, setForm] = useState({
    razaoSocial: clinica?.razaoSocial ?? "",
    nomeFantasia: clinica?.nomeFantasia ?? "",
    cnpj: clinica ? formatarCnpj(clinica.cnpj) : "",
  });
  const [salvando, setSalvando] = useState(false);
  const aoMudar = (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await clinicaService.salvar(form);
      toast.success("Dados da clínica salvos.");
      aoSalvar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form className="sb-card" id="clinica" onSubmit={aoEnviar} noValidate aria-labelledby="titulo-clinica">
      <div className="sb-card__header">
        <h2 className="sb-card__title" id="titulo-clinica">
          Dados da clínica
        </h2>
        {!clinica && <Badge tom="warning">Não cadastrados</Badge>}
      </div>
      <div className="sb-card__body pilha">
        <p className="texto-apoio">Vão no cabeçalho das guias TISS, como contratado solicitante e executante.</p>
        <div className="form-grade">
          <div className="sb-field inteira">
            <label className="sb-label" htmlFor="cli-razao">
              Razão social<span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <input id="cli-razao" name="razaoSocial" className="sb-input" value={form.razaoSocial} onChange={aoMudar} disabled={!podeEditar} required />
          </div>
          <div className="sb-field">
            <label className="sb-label" htmlFor="cli-fantasia">
              Nome fantasia
            </label>
            <input id="cli-fantasia" name="nomeFantasia" className="sb-input" value={form.nomeFantasia} onChange={aoMudar} disabled={!podeEditar} />
          </div>
          <div className="sb-field">
            <label className="sb-label" htmlFor="cli-cnpj">
              CNPJ<span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <input id="cli-cnpj" name="cnpj" inputMode="numeric" className="sb-input mono" value={form.cnpj} onChange={aoMudar} disabled={!podeEditar} required />
          </div>
        </div>
        {podeEditar && (
          <div>
            <button type="submit" className="sb-btn sb-btn--primary" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

export default function UnidadesPage() {
  const { usuario } = useSessao();
  const podeEditar = usuario.perfil === "admin";
  const clinica = useFetch(clinicaService.buscar);
  const unidades = useFetch(unidadeService.listar);
  const [editando, setEditando] = useState<Unidade | null>(null);
  const [form, setForm] = useState<FormUnidade | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [criando, setCriando] = useState(false);
  const abrir = (u: Unidade) => {
    setEditando(u);
    setForm(formDaUnidade(u));
  };
  const abrirNova = () => {
    setCriando(true);
    setForm(Object.fromEntries(CAMPOS_UNIDADE.map(([c]) => [c, ""])) as FormUnidade);
  };
  const fechar = () => {
    setEditando(null);
    setCriando(false);
    setForm(null);
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if ((!editando && !criando) || !form) return;
    setSalvando(true);
    try {
      if (editando) await unidadeService.atualizar(editando.id, form);
      else await unidadeService.criar(form);
      toast.success(editando ? "Unidade atualizada." : "Unidade criada.");
      fechar();
      unidades.recarregar();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível salvar a unidade."));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      {clinica.carregando ? (
        <Carregando />
      ) : clinica.erro ? (
        <MensagemErro mensagem={clinica.erro} onRetry={clinica.recarregar} />
      ) : (
        <FormClinica key={clinica.data?.id ?? "nova"} clinica={clinica.data} podeEditar={podeEditar} aoSalvar={clinica.recarregar} />
      )}

      <section className="sb-card" id="unidades" aria-labelledby="titulo-unidades">
        <div className="sb-card__header">
          <h2 className="sb-card__title" id="titulo-unidades">
            Unidades de atendimento
          </h2>
          <div className="ferramentas">
            {podeEditar && (
              <button type="button" className="sb-btn sb-btn--primary" onClick={abrirNova}>
                <Icone nome="mais" />
                Nova unidade
              </button>
            )}
          </div>
        </div>
        <div className="sb-card__body">
          <p className="texto-apoio">
            A unidade de cada sessão vem da coluna &ldquo;Unidade de Atendimento&rdquo; do AnClinic; em branco, do começo da sala
            (&ldquo;SÃO MIGUEL - SALA 31&rdquo;). Ela define o CNES do pedido. Quando faltar, escolha a unidade na lista{" "}
            <Link href="/autorizacoes#a-solicitar" className="link-texto">
              A solicitar
            </Link>
            ; a escolha feita no sistema não é desfeita pelas próximas importações.
          </p>
        </div>
        {unidades.carregando ? (
          <Carregando />
        ) : unidades.erro ? (
          <div className="sb-card__body">
            <MensagemErro mensagem={unidades.erro} onRetry={unidades.recarregar} />
          </div>
        ) : (
          <div className="tabela-rolagem">
            <table className="sb-table">
              <thead>
                <tr>
                  <th scope="col">Unidade</th>
                  <th scope="col">CNES</th>
                  <th scope="col">Endereço</th>
                  <th scope="col" className="sb-end">
                    Sessões
                  </th>
                  {podeEditar && (
                    <th scope="col" className="sb-end">
                      <span className="sr-only">Ações</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {(unidades.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="vazio">
                      As unidades aparecem aqui ao importar a primeira agenda do AnClinic.
                    </td>
                  </tr>
                ) : (
                  unidades.data!.map((u) => (
                    <tr key={u.id}>
                      <td className="sb-strong">
                        {u.nome}
                        {u.nome !== u.nomeAnclinic && <span className="texto-suave">AnClinic: {u.nomeAnclinic}</span>}
                      </td>
                      <td className="sb-mono">{u.cnes ?? <Badge tom="warning">Falta CNES</Badge>}</td>
                      <td>
                        {u.logradouro
                          ? `${[u.tipoLogradouro, u.logradouro].filter(Boolean).join(" ")}, ${u.numero ?? "s/n"}${u.bairro ? ` — ${u.bairro}` : ""}`
                          : "—"}
                        {u.municipio && <span className="texto-suave">{`${u.municipio}/${u.uf ?? ""} · CEP ${u.cep ?? "—"}`}</span>}
                      </td>
                      <td className="sb-mono sb-end">{u._count?.agendamentos ?? 0}</td>
                      {podeEditar && (
                        <td className="sb-end">
                          <button type="button" className="sb-btn sb-btn--sm" onClick={() => abrir(u)} aria-label={`Editar ${u.nome}`}>
                            Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        aberto={!!editando || criando}
        onFechar={fechar}
        titulo={editando ? "Editar unidade" : "Nova unidade"}
        tamanho="lg"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={fechar}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-unidade" disabled={salvando}>
              {salvando ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        {(editando || criando) && form && (
          <form id="form-unidade" onSubmit={aoEnviar} noValidate className="pilha">
            {editando && <p className="texto-suave">Nome no AnClinic: {editando.nomeAnclinic}</p>}
            <div className="form-grade">
              {CAMPOS_UNIDADE.map(([campo, rotulo, inteira]) => (
                <div key={campo} className={`sb-field ${inteira ? "inteira" : ""}`}>
                  <label className="sb-label" htmlFor={`uni-${campo}`}>
                    {rotulo}
                  </label>
                  <input
                    id={`uni-${campo}`}
                    className={`sb-input ${campo === "cnes" || campo === "cep" ? "mono" : ""}`}
                    value={form[campo]}
                    onChange={(e) => setForm((f) => f && { ...f, [campo]: e.target.value })}
                    required={campo === "nome"}
                  />
                </div>
              ))}
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
