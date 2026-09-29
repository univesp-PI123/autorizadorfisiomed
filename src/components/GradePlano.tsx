import type { Dia, ItemPlano } from "@/lib/cliente/tipos";

const DIAS: [Dia, string][] = [
  ["seg", "Seg"],
  ["ter", "Ter"],
  ["qua", "Qua"],
  ["qui", "Qui"],
  ["sex", "Sex"],
  ["sab", "Sáb"],
];

const rotulo = (e: string) => e.charAt(0) + e.slice(1).toLowerCase();

/** Sessões por semana do plano terapêutico, por especialidade e dia. */
export default function GradePlano({ itens, destaque }: { itens: ItemPlano[]; destaque?: string | null }) {
  if (!itens.length) return null;
  const total = itens.reduce((s, i) => s + i.total, 0);
  return (
    <div className="tabela-rolagem">
      <table className="sb-table grade-plano">
        <caption className="sr-only">Sessões por semana no plano terapêutico</caption>
        <thead>
          <tr>
            <th scope="col">Especialidade</th>
            {DIAS.map(([, r]) => (
              <th key={r} scope="col" className="sb-end">
                {r}
              </th>
            ))}
            <th scope="col" className="sb-end">
              Semana
            </th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.especialidade} className={destaque === i.especialidade ? "destaque" : undefined}>
              <th scope="row">{rotulo(i.especialidade)}</th>
              {DIAS.map(([d]) => (
                <td key={d} className="sb-mono sb-end">
                  {i.dias[d] ?? ""}
                </td>
              ))}
              <td className="sb-mono sb-end sb-strong">{i.total}</td>
            </tr>
          ))}
          <tr>
            <th scope="row">Total</th>
            <td colSpan={DIAS.length} />
            <td className="sb-mono sb-end sb-strong">{total}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
