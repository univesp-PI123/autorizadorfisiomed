import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main id="conteudo" className="sb-auth">
      <div className="sb-auth__center">
        <div className="sb-auth__card" style={{ textAlign: "center" }}>
          <p className="metric" style={{ color: "var(--accent)" }}>
            404
          </p>
          <div>
            <h1 className="display">Página não encontrada</h1>
            <p className="body-lg texto-apoio" style={{ marginTop: 8 }}>
              O endereço que você tentou acessar não existe.
            </p>
          </div>
          <Link href="/dashboard" className="sb-btn sb-btn--primary sb-btn--lg sb-btn--block">
            Voltar à visão geral
          </Link>
        </div>
      </div>
    </main>
  );
}
