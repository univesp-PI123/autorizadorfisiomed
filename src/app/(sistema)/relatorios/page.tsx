"use client";

import { useCallback, useState } from "react";
import { Bar } from "react-chartjs-2";
import { CORES, translucida } from "@/components/graficos";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import { calcularTaxaGlosa, formatarData, formatarMes, formatarMoeda } from "@/lib/analiseDados";
import { useFetch } from "@/lib/cliente/hooks";
import { atendimentoService, relatorioService } from "@/lib/cliente/servicos";
import { exportarParaCSV, exportarParaJSON } from "@/lib/exportacao";

const OPCOES_GRAFICO = {
  responsive: true,
  plugins: { legend: { position: "top" as const } },
  scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
};

export default function RelatoriosPage() {
  const [meses, setMeses] = useState(6);

  const buscarEvolucao = useCallback(() => relatorioService.evolucaoAtendimentos(meses), [meses]);
  const evolucao = useFetch(buscarEvolucao);
  const porConvenio = useFetch(relatorioService.autorizacoesPorConvenio);
  const glosas = useFetch(atendimentoService.resumoGlosas);

  const linhasEvolucao = evolucao.data ?? [];
  const totalAtendimentos = linhasEvolucao.reduce((s, e) => s + e.total, 0);
  const totalGlosados = linhasEvolucao.reduce((s, e) => s + e.glosados, 0);

  const conveniosMap: Record<string, { autorizada: number; pendente: number; negada: number }> = {};
  for (const r of porConvenio.data ?? []) {
    const nome = r.convenio.nome;
    conveniosMap[nome] ??= { autorizada: 0, pendente: 0, negada: 0 };
    if (r.status === "autorizada" || r.status === "pendente" || r.status === "negada") {
      conveniosMap[nome][r.status] = r.total;
    }
  }
  const convenioLabels = Object.keys(conveniosMap);

  const barConvenio = {
    labels: convenioLabels,
    datasets: [
      { label: "Autorizadas", data: convenioLabels.map((c) => conveniosMap[c].autorizada), backgroundColor: translucida(CORES.verde) },
      { label: "Pendentes", data: convenioLabels.map((c) => conveniosMap[c].pendente), backgroundColor: translucida(CORES.laranja) },
      { label: "Negadas", data: convenioLabels.map((c) => conveniosMap[c].negada), backgroundColor: translucida(CORES.vermelho) },
    ],
  };

  const barEvolucao = {
    labels: linhasEvolucao.map((e) => formatarMes(e.mes)),
    datasets: [
      { label: "Atendimentos", data: linhasEvolucao.map((e) => e.total), backgroundColor: translucida(CORES.azul) },
      { label: "Glosados", data: linhasEvolucao.map((e) => e.glosados), backgroundColor: translucida(CORES.vermelho) },
      { label: "Sem autorização", data: linhasEvolucao.map((e) => e.semAutorizacao), backgroundColor: translucida(CORES.laranja) },
    ],
  };

  return (
    <div className="pilha">
      <div className="barra-acoes" style={{ marginBottom: 0 }}>
        <label className="form-label" htmlFor="meses-sel" style={{ margin: 0 }}>
          Período:
        </label>
        <select id="meses-sel" className="form-control" value={meses} onChange={(e) => setMeses(Number(e.target.value))} style={{ maxWidth: "180px" }}>
          <option value={3}>Últimos 3 meses</option>
          <option value={6}>Últimos 6 meses</option>
          <option value={12}>Último ano</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => exportarParaCSV(linhasEvolucao, "evolucao_atendimentos")}>
          ⬇ Exportar CSV
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => exportarParaJSON(linhasEvolucao, "evolucao_atendimentos")}>
          ⬇ Exportar JSON
        </button>
      </div>

      <section className="card" aria-labelledby="rel-evolucao">
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
          <h2 id="rel-evolucao" style={{ fontWeight: 700 }}>
            Evolução de atendimentos
          </h2>
          {!evolucao.carregando && (
            <span className="texto-suave">
              {totalAtendimentos} atendimento(s) · taxa de glosa {calcularTaxaGlosa(totalAtendimentos, totalGlosados)}
            </span>
          )}
        </div>
        {evolucao.carregando ? (
          <Carregando />
        ) : evolucao.erro ? (
          <MensagemErro mensagem={evolucao.erro} onRetry={evolucao.recarregar} />
        ) : (
          <Bar data={barEvolucao} options={OPCOES_GRAFICO} aria-label="Gráfico de atendimentos por mês" role="img" />
        )}
      </section>

      <section className="card" aria-labelledby="rel-convenio">
        <h2 id="rel-convenio" className="titulo-secao">
          Autorizações por convênio
        </h2>
        {porConvenio.carregando ? (
          <Carregando />
        ) : porConvenio.erro ? (
          <MensagemErro mensagem={porConvenio.erro} onRetry={porConvenio.recarregar} />
        ) : (
          <Bar data={barConvenio} options={OPCOES_GRAFICO} aria-label="Gráfico de autorizações por convênio" role="img" />
        )}
      </section>

      <section className="card" aria-labelledby="rel-glosas">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
          <h2 id="rel-glosas" style={{ fontWeight: 700 }}>
            Glosas em aberto
          </h2>
          {glosas.data && (
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <span style={{ color: "var(--color-danger)", fontWeight: 700 }}>{glosas.data.total} atendimento(s) glosado(s)</span>
              <span style={{ color: "var(--color-danger)", fontWeight: 700 }}>Total: {formatarMoeda(glosas.data.totalGlosado)}</span>
            </div>
          )}
        </div>
        {glosas.carregando ? (
          <Carregando />
        ) : glosas.erro ? (
          <MensagemErro mensagem={glosas.erro} onRetry={glosas.recarregar} />
        ) : (
          <div className="table-container">
            <table aria-label="Tabela de glosas">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Paciente</th>
                  <th scope="col">Convênio</th>
                  <th scope="col">Procedimento</th>
                  <th scope="col">Motivo</th>
                  <th scope="col">Valor cobrado</th>
                </tr>
              </thead>
              <tbody>
                {(glosas.data?.glosas ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="vazio">
                      Nenhuma glosa encontrada.
                    </td>
                  </tr>
                ) : (
                  glosas.data!.glosas.map((g) => (
                    <tr key={g.id}>
                      <td>{formatarData(g.dataAtendimento)}</td>
                      <td>{g.paciente?.nome}</td>
                      <td>{g.autorizacao?.convenio?.nome || "—"}</td>
                      <td>{g.procedimento}</td>
                      <td>{g.motivoGlosa || "—"}</td>
                      <td style={{ color: "var(--color-danger)", fontWeight: 600 }}>{formatarMoeda(g.valorCobrado)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
