"use client";

import Link from "next/link";
import { useCallback } from "react";
import { GraficoBarras } from "@/components/Graficos";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import { useAlertas } from "@/contextos/AlertaContexto";
import { useSessao } from "@/contextos/SessaoContexto";
import { diasParaVencimento, formatarData, formatarMes} from "@/lib/analiseDados";
import { useFetch } from "@/lib/cliente/hooks";
import { relatorioService } from "@/lib/cliente/servicos";

function Indicador({
  rotulo,
  valor,
  sub,
  href,
}: {
  rotulo: string;
  valor: string | number;
  sub: string;
  href: string;
}) {
  return (
    <Link href={href} className="card-link">
      <div className="sb-card sb-stat">
        <span className="sb-stat__label">{rotulo}</span>
        <span className="sb-stat__value">{valor}</span>
        <span className="sb-stat__sub">{sub}</span>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { usuario } = useSessao();
  const { alertas } = useAlertas();
  const { data, carregando, erro, recarregar } = useFetch(relatorioService.dashboard);
  const buscarEvolucao = useCallback(() => relatorioService.evolucaoAtendimentos(6), []);
  const evolucao = useFetch(buscarEvolucao);

  if (carregando) return <Carregando mensagem="Carregando indicadores…" />;
  if (erro || !data) return <MensagemErro mensagem={erro ?? "Sem dados."} onRetry={recarregar} />;

  const meses = evolucao.data ?? [];
  const pontos = meses.map((m) => ({
    rotulo: formatarMes(m.mes),
    valor: m.total,
    detalhe: `${m.glosados} glosado(s) · ${m.semAutorizacao} sem autorização`,
  }));
  const pico = meses.reduce<(typeof meses)[number] | null>((p, m) => (!p || m.total > p.total ? m : p), null);

  const perfil = usuario.perfil;
  const acoes = [
    { rotulo: "Nova autorização", href: "/autorizacoes?novo=1", mostrar: perfil !== "terapeuta" },
    { rotulo: "Registrar atendimento", href: "/atendimentos?novo=1", mostrar: perfil !== "financeiro" },
    { rotulo: "Novo paciente", href: "/pacientes?novo=1", mostrar: perfil !== "financeiro" },
    { rotulo: "Ver pendentes", href: "/autorizacoes?status=pendente", mostrar: perfil !== "terapeuta" },
    { rotulo: "Relatórios", href: "/relatorios", mostrar: perfil === "admin" || perfil === "financeiro" },
  ].filter((a) => a.mostrar);

  return (
    <>
      <section className="stats" aria-label="Indicadores">
        <Indicador
          rotulo="Autorizações ativas"
          valor={data.autorizacoesAtivas}
          sub={`${data.totalPacientes} pacientes ativos`}
          href="/autorizacoes?status=autorizada"
        />
        <Indicador
          rotulo="Pendentes"
          valor={data.autorizacoesPendentes}
          sub="Aguardando resposta do convênio"
          href="/autorizacoes?status=pendente"
        />
        <Indicador
          rotulo="Vencendo em 7 dias"
          valor={data.autorizacoesVencendo}
          sub={data.autorizacoesVencendo > 0 ? "Requer atenção" : "Nenhuma no período"}
          href="/autorizacoes?vencendoEm=7"
        />
        <Indicador
          rotulo="Atendimentos no mês"
          valor={data.atendimentosMes}
          sub={`${data.semAutorizacaoMes} sem autorização`}
          href="/atendimentos"
        />
      </section>

      <section className="grid2">
        <div className="sb-card">
          <div className="sb-card__header">
            <h2 className="sb-card__title">Autorizações vencendo</h2>
            <Link href="/autorizacoes?vencendoEm=7">Ver todas</Link>
          </div>
          <div className="tabela-rolagem">
            <table className="sb-table">
              <thead>
                <tr>
                  <th scope="col">Paciente</th>
                  <th scope="col">Convênio</th>
                  <th scope="col">Procedimento</th>
                  <th scope="col" className="sb-end">
                    Sessões
                  </th>
                  <th scope="col" className="sb-end">
                    Vence em
                  </th>
                </tr>
              </thead>
              <tbody>
                {alertas.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="vazio">
                      Nenhuma autorização vence nos próximos 7 dias.
                    </td>
                  </tr>
                               ) : (
                  alertas.slice(0, 6).map((a) => {
                    const dias = diasParaVencimento(a.dataFimVigencia);

                    return (
                      <tr key={a.id}>
                        <td className="sb-strong">
                          <Link href={`/autorizacoes/${a.id}`}>
                            {a.paciente?.nome}
                          </Link>
                        </td>
                        <td>{a.convenio?.nome}</td>
                        <td>{a.procedimento}</td>
                        <td className="sb-mono sb-end">
                          {a.quantidadeUtilizada}/{a.quantidadeAutorizada ?? "—"}
                        </td>
                        <td
                          className="sb-mono sb-end"
                          title={formatarData(a.dataFimVigencia)}
                        >
                          {dias === 0 ? "hoje" : `${dias} d`}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

                <div className="pilha">
          <div className="sb-card">
            <div className="sb-card__header">
              <h2 className="sb-card__title">Ações rápidas</h2>
            </div>

            <div className="sb-card__body acoes-rapidas">
              {acoes.map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="sb-btn"
                >
                  {a.rotulo}
                </Link>
              ))}
            </div>
          </div>

          <section
            className="sb-card"
            aria-labelledby="titulo-volume"
          >
            <div className="sb-card__header">
              <h2
                className="sb-card__title"
                id="titulo-volume"
              >
                Atendimentos por mês
              </h2>

              <span
                className="caption"
                style={{ color: "var(--ink-muted)" }}
              >
                Últimos 6 meses
                {pico && pico.total > 0
                  ? ` · pico em ${formatarMes(pico.mes)}`
                  : ""}
              </span>
            </div>

            <div className="sb-card__body">
              {evolucao.carregando ? (
                <Carregando />
              ) : evolucao.erro ? (
                <MensagemErro
                  mensagem={evolucao.erro}
                  onRetry={evolucao.recarregar}
                />
              ) : (
                <GraficoBarras
                  pontos={pontos}
                  titulo="Atendimentos por mês"
                  unidade="atendimentos"
                />
              )}
            </div>
          </section>
        </div>
      </section>
    </>
  );

}