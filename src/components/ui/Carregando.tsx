export default function Carregando({ mensagem = "Carregando..." }: { mensagem?: string }) {
  return (
    <div className="carregando" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <span>{mensagem}</span>
    </div>
  );
}
