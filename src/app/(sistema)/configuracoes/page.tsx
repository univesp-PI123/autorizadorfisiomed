"use client";

import { useCallback, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import Modal from "@/components/ui/Modal";
import { useSessao } from "@/contextos/SessaoContexto";
import { formatarDataHora } from "@/lib/analiseDados";
import { mensagemDeErro } from "@/lib/cliente/api";
import { useFetch } from "@/lib/cliente/hooks";
import { usuarioService } from "@/lib/cliente/servicos";
import type { Perfil, Usuario } from "@/lib/cliente/tipos";
import { ROTULO_PERFIL } from "@/lib/navegacao";

const FORM_USUARIO = { nome: "", email: "", senha: "", perfil: "recepcionista" as Perfil };
const PERFIS: Perfil[] = ["admin", "recepcionista", "terapeuta", "financeiro"];
const SENHA_VAZIA = { senhaAtual: "", novaSenha: "", confirmar: "" };

export default function ConfiguracoesPage() {
  const { usuario } = useSessao();
  const ehAdmin = usuario.perfil === "admin";
  const [modalUsuario, setModalUsuario] = useState(false);
  const [formUsuario, setFormUsuario] = useState(FORM_USUARIO);
  const [senhaForm, setSenhaForm] = useState(SENHA_VAZIA);
  const [salvando, setSalvando] = useState(false);

  // Só o admin lista usuários (a API recusa os demais).
  const buscarUsuarios = useCallback(
    () => (ehAdmin ? usuarioService.listar() : Promise.resolve([] as Usuario[])),
    [ehAdmin],
  );
  const usuarios = useFetch(buscarUsuarios);

  const executar = async (acao: () => Promise<unknown>, sucesso: string, aoConcluir: () => void) => {
    setSalvando(true);
    try {
      await acao();
      toast.success(sucesso);
      aoConcluir();
    } catch (err) {
      toast.error(mensagemDeErro(err, "Erro ao salvar."));
    } finally {
      setSalvando(false);
    }
  };

  const aoCriarUsuario = (e: FormEvent) => {
    e.preventDefault();
    executar(() => usuarioService.criar(formUsuario), "Usuário criado com sucesso!", () => {
      setModalUsuario(false);
      setFormUsuario(FORM_USUARIO);
      usuarios.recarregar();
    });
  };

  const alternarAtivo = (u: Usuario) => {
    const acao = u.ativo ? "desativar" : "reativar";
    if (!window.confirm(`Deseja ${acao} ${u.nome}?`)) return;
    executar(() => usuarioService.atualizar(u.id, { ativo: !u.ativo }), `Usuário ${u.ativo ? "desativado" : "reativado"}.`, usuarios.recarregar);
  };

  const aoAlterarSenha = (e: FormEvent) => {
    e.preventDefault();
    if (senhaForm.novaSenha !== senhaForm.confirmar) {
      toast.error("As senhas não coincidem.");
      return;
    }
    executar(
      () => usuarioService.alterarSenha({ senhaAtual: senhaForm.senhaAtual, novaSenha: senhaForm.novaSenha }),
      "Senha alterada com sucesso!",
      () => setSenhaForm(SENHA_VAZIA),
    );
  };

  return (
    <div className="pilha" style={{ maxWidth: "900px" }}>
      <section className="card" aria-labelledby="minha-conta">
        <h2 id="minha-conta" className="titulo-secao">
          Minha conta
        </h2>
        <div style={{ marginBottom: "16px" }}>
          <p>
            <strong>Nome:</strong> {usuario.nome}
          </p>
          <p>
            <strong>E-mail:</strong> {usuario.email}
          </p>
          <p>
            <strong>Perfil:</strong> {ROTULO_PERFIL[usuario.perfil]}
          </p>
        </div>
        <form onSubmit={aoAlterarSenha} noValidate aria-labelledby="titulo-senha">
          <h3 id="titulo-senha" style={{ marginBottom: "12px", fontSize: "var(--font-size-base)", fontWeight: 600 }}>
            Alterar senha
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px", marginBottom: "12px" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="senhaAtual">
                Senha atual
              </label>
              <input id="senhaAtual" type="password" autoComplete="current-password" className="form-control" value={senhaForm.senhaAtual} onChange={(e) => setSenhaForm((s) => ({ ...s, senhaAtual: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="novaSenha">
                Nova senha (mín. 8)
              </label>
              <input id="novaSenha" type="password" autoComplete="new-password" className="form-control" value={senhaForm.novaSenha} onChange={(e) => setSenhaForm((s) => ({ ...s, novaSenha: e.target.value }))} required minLength={8} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirmarSenha">
                Confirmar nova senha
              </label>
              <input id="confirmarSenha" type="password" autoComplete="new-password" className="form-control" value={senhaForm.confirmar} onChange={(e) => setSenhaForm((s) => ({ ...s, confirmar: e.target.value }))} required />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={salvando}>
            {salvando ? "Salvando..." : "Alterar senha"}
          </button>
        </form>
      </section>

      {ehAdmin && (
        <section className="card" aria-labelledby="usuarios-sistema">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
            <h2 id="usuarios-sistema" style={{ fontWeight: 700 }}>
              Usuários do sistema
            </h2>
            <button className="btn btn-primary btn-sm" onClick={() => setModalUsuario(true)}>
              + Novo usuário
            </button>
          </div>
          {usuarios.carregando ? (
            <Carregando />
          ) : usuarios.erro ? (
            <MensagemErro mensagem={usuarios.erro} onRetry={usuarios.recarregar} />
          ) : (
            <div className="table-container">
              <table aria-label="Lista de usuários">
                <thead>
                  <tr>
                    <th scope="col">Nome</th>
                    <th scope="col">E-mail</th>
                    <th scope="col">Perfil</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Último acesso</th>
                    <th scope="col">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(usuarios.data ?? []).map((u) => (
                    <tr key={u.id}>
                      <td>
                        <strong>{u.nome}</strong>
                      </td>
                      <td>{u.email}</td>
                      <td>{ROTULO_PERFIL[u.perfil]}</td>
                      <td>
                        <span className={`badge ${u.ativo ? "badge-success" : "badge-danger"}`}>{u.ativo ? "Ativo" : "Inativo"}</span>
                      </td>
                      <td>{formatarDataHora(u.ultimoAcesso)}</td>
                      <td>
                        {u.id !== usuario.id && (
                          <button className="btn btn-secondary btn-sm" onClick={() => alternarAtivo(u)} disabled={salvando}>
                            {u.ativo ? "Desativar" : "Reativar"}
                          </button>
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
            <button className="btn btn-secondary" onClick={() => setModalUsuario(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" form="form-usuario" type="submit" disabled={salvando}>
              {salvando ? "Salvando..." : "Criar"}
            </button>
          </>
        }
      >
        <form id="form-usuario" onSubmit={aoCriarUsuario} noValidate>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label" htmlFor="u-nome">
                Nome <span className="required">*</span>
              </label>
              <input id="u-nome" type="text" className="form-control" value={formUsuario.nome} onChange={(e) => setFormUsuario((f) => ({ ...f, nome: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="u-email">
                E-mail <span className="required">*</span>
              </label>
              <input id="u-email" type="email" autoComplete="off" className="form-control" value={formUsuario.email} onChange={(e) => setFormUsuario((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="u-senha">
                Senha inicial (mín. 8) <span className="required">*</span>
              </label>
              <input id="u-senha" type="password" autoComplete="new-password" className="form-control" value={formUsuario.senha} onChange={(e) => setFormUsuario((f) => ({ ...f, senha: e.target.value }))} required minLength={8} />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="u-perfil">
                Perfil <span className="required">*</span>
              </label>
              <select id="u-perfil" className="form-control" value={formUsuario.perfil} onChange={(e) => setFormUsuario((f) => ({ ...f, perfil: e.target.value as Perfil }))}>
                {PERFIS.map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_PERFIL[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
