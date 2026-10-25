// Solicitação de autorização de SP/SADT (mensagem solicitacaoProcedimentoWS
// do padrão TISS 4.03.00), a mesma que o webservice da operadora recebe.
//
// Função pura: recebe os dados já carregados do banco e devolve o XML ou a
// lista do que falta. Quem busca os dados é lib/tiss/guias.ts.

import { dataHoraNoFuso } from "@/lib/datas";
import { CONSELHOS, codigoUf, siglaConselho } from "@/lib/tiss/dominios";
import { digitos, el, mensagemTiss, textoTiss, type No } from "@/lib/tiss/xml";

export const VERSAO_TISS = "4.03.00";

// Tabela 23 — caráter do atendimento: 1 = eletivo.
const CARATER_ELETIVO = "1";
// Tabela 73 — etapa: 2 = solicitação feita pelo prestador executante (a
// clínica pede a autorização com base no pedido do médico).
const ETAPA_PRESTADOR_EXECUTANTE = "2";

export type DadosSolicitacaoSpSadt = {
  numeroGuiaPrestador: string;
  sequencialTransacao: string;
  agora: Date;
  registroAns: string | null; // da operadora
  prestador: { codigoNaOperadora: string | null; nome: string | null }; // a clínica
  carteirinha: string | null;
  codValidacao?: string | null; // token do beneficiário
  solicitante: {
    nome: string;
    conselho: string; // sigla: CRM, CRP…
    numeroConselho: string;
    uf: string; // sigla
    cbo: string | null;
  };
  dataSolicitacao: string; // YYYY-MM-DD
  indicacaoClinica: string | null;
  procedimentos: { tabela: string; codigo: string | null; descricao: string; quantidade: number }[];
  cnes: string | null; // da unidade que executa
  observacao?: string | null;
};

export type ResultadoSolicitacao =
  | { ok: true; xml: string; xmlUtf8: string; hash: string }
  | { ok: false; erros: string[] };

/** O que impede de montar a guia, em frases para o usuário. */
export function errosSolicitacao(d: DadosSolicitacaoSpSadt): string[] {
  const erros: string[] = [];
  if (!/^\d{6}$/.test(d.registroAns ?? "")) erros.push("Convênio sem registro ANS (6 dígitos)");
  if (!d.prestador.codigoNaOperadora) erros.push("Convênio sem código do prestador");
  if (!d.prestador.nome) erros.push("Dados da clínica não cadastrados");
  if (!digitos(d.carteirinha)) erros.push("Sem carteirinha");
  if (d.codValidacao && !/^\S{1,10}$/.test(d.codValidacao)) erros.push("Token do paciente inválido (até 10 caracteres)");
  if (!d.cnes) erros.push("Unidade sem CNES");
  const s = d.solicitante;
  if (!siglaConselho(s.conselho)) erros.push(`Conselho do médico inválido (${s.conselho})`);
  if (!codigoUf(s.uf)) erros.push(`UF do conselho do médico inválida (${s.uf})`);
  if (!digitos(s.numeroConselho)) erros.push("Médico sem número do conselho");
  if (!/^\d{6}$/.test(s.cbo ?? "")) erros.push("Pedido médico sem CBO do médico");
  if (!textoTiss(d.indicacaoClinica, 500)) erros.push("Pedido médico sem indicação clínica nem CID");
  if (!d.procedimentos.length) erros.push("Nenhum procedimento");
  for (const p of d.procedimentos) {
    if (!p.codigo) erros.push(`Procedimento sem código TUSS (${p.descricao})`);
    if (p.quantidade < 1 || p.quantidade > 999) erros.push(`Quantidade inválida (${p.descricao})`);
  }
  return [...new Set(erros)];
}

export function montarSolicitacaoSpSadt(d: DadosSolicitacaoSpSadt): ResultadoSolicitacao {
  const erros = errosSolicitacao(d);
  if (erros.length) return { ok: false, erros };

  const { data, hora } = dataHoraNoFuso(d.agora);
  const s = d.solicitante;
  const codigoPrestador = textoTiss(d.prestador.codigoNaOperadora, 14);

  const cabecalho = el("cabecalho", [
    el("identificacaoTransacao", [
      el("tipoTransacao", "SOLICITACAO_PROCEDIMENTOS"),
      el("sequencialTransacao", d.sequencialTransacao),
      el("dataRegistroTransacao", data),
      el("horaRegistroTransacao", hora),
    ]),
    el("origem", [el("identificacaoPrestador", [el("codigoPrestadorNaOperadora", codigoPrestador)])]),
    el("destino", [el("registroANS", d.registroAns)]),
    el("Padrao", VERSAO_TISS),
  ])!;

  const guia = el("solicitacaoSP-SADT", [
    el("cabecalhoSolicitacao", [el("registroANS", d.registroAns), el("numeroGuiaPrestador", d.numeroGuiaPrestador)]),
    el("codValidacao", d.codValidacao ?? null),
    el("tipoEtapaAutorizacao", ETAPA_PRESTADOR_EXECUTANTE),
    el("dadosBeneficiario", [el("numeroCarteira", digitos(d.carteirinha)!.slice(0, 20)), el("atendimentoRN", "N")]),
    el("dadosSolicitante", [
      el("contratadoSolicitante", [el("codigoPrestadorNaOperadora", codigoPrestador)]),
      el("nomeContratadoSolicitante", textoTiss(d.prestador.nome, 70)),
      el("profissionalSolicitante", [
        el("nomeProfissional", textoTiss(s.nome, 70)),
        el("conselhoProfissional", CONSELHOS[siglaConselho(s.conselho)!]),
        el("numeroConselhoProfissional", digitos(s.numeroConselho)!.slice(0, 15)),
        el("UF", codigoUf(s.uf)),
        el("CBOS", s.cbo),
      ]),
    ]),
    el("caraterAtendimento", CARATER_ELETIVO),
    el("dataSolicitacao", d.dataSolicitacao),
    el("indicacaoClinica", textoTiss(d.indicacaoClinica, 500)),
    ...d.procedimentos.map((p) =>
      el("procedimentosSolicitados", [
        el("procedimento", [
          el("codigoTabela", p.tabela),
          el("codigoProcedimento", p.codigo),
          el("descricaoProcedimento", textoTiss(p.descricao, 150)),
        ]),
        el("quantidadeSolicitada", p.quantidade),
      ]),
    ),
    el("dadosExecutante", [el("codigonaOperadora", codigoPrestador), el("CNES", digitos(d.cnes)!.slice(0, 7))]),
    el("observacao", textoTiss(d.observacao, 500)),
  ]);

  const campos: No[] = [cabecalho, el("solicitacaoProcedimento", [guia])!];
  const { xml, hash } = mensagemTiss("solicitacaoProcedimentoWS", campos);
  return { ok: true, xml, xmlUtf8: mensagemTiss("solicitacaoProcedimentoWS", campos, "UTF-8").xml, hash };
}
