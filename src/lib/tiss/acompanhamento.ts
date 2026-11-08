// Mensagens de acompanhamento de uma guia já enviada (padrão TISS 4.03.00):
//   solicitacaoStatusAutorizacaoWS — pergunta à operadora o status da guia
//   cancelaGuiaWS                  — pede o cancelamento da guia
//
// Funções puras que montam o XML; o envio fica em lib/tiss/envio.ts e a
// leitura das respostas em lib/tiss/resposta.ts.

import { dataHoraNoFuso } from "@/lib/datas";
import { VERSAO_TISS } from "@/lib/tiss/solicitacao";
import { digitos, el, mensagemTiss, textoTiss, type No } from "@/lib/tiss/xml";

// Tabela dm_tipoGuia: 1 = solicitação.
const TIPO_GUIA_SOLICITACAO = "1";

export type DadosGuiaEnviada = {
  sequencialTransacao: string;
  agora: Date;
  registroAns: string | null; // da operadora
  codigoPrestador: string | null; // da clínica na operadora
  numeroGuiaPrestador: string; // o número que foi na solicitação
  numeroGuiaOperadora?: string | null; // o que a operadora devolveu, se devolveu
  carteirinha: string | null;
};

function errosGuia(d: DadosGuiaEnviada): string[] {
  return [
    !/^\d{6}$/.test(d.registroAns ?? "") && "Convênio sem registro ANS (6 dígitos)",
    !d.codigoPrestador && "Convênio sem código do prestador",
    !d.numeroGuiaPrestador && "Guia sem número",
  ].filter((e): e is string => !!e);
}

function cabecalho(tipoTransacao: string, d: DadosGuiaEnviada): No {
  const { data, hora } = dataHoraNoFuso(d.agora);
  return el("cabecalho", [
    el("identificacaoTransacao", [
      el("tipoTransacao", tipoTransacao),
      el("sequencialTransacao", d.sequencialTransacao),
      el("dataRegistroTransacao", data),
      el("horaRegistroTransacao", hora),
    ]),
    el("origem", [el("identificacaoPrestador", [el("codigoPrestadorNaOperadora", textoTiss(d.codigoPrestador, 14))])]),
    el("destino", [el("registroANS", d.registroAns)]),
    el("Padrao", VERSAO_TISS),
  ])!;
}

/** Pedido do status de uma guia de solicitação já enviada. */
export function montarSolicitacaoStatus(d: DadosGuiaEnviada) {
  const erros = errosGuia(d);
  if (!digitos(d.carteirinha)) erros.push("Sem carteirinha");
  if (erros.length) return { ok: false as const, erros };

  const campos: No[] = [
    cabecalho("SOLICITA_STATUS_AUTORIZACAO", d),
    el("solicitacaoStatusAutorizacao", [
      el("identificacaoSolicitacao", [el("registroANS", d.registroAns), el("numeroGuiaPrestador", d.numeroGuiaPrestador)]),
      el("dadosBeneficiario", [el("numeroCarteira", digitos(d.carteirinha)!.slice(0, 20)), el("atendimentoRN", "N")]),
      el("dadosContratado", [el("codigoPrestadorNaOperadora", textoTiss(d.codigoPrestador, 14))]),
    ])!,
  ];
  const { xml, hash } = mensagemTiss("solicitacaoStatusAutorizacaoWS", campos);
  return { ok: true as const, xml, xmlUtf8: mensagemTiss("solicitacaoStatusAutorizacaoWS", campos, "UTF-8").xml, hash };
}

/** Pedido de cancelamento de uma guia de solicitação. */
export function montarCancelaGuia(d: DadosGuiaEnviada) {
  const erros = errosGuia(d);
  if (erros.length) return { ok: false as const, erros };

  const campos: No[] = [
    cabecalho("CANCELA_GUIA", d),
    el("cancelaGuia", [
      el("dadosPrestador", [el("codigoPrestadorNaOperadora", textoTiss(d.codigoPrestador, 14))]),
      el("tipoCancelamento", [
        el("tipoCancelamentoGuia", [
          el("tipoGuia", TIPO_GUIA_SOLICITACAO),
          el("numeroGuiaPrestador", d.numeroGuiaPrestador),
          el("numeroGuiaOperadora", textoTiss(d.numeroGuiaOperadora, 20)),
        ]),
      ]),
    ])!,
  ];
  const { xml, hash } = mensagemTiss("cancelaGuiaWS", campos);
  return { ok: true as const, xml, xmlUtf8: mensagemTiss("cancelaGuiaWS", campos, "UTF-8").xml, hash };
}
