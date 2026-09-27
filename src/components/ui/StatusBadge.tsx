// Status em badges discretos do Sóbrio: o texto sempre diz o estado; a cor
// (sucesso, atenção, erro, neutro) só reforça.
type Tom = "success" | "warning" | "danger" | "neutro";

const CONFIG: Record<string, { tom: Tom; label: string }> = {
  // Autorização
  pendente: { tom: "warning", label: "Pendente" },
  em_analise: { tom: "warning", label: "Em análise" },
  autorizada: { tom: "success", label: "Autorizada" },
  negada: { tom: "danger", label: "Negada" },
  vencida: { tom: "danger", label: "Vencida" },
  cancelada: { tom: "neutro", label: "Cancelada" },
  esgotada: { tom: "neutro", label: "Esgotada" },
  // Cobrança do atendimento (o "pendente" de cima serve aos dois)
  faturado: { tom: "neutro", label: "Faturado" },
  pago: { tom: "success", label: "Pago" },
  glosado: { tom: "danger", label: "Glosado" },
  cancelado: { tom: "neutro", label: "Cancelado" },
};

export function rotuloStatus(status: string) {
  return CONFIG[status]?.label ?? status;
}

export function Badge({ tom = "neutro", children }: { tom?: Tom; children: React.ReactNode }) {
  return <span className={`sb-badge ${tom === "neutro" ? "" : `sb-badge--${tom}`}`}>{children}</span>;
}

export default function StatusBadge({ status }: { status: string }) {
  const cfg = CONFIG[status] ?? { tom: "neutro" as const, label: status };
  return <Badge tom={cfg.tom}>{cfg.label}</Badge>;
}
