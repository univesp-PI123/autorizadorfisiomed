const CONFIG: Record<string, { classe: string; label: string }> = {
  autorizada: { classe: "badge-success", label: "Autorizada" },
  pendente: { classe: "badge-pending", label: "Pendente" },
  em_analise: { classe: "badge-info", label: "Em análise" },
  negada: { classe: "badge-danger", label: "Negada" },
  vencida: { classe: "badge-warning", label: "Vencida" },
  cancelada: { classe: "badge-gray", label: "Cancelada" },
  esgotada: { classe: "badge-gray", label: "Esgotada" },
  // Cobrança de atendimentos
  faturado: { classe: "badge-info", label: "Faturado" },
  pago: { classe: "badge-success", label: "Pago" },
  glosado: { classe: "badge-danger", label: "Glosado" },
  cancelado: { classe: "badge-gray", label: "Cancelado" },
};

export function rotuloStatus(status: string) {
  return CONFIG[status]?.label ?? status;
}

export default function StatusBadge({ status }: { status: string }) {
  const cfg = CONFIG[status] ?? { classe: "badge-gray", label: status };
  return <span className={`badge ${cfg.classe}`}>{cfg.label}</span>;
}
