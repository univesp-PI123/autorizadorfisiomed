"use client";

import { useCallback, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Icone from "@/components/Icone";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import { Badge } from "@/components/ui/StatusBadge";
import { useSessao } from "@/contextos/SessaoContexto";
import { formatarDataHora } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { usuarioService } from "@/lib/cliente/servicos";
import type { Perfil, Usuario } from "@/lib/cliente/tipos";

const FORM_USUARIO = { nome: "", email: "", senha: "", perfil: "atendente" as Perfil };
const ROTULO_PERFIL: Record<Perfil, string> = { admin: "Administrador", atendente: "Atendente" };
const SENHA_VAZIA = { senhaAtual: "", novaSenha: "", confirmar: "" };

export default function ConfiguracoesPage() {
  const { usuario, ehAdmin } = useSessao();
  const [modalUsuario, setModalUsuario] = useState(false);
  const [formUsuario, setFormUsuario] = useState(FORM_USUARIO);
  const [senhaForm, setSenhaForm] = useState(SENHA_VAZIA);
  const [salvando, setSalvando] = useState(false);

  // Só o administrador vê e gerencia os usuários (a API recusa o atendente).
  const listarUsuarios = useCallback(() => (ehAdmin ? usuarioService.listar() : Promise.resolve([] as Usuario[])), [ehAdmin]);
  const usuarios = useFetch(listarUsuarios);

  const executar = async (acao: () => Promise<unknown>, sucesso: string, aoConcluir: () => void) => {
    setSalvando(true);
    try {
      await acao();
      toast.success(sucesso);
      aoConcluir();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Não foi possível salvar."));
    } finally {
      setSalvando(false);
    }
  };

  const aoCriarUsuario = (e: FormEvent) => {
    e.preventDefault();
    executar(() => usuarioService.criar(formUsuario), "Usuário criado.", () => {
      setModalUsuario(false);
      setFormUsuario(FORM_USUARIO);
      usuarios.recarregar();
    });
  };

  const alternarAtivo = (u: Usuario) => {
    if (!window.confirm(`${u.ativo ? "Desativar" : "Reativar"} ${u.nome}?`)) return;
    executar(
      () => usuarioService.atualizar(u.id, { ativo: !u.ativo }),
      u.ativo ? "Usuário desativado." : "Usuário reativado.",
      usuarios.recarregar,
    );
  };

  const alternarPerfil = (u: Usuario) => {
    const novo: Perfil = u.perfil === "admin" ? "atendente" : "admin";
    if (!window.confirm(`Mudar ${u.nome} para ${ROTULO_PERFIL[novo]}?`)) return;
    executar(() => usuarioService.atualizar(u.id, { perfil: novo }), "Perfil alterado.", usuarios.recarregar);
  };

  const aoAlterarSenha = (e: FormEvent) => {
    e.preventDefault();
    if (senhaForm.novaSenha !== senhaForm.confirmar) {
      toast.error("A confirmação não confere com a nova senha.");
      return;
    }
    executar(
      () => usuarioService.alterarSenha({ senhaAtual: senhaForm.senhaAtual, novaSenha: senhaForm.novaSenha }),
      "Senha alterada.",
      () => setSenhaForm(SENHA_VAZIA),
    );
  };

  const campoSenha = (campo: keyof typeof SENHA_VAZIA, rotulo: string, autoComplete: string) => (
    <div className="sb-field">
      <label className="sb-label" htmlFor={`senha-${campo}`}>
        {rotulo}
      </label>
      <input
        id={`senha-${campo}`}
        type="password"
        autoComplete={autoComplete}
        className="sb-input"
        value={senhaForm[campo]}
        onChange={(e) => setSenhaForm((s) => ({ ...s, [campo]: e.target.value }))}
        required
      />
    </div>
  );

  return (
    <>
      <section className="grid-meio">
        <div className="sb-card" id="minha-conta">
          <div className="sb-card__header">
            <h2 className="sb-card__title">Minha conta</h2>
          </div>
          <div className="sb-card__body">
            <dl className="dl-grade">
              <div className="inteira">
                <dt>Nome</dt>
                <dd>{usuario.nome}</dd>
              </div>
              <div>
                <dt>E-mail</dt>
                <dd>{usuario.email}</dd>
              </div>
            </dl>
          </div>
        </div>

        <form className="sb-card" onSubmit={aoAlterarSenha} noValidate aria-labelledby="titulo-senha">
          <div className="sb-card__header">
            <h2 className="sb-card__title" id="titulo-senha">
              Alterar senha
            </h2>
          </div>
          <div className="sb-card__body pilha">
            {campoSenha("senhaAtual", "Senha atual", "current-password")}
            {campoSenha("novaSenha", "Nova senha", "new-password")}
            {campoSenha("confirmar", "Confirmar nova senha", "new-password")}
            <span className="sb-help">Mínimo de 8 caracteres.</span>
            <div>
              <button type="submit" className="sb-btn" disabled={salvando}>
                {salvando ? "Salvando…" : "Alterar senha"}
              </button>
            </div>
          </div>
        </form>
      </section>

      {ehAdmin && (
      <section className="sb-card" id="usuarios-sistema" aria-labelledby="titulo-usuarios">
        <div className="sb-card__header">
          <h2 className="sb-card__title" id="titulo-usuarios">
            Usuários do sistema
          </h2>
          <button type="button" className="sb-btn sb-btn--primary" onClick={() => setModalUsuario(true)}>
            <Icone nome="mais" />
            Novo usuário
          </button>
        </div>
        {usuarios.carregando ? (
          <Carregando />
        ) : usuarios.erro ? (
          <div className="sb-card__body">
            <MensagemErro mensagem={usuarios.erro} onRetry={usuarios.recarregar} />
          </div>
        ) : (
          <div className="tabela-rolagem">
            <table className="sb-table">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">E-mail</th>
                  <th scope="col">Perfil</th>
                  <th scope="col">Situação</th>
                  <th scope="col" className="sb-end">
                    Último acesso
                  </th>
                  <th scope="col" className="sb-end">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(usuarios.data ?? []).map((u) => (
                  <tr key={u.id}>
                    <td className="sb-strong">{u.nome}</td>
                    <td>{u.email}</td>
                    <td>{ROTULO_PERFIL[u.perfil]}</td>
                    <td>{u.ativo ? <Badge tom="success">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                    <td className="sb-mono sb-end">{formatarDataHora(u.ultimoAcesso)}</td>
                    <td className="sb-end">
                      {u.id !== usuario.id && (
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <button type="button" className="sb-btn sb-btn--sm" onClick={() => alternarPerfil(u)} disabled={salvando}>
                            {u.perfil === "admin" ? "Tornar atendente" : "Tornar administrador"}
                          </button>
                          <button type="button" className="sb-btn sb-btn--sm" onClick={() => alternarAtivo(u)} disabled={salvando}>
                            {u.ativo ? "Desativar" : "Reativar"}
                          </button>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      <Modal
        aberto={modalUsuario}
        onFechar={() => {
          setModalUsuario(false);
          setFormUsuario(FORM_USUARIO);
        }}
        titulo="Novo usuário"
        rodape={
          <>
            <button type="button" className="sb-btn" onClick={() => setModalUsuario(false)}>
              Cancelar
            </button>
            <button type="submit" className="sb-btn sb-btn--primary" form="form-usuario" disabled={salvando}>
              {salvando ? "Salvando…" : "Criar usuário"}
            </button>
          </>
        }
      >
        <form id="form-usuario" onSubmit={aoCriarUsuario} noValidate className="pilha">
          <div className="sb-field">
            <label className="sb-label" htmlFor="u-nome">
              Nome<span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <input id="u-nome" className="sb-input" value={formUsuario.nome} onChange={(e) => setFormUsuario((f) => ({ ...f, nome: e.target.value }))} required />
          </div>
          <div className="sb-field">
            <label className="sb-label" htmlFor="u-email">
              E-mail<span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <input id="u-email" type="email" autoComplete="off" className="sb-input" value={formUsuario.email} onChange={(e) => setFormUsuario((f) => ({ ...f, email: e.target.value }))} required />
          </div>
          <div className="sb-field">
            <label className="sb-label" htmlFor="u-perfil">
              Perfil
            </label>
            <select
              id="u-perfil"
              className="sb-input"
              value={formUsuario.perfil}
              onChange={(e) => setFormUsuario((f) => ({ ...f, perfil: e.target.value as Perfil }))}
              aria-describedby="u-perfil-ajuda"
            >
              <option value="atendente">Atendente</option>
              <option value="admin">Administrador</option>
            </select>
            <span id="u-perfil-ajuda" className="sb-help">
              O atendente faz o trabalho do dia e consulta os cadastros. O administrador também edita os cadastros, gerencia
              os usuários e baixa os XMLs da operadora.
            </span>
          </div>
          <div className="sb-field">
            <label className="sb-label" htmlFor="u-senha">
              Senha inicial<span className="obrigatorio" aria-hidden="true">*</span>
            </label>
            <input
              id="u-senha"
              type="password"
              autoComplete="new-password"
              className="sb-input"
              value={formUsuario.senha}
              onChange={(e) => setFormUsuario((f) => ({ ...f, senha: e.target.value }))}
              required
              aria-describedby="u-senha-ajuda"
            />
            <span id="u-senha-ajuda" className="sb-help">
              Mínimo de 8 caracteres. A pessoa pode trocá-la depois em Configurações.
            </span>
          </div>
        </form>
      </Modal>
    </>
  );
}
