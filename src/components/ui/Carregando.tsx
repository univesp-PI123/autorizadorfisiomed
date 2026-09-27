export default function Carregando({ mensagem = "Carregando…" }: { mensagem?: string }) {
  return (
    <div className="carregando" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{mensagem}</span>
    </div>
  );
}
