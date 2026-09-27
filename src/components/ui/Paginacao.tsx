export default function Paginacao({
  pagina,
  totalPaginas,
  onPagina,
}: {
  pagina: number;
  totalPaginas: number;
  onPagina: (p: number) => void;
}) {
  if (totalPaginas <= 1) return null;

  const paginas: (number | "...")[] = [1];
  const inicio = Math.max(2, pagina - 2);
  const fim = Math.min(totalPaginas - 1, pagina + 2);
  if (inicio > 2) paginas.push("...");
  for (let i = inicio; i <= fim; i++) paginas.push(i);
  if (fim < totalPaginas - 1) paginas.push("...");
  paginas.push(totalPaginas);

  const ir = (p: number) => p >= 1 && p <= totalPaginas && onPagina(p);

  return (
    <nav
      aria-label="Paginação"
      style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center", marginTop: "16px" }}
    >
      <button className="btn btn-secondary btn-sm" onClick={() => ir(pagina - 1)} disabled={pagina === 1} aria-label="Página anterior">
        ‹
      </button>
      {paginas.map((p, i) =>
        p === "..." ? (
          <span key={`el-${i}`} style={{ padding: "0 4px", color: "var(--color-gray-500)" }} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={p}
            className={`btn btn-sm ${pagina === p ? "btn-primary" : "btn-secondary"}`}
            onClick={() => ir(p)}
            aria-label={`Ir para página ${p}`}
            aria-current={pagina === p ? "page" : undefined}
          >
            {p}
          </button>
        ),
      )}
      <button
        className="btn btn-secondary btn-sm"
        onClick={() => ir(pagina + 1)}
        disabled={pagina === totalPaginas}
        aria-label="Próxima página"
      >
        ›
      </button>
    </nav>
  );
}
