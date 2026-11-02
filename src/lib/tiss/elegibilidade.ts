// Verificação de elegibilidade do beneficiário (pedidoElegibilidadeWS do
// padrão TISS 4.03.00): a carteirinha está ativa na operadora?
//
// Função pura que monta o pedido; a resposta (respostaElegibilidadeWS) é lida
// em lib/tiss/resposta.ts e o envio fica em lib/tiss/envio.ts.

import { dataHoraNoFuso } from "@/lib/datas";
import { VERSAO_TISS } from "@/lib/tiss/solicitacao";
import { digitos, el, mensagemTiss, textoTiss, type No } from "@/lib/tiss/xml";

export type DadosElegibilidade = {
  sequencialTransacao: string;
  agora: Date;
  registroAns: string | null;
  codigoPrestador: string | null;
  carteirinha: string | null;
  validadeCarteira?: string | null; // YYYY-MM-DD
};

export function montarPedidoElegibilidade(d: DadosElegibilidade) {
  const erros = [
    !/^\d{6}$/.test(d.registroAns ?? "") && "Convênio sem registro ANS (6 dígitos)",
    !d.codigoPrestador && "Convênio sem código do prestador",
    !digitos(d.carteirinha) && "Sem carteirinha",
  ].filter((e): e is string => !!e);
  if (erros.length) return { ok: false as const, erros };

  const { data, hora } = dataHoraNoFuso(d.agora);
  const codigoPrestador = textoTiss(d.codigoPrestador, 14);
  const campos: No[] = [
    el("cabecalho", [
      el("identificacaoTransacao", [
        el("tipoTransacao", "VERIFICA_ELEGIBILIDADE"),
        el("sequencialTransacao", d.sequencialTransacao),
        el("dataRegistroTransacao", data),
        el("horaRegistroTransacao", hora),
      ]),
      el("origem", [el("identificacaoPrestador", [el("codigoPrestadorNaOperadora", codigoPrestador)])]),
      el("destino", [el("registroANS", d.registroAns)]),
      el("Padrao", VERSAO_TISS),
    ])!,
    el("pedidoElegibilidade", [
      el("dadosPrestador", [el("codigoPrestadorNaOperadora", codigoPrestador)]),
      el("numeroCarteira", digitos(d.carteirinha)!.slice(0, 20)),
      el("validadeCarteira", d.validadeCarteira ?? null),
    ])!,
  ];
  const { xml, hash } = mensagemTiss("pedidoElegibilidadeWS", campos);
  return { ok: true as const, xml, xmlUtf8: mensagemTiss("pedidoElegibilidadeWS", campos, "UTF-8").xml, hash };
}
