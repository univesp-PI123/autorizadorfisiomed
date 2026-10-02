"use client";

import Link from "next/link";
import { useCallback } from "react";
import { GraficoBarras } from "@/components/Graficos";
import Carregando from "@/components/ui/Carregando";
import MensagemErro from "@/components/ui/MensagemErro";
import { useSessao } from "@/contextos/SessaoContexto";
import { formatarData, formatarMes } from "@/lib/analiseDados";
import { useFetch } from "@/lib/cliente/hooks";
import { relatorioService } from "@/lib/cliente/servicos";

function Indicador({ rotulo, valor, sub, href }: { rotulo: string; valor: number; sub: string; href: string }) {
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

// Painel do dia: o que pedir, o que espera a operadora, as negativas para
// tratar e os atendimentos — tudo em quantidades.
export default function Dashboard() {
  const { usuario } = useSessao();
  const { data, carregando, erro, recarregar } = useFetch(relatorioService.dashboard);
  const buscarEvolucao = useCallback(() => relatorioService.evolucaoAtendimentos(6), []);
  const evolucao = useFetch(buscarEvolucao);

  if (carregando) return <Carregando mensagem="Carregando o painel…" />;
  if (erro || !data) return <MensagemErro mensagem={erro ?? "Sem dados."} onRetry={recarregar} />;

  const meses = evolucao.data ?? [];
  const pontos = meses.map((m) => ({
    rotulo: formatarMes(m.mes),
    valor: m.total,
    detalhe: `${m.glosados} glosado(s) · ${m.semAutorizacao} sem autorização`,
  }));
  const pico = meses.reduce<(typeof meses)[number] | null>((p, m) => (!p || m.total > p.total ? m : p), null);

  const perfil = usuario.perfil;
  const operador = perfil === "admin" || perfil === "recepcionista";
  const pedeAutorizacao = perfil !== "terapeuta";
  const acoes = [
    { rotulo: "Importar agenda do dia", href: "/autorizacoes?importar=1", mostrar: operador },
    { rotulo: "Nova autorização", href: "/autorizacoes?novo=1", mostrar: pedeAutorizacao },
    { rotulo: "Registrar atendimento", href: "/atendimentos?novo=1", mostrar: operador },
    { rotulo: "Novo paciente", href: "/pacientes?novo=1", mostrar: perfil !== "financeiro" },
    { rotulo: "Relatórios", href: "/relatorios", mostrar: perfil === "admin" || perfil === "financeiro" },
  ].filter((a) => a.mostrar);
  const a = data.aSolicitar;
  const datas = a?.datas.map((d) => d.slice(8, 10) + "/" + d.slice(5, 7)).join(" e ");

  return (
    <>
      <section className="stats" aria-label="Indicadores do dia">
        {pedeAutorizacao && a && (
          <Indicador
            rotulo="A solicitar hoje"
            valor={a.prontas + a.comPendencia}
            sub={`${a.prontas} prontas · ${a.comPendencia} com pendência (sessões de ${datas})`}
            href="/autorizacoes#a-solicitar"
          />
        )}
        {pedeAutorizacao && (
          <Indicador
            rotulo="Aguardando a operadora"
            valor={data.aEnviar + data.emAnalise}
            sub={`${data.aEnviar} a enviar · ${data.emAnalise} em análise`}
            href="/autorizacoes?status=em_analise"
          />
        )}
        {pedeAutorizacao && (
          <Indicador rotulo="Negadas na semana" valor={data.negadas} sub="tratar a negativa" href="/autorizacoes?status=negada" />
        )}
        <Indicador
          rotulo="Atendimentos hoje"
          valor={data.atendimentosHoje.confirmados}
          sub={`confirmados · ${data.atendimentosHoje.aguardando} aguardando confirmação`}
          href="/atendimentos?situacao=aguardando_confirmacao"
        />
      </section>

      <section className="grid2">
        {pedeAutorizacao ? (
          <div className="sb-card">
            <div className="sb-card__header">
              <h2 className="sb-card__title">Negadas para tratar</h2>
              <Link href="/autorizacoes?status=negada">Ver todas</Link>
            </div>
            <div className="tabela-rolagem">
              <table className="sb-table">
                <thead>
                  <tr>
                    <th scope="col">Paciente</th>
                    <th scope="col">Procedimento</th>
                    <th scope="col">Motivo</th>
                    <th scope="col" className="sb-end">
                      Resposta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.ultimasNegadas.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="vazio">
                        Nenhuma negativa nos últimos 7 dias.
                      </td>
                    </tr>
                  ) : (
                    data.ultimasNegadas.map((n) => (
                      <tr key={n.id}>
                        <td className="sb-strong">
                          <Link href={`/autorizacoes/${n.id}`}>{n.paciente.nome}</Link>
                          <span className="texto-suave">{n.convenio.nome}</span>
                        </td>
                        <td>{n.procedimento}</td>
                        <td>{n.motivoNegativa || "—"}</td>
                        <td className="sb-mono sb-end">{formatarData(n.dataResposta)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="sb-card">
            <div className="sb-card__header">
              <h2 className="sb-card__title">Atendimentos</h2>
            </div>
            <div className="sb-card__body">
              <p className="texto-apoio">Os atendimentos de hoje são confirmados pela recepção, no dia da sessão.</p>
            </div>
          </div>
        )}

        <div className="pilha">
          {acoes.length > 0 && (
            <div className="sb-card">
              <div className="sb-card__header">
                <h2 className="sb-card__title">Ações rápidas</h2>
              </div>
              <div className="sb-card__body acoes-rapidas">
                {acoes.map((x) => (
                  <Link key={x.href} href={x.href} className="sb-btn">
                    {x.rotulo}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <div className="sb-card">
            <div className="sb-card__header">
              <h2 className="sb-card__title">Este mês</h2>
              <Link href="/atendimentos?statusCobranca=glosado">Ver glosas</Link>
            </div>
            <div className="sb-card__body">
              <dl className="dl-grade">
                <div>
                  <dt>Atendimentos confirmados</dt>
                  <dd className="mono">{data.atendimentosMes}</dd>
                </div>
                <div>
                  <dt>Sem autorização</dt>
                  <dd className="mono">{data.semAutorizacaoMes}</dd>
                </div>
                <div>
                  <dt>Glosados</dt>
                  <dd className="mono">{data.glosasMes}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="sb-card" aria-labelledby="titulo-volume">
        <div className="sb-card__header">
          <h2 className="sb-card__title" id="titulo-volume">
            Atendimentos por mês
          </h2>
          <span className="caption" style={{ color: "var(--ink-muted)" }}>
            Últimos 6 meses{pico && pico.total > 0 ? ` · pico em ${formatarMes(pico.mes)}` : ""}
          </span>
        </div>
        <div className="sb-card__body">
          {evolucao.carregando ? (
            <Carregando />
          ) : evolucao.erro ? (
            <MensagemErro mensagem={evolucao.erro} onRetry={evolucao.recarregar} />
          ) : (
            <GraficoBarras pontos={pontos} titulo="Atendimentos por mês" unidade="atendimentos" />
          )}
        </div>
      </section>
    </>
  );
}
