"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import { CORES, translucida } from "@/components/graficos";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import { formatarMes, formatarMoeda } from "@/lib/analiseDados";
import { useFetch } from "@/lib/cliente/hooks";
import { relatorioService } from "@/lib/cliente/servicos";

type Metrica = {
  titulo: string;
  valor: string | number;
  icone: string;
  cor: string;
  link?: string;
  descricao?: string;
};

function CardMetrica({ titulo, valor, icone, cor, link, descricao }: Metrica) {
  const conteudo = (
    <article className="metrica-card" style={{ borderLeftColor: cor }}>
      <div className="metrica-icon" style={{ background: cor + "20" }} aria-hidden="true">
        {icone}
      </div>
      <div className="metrica-info">
        <p className="metrica-titulo">{titulo}</p>
        <p className="metrica-valor" style={{ color: cor }}>
          {valor}
        </p>
        {descricao && <p className="metrica-desc">{descricao}</p>}
      </div>
    </article>
  );
  return link ? (
    <Link href={link} style={{ textDecoration: "none" }}>
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}

export default function Dashboard() {
  const { data, carregando, erro, recarregar } = useFetch(relatorioService.dashboard);
  const buscarEvolucao = useCallback(() => relatorioService.evolucaoAtendimentos(6), []);
  const { data: evolucao } = useFetch(buscarEvolucao);

  if (carregando) return <Carregando mensagem="Carregando dashboard..." />;
  if (erro || !data) return <MensagemErro mensagem={erro ?? "Sem dados."} onRetry={recarregar} />;

  const metricas: Metrica[] = [
    { titulo: "Pacientes ativos", valor: data.totalPacientes, icone: "👤", cor: CORES.azul, link: "/pacientes" },
    { titulo: "Autorizações ativas", valor: data.autorizacoesAtivas, icone: "✅", cor: CORES.verde, link: "/autorizacoes?status=autorizada" },
    { titulo: "Pendentes de aprovação", valor: data.autorizacoesPendentes, icone: "⏳", cor: CORES.laranja, link: "/autorizacoes?status=pendente" },
    {
      titulo: "Vencendo em 7 dias",
      valor: data.autorizacoesVencendo,
      icone: "⚠️",
      cor: CORES.vermelho,
      link: "/autorizacoes?vencendoEm=7",
      descricao: data.autorizacoesVencendo > 0 ? "Requer atenção!" : undefined,
    },
    { titulo: "Atendimentos no mês", valor: data.atendimentosMes, icone: "📅", cor: "#0891b2", link: "/atendimentos" },
    { titulo: "Glosas em aberto", valor: data.glosasAberto, icone: "❌", cor: CORES.vermelho, link: "/atendimentos?statusCobranca=glosado" },
    { titulo: "Sem autorização (mês)", valor: data.semAutorizacaoMes, icone: "🚫", cor: "#9333ea", link: "/atendimentos?semAutorizacao=true" },
    { titulo: "Total glosado", valor: formatarMoeda(data.totalGlosado), icone: "💸", cor: CORES.vermelho },
  ];

  const meses = evolucao ?? [];
  const barData = {
    labels: meses.map((e) => formatarMes(e.mes)),
    datasets: [
      { label: "Total", data: meses.map((e) => e.total), backgroundColor: translucida(CORES.azul) },
      { label: "Glosados", data: meses.map((e) => e.glosados), backgroundColor: translucida(CORES.vermelho) },
      { label: "Sem autorização", data: meses.map((e) => e.semAutorizacao), backgroundColor: translucida(CORES.laranja) },
    ],
  };

  const doughnutData = {
    labels: ["Ativas (fora do prazo crítico)", "Pendentes", "Vencendo em 7 dias"],
    datasets: [
      {
        // "Vencendo" também é "ativa": separa para as fatias não se sobreporem.
        data: [
          data.autorizacoesAtivas - data.autorizacoesVencendo,
          data.autorizacoesPendentes,
          data.autorizacoesVencendo,
        ],
        backgroundColor: [CORES.verde, CORES.laranja, CORES.vermelho],
        borderWidth: 2,
      },
    ],
  };

  return (
    <div className="dashboard">
      <section aria-labelledby="metricas-titulo">
        <h2 id="metricas-titulo" className="sr-only">
          Métricas principais
        </h2>
        <div className="metricas-grid">
          {metricas.map((m) => (
            <CardMetrica key={m.titulo} {...m} />
          ))}
        </div>
      </section>

      <div className="dashboard-graficos">
        <section className="card" aria-labelledby="grafico-evolucao-titulo">
          <h2 id="grafico-evolucao-titulo" className="titulo-secao">
            Evolução de atendimentos (últimos 6 meses)
          </h2>
          <Bar
            data={barData}
            options={{ responsive: true, plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }}
            aria-label="Gráfico de barras com a evolução mensal de atendimentos"
            role="img"
          />
        </section>

        <section className="card" aria-labelledby="grafico-status-titulo">
          <h2 id="grafico-status-titulo" className="titulo-secao">
            Status das autorizações
          </h2>
          <div style={{ maxWidth: "260px", margin: "0 auto" }}>
            <Doughnut
              data={doughnutData}
              options={{ responsive: true, plugins: { legend: { position: "bottom" } } }}
              aria-label="Gráfico de rosca com a distribuição de status das autorizações"
              role="img"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
