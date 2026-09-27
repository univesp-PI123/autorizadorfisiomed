// Gráficos em CSS no estilo Sóbrio (exemplo "Volume por hora" do mockup):
// barras neutras, só o pico em destaque, eixo em fonte mono. Cada gráfico
// traz uma tabela equivalente, visível apenas para leitores de tela.

type Ponto = { rotulo: string; valor: number; detalhe?: string };

/** Barras verticais de uma série (magnitude ao longo do tempo). */
export function GraficoBarras({ pontos, titulo, unidade }: { pontos: Ponto[]; titulo: string; unidade: string }) {
  const maximo = Math.max(1, ...pontos.map((p) => p.valor));
  const pico = pontos.reduce((iPico, p, i) => (p.valor > (pontos[iPico]?.valor ?? -1) ? i : iPico), 0);

  if (pontos.length === 0) return <p className="texto-suave">Sem dados no período.</p>;

  return (
    <div className="grafico">
      <div className="grafico__area" aria-hidden="true">
        {pontos.map((p, i) => {
          const altura = (p.valor / maximo) * 100;
          return (
            <div className="grafico__coluna" key={p.rotulo} tabIndex={-1}>
              {i === pico && p.valor > 0 && (
                <span className="grafico__rotulo-pico" style={{ bottom: `calc(${altura}% + 6px)` }}>
                  {p.valor}
                </span>
              )}
              <div
                className={`grafico__barra ${i === pico && p.valor > 0 ? "grafico__barra--pico" : ""}`}
                style={{ height: `${altura}%` }}
              />
              <span className="grafico__dica">
                {p.rotulo}: <b>{p.valor}</b> {unidade}
                {p.detalhe && (
                  <>
                    <br />
                    {p.detalhe}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="grafico__eixo" aria-hidden="true">
        {pontos.map((p) => (
          <span key={p.rotulo}>{p.rotulo}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Período</th>
            <th scope="col">{unidade}</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((p) => (
            <tr key={p.rotulo}>
              <th scope="row">{p.rotulo}</th>
              <td>
                {p.valor}
                {p.detalhe ? ` (${p.detalhe})` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type Serie = { nome: string; cor: string };
type LinhaEmpilhada = { rotulo: string; valores: number[] };

/**
 * Barras horizontais empilhadas (composição por categoria). As cores vêm de
 * --serie-1..3, validadas para daltonismo; a legenda sempre aparece e cada
 * segmento mostra o valor ao passar o mouse.
 */
export function GraficoEmpilhado({ series, linhas, titulo }: { series: Serie[]; linhas: LinhaEmpilhada[]; titulo: string }) {
  const maximo = Math.max(1, ...linhas.map((l) => l.valores.reduce((a, b) => a + b, 0)));

  if (linhas.length === 0) return <p className="texto-suave">Sem dados.</p>;

  return (
    <div className="grafico">
      <div className="legenda" aria-hidden="true">
        {series.map((s) => (
          <span key={s.nome}>
            <i style={{ background: s.cor }} />
            {s.nome}
          </span>
        ))}
      </div>
      <div className="empilhado" aria-hidden="true">
        {linhas.map((l) => {
          const total = l.valores.reduce((a, b) => a + b, 0);
          return (
            <div className="empilhado__linha" key={l.rotulo}>
              <span className="empilhado__nome" title={l.rotulo}>
                {l.rotulo}
              </span>
              <div className="empilhado__barra" style={{ width: `${(total / maximo) * 100}%` }}>
                {l.valores.map((v, i) =>
                  v > 0 ? (
                    <div
                      key={series[i].nome}
                      className="empilhado__segmento"
                      style={{ flex: v, background: series[i].cor }}
                    >
                      <span className="grafico__dica">
                        {series[i].nome}: <b>{v}</b>
                      </span>
                    </div>
                  ) : null,
                )}
              </div>
              <span className="empilhado__total">{total}</span>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>{titulo}</caption>
        <thead>
          <tr>
            <th scope="col">Convênio</th>
            {series.map((s) => (
              <th scope="col" key={s.nome}>
                {s.nome}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.rotulo}>
              <th scope="row">{l.rotulo}</th>
              {l.valores.map((v, i) => (
                <td key={series[i].nome}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
