export default function MensagemErro({ mensagem, onRetry }: { mensagem: string; onRetry?: () => void }) {
  return (
    <div className="sb-card erro-carga" role="alert">
      <p>{mensagem}</p>
      {onRetry && (
        <button type="button" className="sb-btn" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
