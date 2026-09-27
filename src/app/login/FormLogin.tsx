"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Icone from "@/components/Icone";
import Marca from "@/components/Marca";
import { mensagemDeErro } from "@/lib/cliente/api";
import { authService } from "@/lib/cliente/servicos";

// Tela de login do Sóbrio (componente Auth): imagem da marca ao fundo, cartão
// centralizado e rodapé só com copyright e versão.
export default function FormLogin({
  sessaoExpirou,
  versao,
  ano,
}: {
  sessaoExpirou: boolean;
  versao: string;
  ano: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(sessaoExpirou ? "Sua sessão expirou. Entre novamente." : "");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    setCarregando(true);
    try {
      await authService.login(email, senha);
      router.replace("/dashboard");
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível entrar. Tente novamente."));
      setCarregando(false);
    }
  };

  const erroCampo = erro ? "sb-field sb-field--error" : "sb-field";

  return (
    <div className="sb-auth" style={{ "--sb-auth-bg": "url(/fundo-login.webp)" } as React.CSSProperties}>
      <main className="sb-auth__center" id="conteudo">
        <div className="sb-auth__card">
          <div className="sb-auth__logo">
            <Marca />
            <p>Use suas credenciais para acessar o painel.</p>
          </div>
          <form className="sb-auth__form" onSubmit={aoEnviar} noValidate aria-label="Entrar no sistema">
            <div className={erroCampo}>
              <label className="sb-label" htmlFor="email">
                E-mail
              </label>
              <input
                className="sb-input"
                id="email"
                type="email"
                autoComplete="username"
                placeholder="nome@fisiomedaba.com.br"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErro("");
                }}
                aria-describedby={erro ? "login-erro" : undefined}
                aria-invalid={erro ? true : undefined}
                autoFocus
              />
            </div>
            <div className={erroCampo}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label className="sb-label" htmlFor="senha">
                  Senha
                </label>
                {/* Recuperação por e-mail ainda não configurada no servidor. */}
                <a
                  href="#"
                  style={{ fontSize: 13 }}
                  onClick={(e) => {
                    e.preventDefault();
                    toast("A recuperação de senha ainda não está disponível. Fale com o administrador do sistema.");
                  }}
                >
                  Esqueci minha senha
                </a>
              </div>
              <div className="pw">
                <input
                  className="sb-input"
                  id="senha"
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={(e) => {
                    setSenha(e.target.value);
                    setErro("");
                  }}
                  aria-describedby={erro ? "login-erro" : undefined}
                  aria-invalid={erro ? true : undefined}
                />
                <button
                  type="button"
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setMostrarSenha((v) => !v)}
                >
                  <Icone nome={mostrarSenha ? "olhoFechado" : "olho"} tamanho={17} />
                </button>
              </div>
              {erro && (
                <span id="login-erro" className="sb-help" role="alert">
                  {erro}
                </span>
              )}
            </div>
            <button
              type="submit"
              className="sb-btn sb-btn--primary sb-btn--lg sb-btn--block"
              disabled={carregando}
              aria-busy={carregando}
            >
              {carregando ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>
      </main>
      <footer className="sb-auth__footer">
        <span>© {ano} Fisiomed ABA</span>
        <span aria-hidden="true">·</span>
        <span className="sb-version">v{versao}</span>
      </footer>
    </div>
  );
}
