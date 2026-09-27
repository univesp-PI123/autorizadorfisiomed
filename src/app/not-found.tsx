import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main
      id="main-content"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px" }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "6rem", lineHeight: 1 }} aria-hidden="true">
          🔍
        </p>
        <h1 style={{ fontSize: "var(--font-size-2xl)", fontWeight: 800, marginBottom: "8px" }}>
          Página não encontrada
        </h1>
        <p style={{ color: "var(--color-gray-500)", marginBottom: "24px" }}>
          O endereço que você tentou acessar não existe.
        </p>
        <Link href="/dashboard" className="btn btn-primary">
          Voltar ao Dashboard
        </Link>
      </div>
    </main>
  );
}
