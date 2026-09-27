export default function MensagemErro({
  mensagem,
  onRetry,
}: {
  mensagem: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      style={{
        background: "#fee2e2",
        border: "1px solid #fca5a5",
        borderRadius: "var(--radius)",
        padding: "var(--space-4)",
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        color: "#991b1b",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "1.25rem" }}>
        ⚠️
      </span>
      <div style={{ flex: 1 }}>
        <strong>Erro: </strong>
        {mensagem}
      </div>
      {onRetry && (
        <button className="btn btn-danger btn-sm" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
