import Link from "next/link";
import { TabelaResultados } from "@/components/EnvioDocumentos";
import { Badge } from "@/components/ui/StatusBadge";
import { formatarData } from "@/lib/analiseDados";
import type { AvisoImportacao, Importacao } from "@/lib/cliente/tipos";

function Avisos({ avisos }: { avisos: AvisoImportacao[] }) {
  if (!avisos.length) return <p className="texto-suave">Nenhum aviso.</p>;
  return (
    <ul className="lista-simples">
      {avisos.map((a) => (
        <li key={a.mensagem}>
          <p>
            <span className="mono">{a.quantidade}</span> × {a.mensagem}
          </p>
          <p className="texto-suave">
            Linha{a.linhas.length > 1 ? "s" : ""} da planilha: <span className="mono">{a.linhas.join(", ")}</span>
            {a.quantidade > a.linhas.length && " …"}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Relatório de uma importação: o que entrou, o que mudou e o que precisa de atenção. */
export default function ResumoImportacao({ importacao: imp }: { importacao: Importacao }) {
  const r = imp.resumo;
  const numeros: [string, number | string][] =
    imp.tipo === "agenda"
      ? [
          ["Sessões novas", imp.criados],
          ["Sessões atualizadas", imp.atualizados],
          ["Excluídas no AnClinic", r.removidas ?? 0],
          ["Linhas ignoradas", imp.ignorados],
          ["Pacientes novos", r.novos?.pacientes ?? 0],
          ["Profissionais novos", r.novos?.profissionais ?? 0],
          ["Procedimentos novos", r.novos?.procedimentos ?? 0],
          ["Unidades novas", r.novos?.unidades ?? 0],
        ]
      : imp.tipo === "documentos"
        ? [
            ["Vinculados", r.vinculados ?? 0],
            ["Sem paciente", r.semPaciente ?? 0],
            ["Já enviados", r.duplicados ?? 0],
            ["Com erro", r.erros ?? 0],
            ["Pedidos criados pelo plano", r.pedidosCriados ?? 0],
          ]
        : imp.tipo === "tabela_operadora" || imp.tipo === "tuss"
          ? [
              ["Códigos novos", imp.criados],
              ["Códigos atualizados", imp.atualizados],
              ["Linhas ignoradas", imp.ignorados],
              ...(imp.tipo === "tabela_operadora" ? ([["Equivalências com o AnClinic", r.equivalencias ?? 0]] as [string, number][]) : []),
            ]
          : [
              ["Profissionais novos", imp.criados],
              ["Profissionais atualizados", imp.atualizados],
              ["Linhas ignoradas", imp.ignorados],
              ["Sem dados de conselho", r.semConselho ?? 0],
              ...(r.convenio
                ? ([
                    [`Credenciados na ${r.convenio.nome}`, r.credenciados ?? 0],
                    ["Deixaram de constar", r.descredenciados ?? 0],
                  ] as [string, number][])
                : []),
            ];
  const naoVinculados = (r.porConvenio ?? []).filter((c) => !c.convenioId);

  return (
    <div className="pilha">
      {imp.tipo === "agenda" && r.periodo && (
        <p>
          Agenda de <span className="mono">{formatarData(r.periodo.inicio)}</span>
          {r.periodo.fim !== r.periodo.inicio && (
            <>
              {" "}a <span className="mono">{formatarData(r.periodo.fim)}</span>
            </>
          )}
          {" "}· <span className="mono">{r.sessoes}</span> sessões.{" "}
          <Link href={`/agenda?data=${r.periodo.inicio}`} className="link-texto">
            Ver situação das sessões
          </Link>
        </p>
      )}
      <dl className="dl-grade dl-grade--4">
        {numeros.map(([rotulo, valor]) => (
          <div key={rotulo}>
            <dt>{rotulo}</dt>
            <dd className="mono">{valor}</dd>
          </div>
        ))}
      </dl>

      {imp.tipo === "agenda" && (r.porConvenio ?? []).length > 0 && (
        <div>
          <h3 className="subtitulo">Sessões por convênio</h3>
          {naoVinculados.length > 0 && (
            <p className="aviso aviso--atencao" style={{ marginBottom: 8 }}>
              {naoVinculados.length} nome(s) de convênio do AnClinic não estão ligados a um convênio do sistema. Informe-os
              em <Link href="/convenios">Convênios</Link> (campo &ldquo;Nomes na agenda do AnClinic&rdquo;) e importe de novo.
            </p>
          )}
          <div className="tabela-rolagem">
            <table className="sb-table">
              <thead>
                <tr>
                  <th scope="col">Convênio no AnClinic</th>
                  <th scope="col">No sistema</th>
                  <th scope="col" className="sb-end">
                    Sessões
                  </th>
                </tr>
              </thead>
              <tbody>
                {r.porConvenio!.map((c) => (
                  <tr key={c.nome}>
                    <td>{c.nome}</td>
                    <td>{c.convenio ?? <Badge tom="warning">Não vinculado</Badge>}</td>
                    <td className="sb-mono sb-end">{c.sessoes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {imp.tipo === "documentos" ? (
        (r.arquivos ?? []).length > 0 && <TabelaResultados resultados={r.arquivos!} />
      ) : (
        <div>
          <h3 className="subtitulo">Avisos</h3>
          <Avisos avisos={r.avisos ?? []} />
        </div>
      )}
    </div>
  );
}
