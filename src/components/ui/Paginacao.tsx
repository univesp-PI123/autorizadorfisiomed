export default function Paginacao({
  pagina,
  totalPaginas,
  total,
  onPagina,
}: {
  pagina: number;
  totalPaginas: number;
  total?: number;
  onPagina: (p: number) => void;
}) {
  if (totalPaginas <= 1) return null;

  const paginas: (number | "...")[] = [1];
  const inicio = Math.max(2, pagina - 1);
  const fim = Math.min(totalPaginas - 1, pagina + 1);
  if (inicio > 2) paginas.push("...");
  for (let i = inicio; i <= fim; i++) paginas.push(i);
  if (fim < totalPaginas - 1) paginas.push("...");
  paginas.push(totalPaginas);

  const ir = (p: number) => p >= 1 && p <= totalPaginas && onPagina(p);

  return (
    <nav className="paginacao" aria-label="Paginação">
      <span className="texto-suave">
        Página <span className="mono">{pagina}</span> de <span className="mono">{totalPaginas}</span>
        {total !== undefined && (
          <>
            {" "}· <span className="mono">{total}</span> registros
          </>
        )}
      </span>
      <div className="paginacao__botoes">
        <button type="button" className="sb-btn" onClick={() => ir(pagina - 1)} disabled={pagina === 1} aria-label="Página anterior">
          ‹
        </button>
        {paginas.map((p, i) =>
          p === "..." ? (
            <span key={`r-${i}`} className="texto-suave" style={{ padding: "0 4px", alignSelf: "center" }} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              type="button"
              key={p}
              className="sb-btn"
              onClick={() => ir(p)}
              aria-label={`Página ${p}`}
              aria-current={pagina === p ? "page" : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button
          type="button"
          className="sb-btn"
          onClick={() => ir(pagina + 1)}
          disabled={pagina === totalPaginas}
          aria-label="Próxima página"
        >
          ›
        </button>
      </div>
    </nav>
  );
}
