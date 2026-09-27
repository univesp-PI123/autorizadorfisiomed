"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { mensagemDeErro } from "@/lib/cliente/api";
import { authService } from "@/lib/cliente/servicos";

export default function FormLogin({ sessaoExpirou }: { sessaoExpirou: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", senha: "" });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(sessaoExpirou ? "Sua sessão expirou. Entre novamente." : "");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const aoMudar = (e: ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setErro("");
  };

  const aoEnviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    setCarregando(true);
    try {
      await authService.login(form.email, form.senha);
      router.replace("/dashboard");
    } catch (err) {
      setErro(mensagemDeErro(err, "Erro ao fazer login. Tente novamente."));
      setCarregando(false);
    }
  };

  return (
    <div className="login-page">
      <main className="login-card" id="main-content">
        <div className="login-logo">
          <span aria-hidden="true" className="login-logo-icon">
            🧩
          </span>
          <div>
            <h1 className="login-titulo">Fisiomed ABA</h1>
            <p className="login-subtitulo">Gestão de Convênios</p>
          </div>
        </div>

        <form onSubmit={aoEnviar} noValidate aria-label="Formulário de login">
          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label className="form-label" htmlFor="email">
              E-mail <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={`form-control ${erro ? "error" : ""}`}
              value={form.email}
              onChange={aoMudar}
              autoComplete="email"
              autoFocus
              aria-required="true"
              aria-describedby={erro ? "login-erro" : undefined}
              placeholder="seu@email.com"
            />
          </div>

          <div className="form-group" style={{ marginBottom: "8px" }}>
            <label className="form-label" htmlFor="senha">
              Senha <span className="required" aria-hidden="true">*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="senha"
                name="senha"
                type={mostrarSenha ? "text" : "password"}
                className={`form-control ${erro ? "error" : ""}`}
                value={form.senha}
                onChange={aoMudar}
                autoComplete="current-password"
                aria-required="true"
                aria-describedby={erro ? "login-erro" : undefined}
                placeholder="Sua senha"
                style={{ paddingRight: "40px" }}
              />
              <button
                type="button"
                onClick={() => setMostrarSenha((v) => !v)}
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                {mostrarSenha ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {erro && (
            <p id="login-erro" role="alert" className="form-error" style={{ marginBottom: "12px" }}>
              {erro}
            </p>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: "100%", marginTop: "8px", justifyContent: "center" }}
            disabled={carregando}
            aria-busy={carregando}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </main>
    </div>
  );
}
