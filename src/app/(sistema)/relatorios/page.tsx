"use client";

import { useCallback, useState } from "react";
import { GraficoBarras, GraficoEmpilhado, type Serie } from "@/components/Graficos";
import Icone from "@/components/Icone";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import { calcularTaxaGlosa, formatarData, formatarMes } from "@/lib/analiseDados";
import { useFetch } from "@/lib/cliente/hooks";
import { atendimentoService, relatorioService } from "@/lib/cliente/servicos";
import { exportarParaCSV, exportarParaJSON } from "@/lib/exportacao";

const SERIES: Serie[] = [
  { nome: "Autorizadas", cor: "var(--serie-1)" },
  { nome: "Pendentes", cor: "var(--serie-2)" },
  { nome: "Negadas", cor: "var(--serie-3)" },
];
const STATUS_SERIES = ["autorizada", "pendente", "negada"] as const;

export default function RelatoriosPage() {
  const [meses, setMeses] = useState(6);

  const buscarEvolucao = useCallback(() => relatorioService.evolucaoAtendimentos(meses), [meses]);
  const evolucao = useFetch(buscarEvolucao);
  const porConvenio = useFetch(relatorioService.autorizacoesPorConvenio);
  const glosas = useFetch(atendimentoService.resumoGlosas);

  const linhasEvolucao = evolucao.data ?? [];
  const totalAtendimentos = linhasEvolucao.reduce((s, e) => s + e.total, 0);
  const totalGlosados = linhasEvolucao.reduce((s, e) => s + e.glosados, 0);

  const porNome = new Map<string, number[]>();
  for (const r of porConvenio.data ?? []) {
    const i = STATUS_SERIES.indexOf(r.status as (typeof STATUS_SERIES)[number]);
    if (i < 0) continue;
    const valores = porNome.get(r.convenio.nome) ?? [0, 0, 0];
    valores[i] = r.total;
    porNome.set(r.convenio.nome, valores);
  }
  const linhasConvenio = [...porNome.entries()]
    .map(([rotulo, valores]) => ({ rotulo, valores }))
    .sort((a, b) => b.valores.reduce((x, y) => x + y, 0) - a.valores.reduce((x, y) => x + y, 0));

  return (
    <>
      <section className="sb-card" id="rel-evolucao" aria-labelledby="titulo-evolucao">
        <div className="sb-card__header">
          <h2 className="sb-card__title" id="titulo-evolucao">
            Atendimentos por mês
          </h2>
          <div className="ferramentas">
            <select className="sb-input sb-input--sm" value={meses} onChange={(e) => setMeses(Number(e.target.value))} aria-label="Período">
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
            </select>
            <button type="button" className="sb-btn" onClick={() => exportarParaCSV(linhasEvolucao, "atendimentos_por_mes")}>
              <Icone nome="baixar" />
              Exportar CSV
            </button>
            <button type="button" className="sb-btn" onClick={() => exportarParaJSON(linhasEvolucao, "atendimentos_por_mes")}>
              <Icone nome="baixar" />
              Exportar JSON
            </button>
          </div>
        </div>
        {evolucao.carregando ? (
          <Carregando />
        ) : evolucao.erro ? (
          <div className="sb-card__body">
            <MensagemErro mensagem={evolucao.erro} onRetry={evolucao.recarregar} />
          </div>
        ) : (
          <>
            <div className="sb-card__body pilha">
              <p className="texto-suave">
                <span className="mono">{totalAtendimentos}</span> atendimento(s) no período · taxa de glosa{" "}
                <span className="mono">{calcularTaxaGlosa(totalAtendimentos, totalGlosados)}</span>
              </p>
              <GraficoBarras
                pontos={linhasEvolucao.map((m) => ({ rotulo: formatarMes(m.mes), valor: m.total }))}
                titulo="Atendimentos por mês"
                unidade="atendimentos"
              />
            </div>
            <div className="tabela-rolagem">
              <table className="sb-table">
                <thead>
                  <tr>
                    <th scope="col">Mês</th>
                    <th scope="col" className="sb-end">
                      Atendimentos
                    </th>
                    <th scope="col" className="sb-end">
                      Sem autorização
                    </th>
                    <th scope="col" className="sb-end">
                      Glosados
                    </th>
                    <th scope="col" className="sb-end">
                      Taxa de glosa
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhasEvolucao.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="vazio">
                        Sem atendimentos no período.
                      </td>
                    </tr>
                  ) : (
                    linhasEvolucao.map((m) => (
                      <tr key={m.mes}>
                        <td className="sb-mono">{formatarMes(m.mes)}</td>
                        <td className="sb-mono sb-end">{m.total}</td>
                        <td className="sb-mono sb-end">{m.semAutorizacao}</td>
                        <td className="sb-mono sb-end">{m.glosados}</td>
                        <td className="sb-mono sb-end">{calcularTaxaGlosa(m.total, m.glosados)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="sb-card" id="rel-convenio" aria-labelledby="titulo-convenio">
        <div className="sb-card__header">
          <h2 className="sb-card__title" id="titulo-convenio">
            Autorizações por convênio
          </h2>
        </div>
        <div className="sb-card__body">
          {porConvenio.carregando ? (
            <Carregando />
          ) : porConvenio.erro ? (
            <MensagemErro mensagem={porConvenio.erro} onRetry={porConvenio.recarregar} />
          ) : (
            <GraficoEmpilhado series={SERIES} linhas={linhasConvenio} titulo="Autorizações por convênio e status" />
          )}
        </div>
      </section>

      <section className="sb-card" id="rel-glosas" aria-labelledby="titulo-glosas">
        <div className="sb-card__header">
          <h2 className="sb-card__title" id="titulo-glosas">
            Glosas em aberto
          </h2>
          {glosas.data && (
            <span className="texto-suave">
              <span className="mono">{glosas.data.total}</span> atendimento(s)
            </span>
          )}
        </div>
        {glosas.carregando ? (
          <Carregando />
        ) : glosas.erro ? (
          <div className="sb-card__body">
            <MensagemErro mensagem={glosas.erro} onRetry={glosas.recarregar} />
          </div>
        ) : (
          <div className="tabela-rolagem">
            <table className="sb-table">
              <thead>
                <tr>
                  <th scope="col">Data</th>
                  <th scope="col">Paciente</th>
                  <th scope="col">Convênio</th>
                  <th scope="col">Procedimento</th>
                  <th scope="col">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {(glosas.data?.glosas ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="vazio">
                      Nenhuma glosa em aberto.
                    </td>
                  </tr>
                ) : (
                  glosas.data!.glosas.map((g) => (
                    <tr key={g.id}>
                      <td className="sb-mono">{formatarData(g.dataAtendimento)}</td>
                      <td className="sb-strong">{g.paciente?.nome}</td>
                      <td>{g.autorizacao?.convenio?.nome || "—"}</td>
                      <td>{g.procedimento}</td>
                      <td>{g.motivoGlosa || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
