// Chamadas ao webservice da Amil: verificação de elegibilidade de uma
// carteirinha, envio de uma guia gerada (guias.ts), consulta do status e
// cancelamento da guia, com a resposta gravada na própria guia.

import { ErroHttp, naoEncontrado } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { deDate, hojeISO } from "@/lib/datas";
import { proximaConsultaStatus } from "@/lib/regras/rotina";
import { montarCancelaGuia, montarSolicitacaoStatus } from "@/lib/tiss/acompanhamento";
import { STATUS_EM_ANDAMENTO, STATUS_SOLICITACAO } from "@/lib/tiss/dominios";
import { montarPedidoElegibilidade } from "@/lib/tiss/elegibilidade";
import {
  lerRespostaCancelamento,
  lerRespostaElegibilidade,
  lerRespostaSolicitacao,
  type RespostaElegibilidade,
  type RespostaSolicitacao,
} from "@/lib/tiss/resposta";
import { validarMensagemTiss } from "@/lib/tiss/validarXsd";
import { configAmil, enviarSoap } from "@/lib/tiss/webservice";

function exigirConfig() {
  const cfg = configAmil();
  if (!cfg.ok) throw new ErroHttp(503, `Envio à Amil não configurado no servidor (falta ${cfg.faltando.join(", ")} no .env).`);
  return cfg.config;
}

/**
 * Pergunta à Amil se a carteirinha do vínculo paciente ↔ convênio está
 * elegível. Não grava nada: é uma consulta.
 */
export async function verificarElegibilidade(vinculoId: string): Promise<RespostaElegibilidade> {
  const v = await prisma.pacienteConvenio.findUnique({
    where: { id: vinculoId },
    select: {
      numeroCarteirinha: true,
      dataValidade: true,
      convenio: { select: { integracao: true, codigoAns: true, codigoPrestador: true } },
    },
  });
  if (!v) naoEncontrado("Vínculo");
  if (v.convenio.integracao !== "tiss_amil") throw new ErroHttp(422, "Só a Amil tem a verificação de elegibilidade pelo webservice.");

  const pedido = montarPedidoElegibilidade({
    // Consulta avulsa, sem numeração própria: os 12 últimos dígitos do instante.
    sequencialTransacao: String(Date.now()).slice(-12),
    agora: new Date(),
    registroAns: v.convenio.codigoAns,
    codigoPrestador: v.convenio.codigoPrestador,
    carteirinha: v.numeroCarteirinha,
    validadeCarteira: v.dataValidade && deDate(v.dataValidade),
  });
  if (!pedido.ok) throw new ErroHttp(422, pedido.erros.join("; "));
  const errosXsd = await validarMensagemTiss(pedido.xmlUtf8);
  if (errosXsd.length) throw new ErroHttp(422, `Pedido fora do padrão TISS: ${errosXsd.join("; ")}`);

  const envio = await enviarSoap(pedido.xml, exigirConfig());
  const resposta: RespostaElegibilidade = envio.ok ? lerRespostaElegibilidade(envio.resposta) : { tipo: "falha", mensagem: envio.erro };

  // Guarda o resultado no vínculo: a análise da agenda usa a última verificação.
  // Falha de comunicação não diz nada sobre a carteirinha e não é gravada.
  if (resposta.tipo !== "falha") {
    const motivo = resposta.glosas.join("; ") || null;
    await prisma.pacienteConvenio.update({
      where: { id: vinculoId },
      data: { elegivel: resposta.tipo === "recibo" && resposta.elegivel, elegibilidadeEm: new Date(), elegibilidadeMotivo: motivo?.slice(0, 500) ?? null },
    });
  }
  return resposta;
}

export type GuiaEnviada = {
  id: string;
  statusOperadora: string | null;
  situacao: string; // para mostrar: "Autorizada", "Recusada pela operadora"…
  numeroGuiaOperadora: string | null;
  senhaOperadora: string | null;
  validadeSenha: string | null;
  glosas: string[];
  erroEnvio: string | null;
};

export async function enviarGuia(id: string): Promise<GuiaEnviada> {
  const guia = await prisma.guiaTiss.findUnique({
    where: { id },
    select: { id: true, xml: true, createdAt: true, convenio: { select: { integracao: true } } },
  });
  if (!guia) naoEncontrado("Guia");
  if (guia.convenio.integracao !== "tiss_amil") throw new ErroHttp(422, "Só as guias da Amil são enviadas pelo webservice.");

  // Se a guia leva o token do paciente, ele vale só no dia em que foi gerado.
  if (/codValidacao>/.test(guia.xml) && hojeISO(guia.createdAt) !== hojeISO()) {
    throw new ErroHttp(409, "O token desta guia já venceu (vale só no dia). Pegue um novo token com o paciente e gere a guia de novo.");
  }
  const config = exigirConfig();

  // Cada guia vai uma vez só: o número da guia no prestador não se repete na
  // operadora. A marcação é atômica, para dois cliques não enviarem duas vezes.
  const reservada = await prisma.guiaTiss.updateMany({ where: { id, enviadaEm: null }, data: { enviadaEm: new Date() } });
  if (!reservada.count) throw new ErroHttp(409, "Esta guia já foi enviada à operadora.");

  const envio = await enviarSoap(guia.xml, config);
  if (!envio.ok && !envio.chegou) {
    // Não chegou à operadora: a guia volta a poder ser enviada.
    await prisma.guiaTiss.update({ where: { id }, data: { enviadaEm: null, erroEnvio: envio.erro, respostaXml: envio.resposta ?? null } });
    return {
      id,
      statusOperadora: null,
      situacao: "Não chegou à operadora",
      numeroGuiaOperadora: null,
      senhaOperadora: null,
      validadeSenha: null,
      glosas: [],
      erroEnvio: envio.erro,
    };
  }
  const lida = envio.ok ? lerRespostaSolicitacao(envio.resposta) : null;
  const dados = {
    enviadaEm: new Date(),
    ...agendaDeConsulta(lida, 0),
    conferir: !envio.ok
      ? "a operadora não respondeu ao envio"
      : lida?.tipo === "autorizacao"
        ? lida.conferir
        : lida?.tipo === "falha" && !/Fault/.test(envio.resposta)
          ? "a resposta da operadora veio fora do padrão TISS"
          : null,
    respostaXml: envio.resposta ?? null,
    statusOperadora: lida?.tipo === "autorizacao" ? lida.status : null,
    numeroGuiaOperadora: lida?.tipo === "autorizacao" ? lida.numeroGuiaOperadora?.slice(0, 20) ?? null : null,
    senhaOperadora: lida?.tipo === "autorizacao" ? lida.senha?.slice(0, 20) ?? null : null,
    validadeSenha:
      lida?.tipo === "autorizacao" && lida.validadeSenha && /^\d{4}-\d{2}-\d{2}$/.test(lida.validadeSenha)
        ? new Date(`${lida.validadeSenha}T00:00:00Z`)
        : null,
    glosas: lida && lida.tipo !== "falha" ? lida.glosas : [],
    erroEnvio: !envio.ok ? envio.erro : lida?.tipo === "falha" ? lida.mensagem.slice(0, 1000) : null,
  };
  await prisma.guiaTiss.update({ where: { id }, data: dados });

  return {
    id,
    statusOperadora: dados.statusOperadora,
    situacao: situacaoDaGuia(dados),
    numeroGuiaOperadora: dados.numeroGuiaOperadora,
    senhaOperadora: dados.senhaOperadora,
    validadeSenha: lida?.tipo === "autorizacao" ? lida.validadeSenha : null,
    glosas: dados.glosas,
    erroEnvio: dados.erroEnvio,
  };
}

/** Próxima consulta do status: só enquanto a guia segue em andamento sem decisão. */
function agendaDeConsulta(lida: RespostaSolicitacao | null, consultasFeitas: number) {
  const emAnalise = lida?.tipo === "autorizacao" && STATUS_EM_ANDAMENTO.has(lida.status) && !["1", "7"].includes(lida.status);
  return { consultasStatus: consultasFeitas, proximaConsultaEm: emAnalise ? proximaConsultaStatus(consultasFeitas, new Date()) : null };
}

/** Dados da guia já enviada para montar as mensagens de acompanhamento. */
async function guiaEnviada(id: string) {
  const guia = await prisma.guiaTiss.findUnique({
    where: { id },
    select: {
      id: true, numero: true, xml: true, enviadaEm: true, statusOperadora: true, numeroGuiaOperadora: true,
      consultasStatus: true, canceladaEm: true,
      convenio: { select: { integracao: true, codigoAns: true, codigoPrestador: true } },
    },
  });
  if (!guia) naoEncontrado("Guia");
  if (guia.convenio.integracao !== "tiss_amil") throw new ErroHttp(422, "Só as guias da Amil são acompanhadas pelo webservice.");
  if (!guia.enviadaEm) throw new ErroHttp(409, "Esta guia ainda não foi enviada à operadora.");
  const dados = {
    sequencialTransacao: String(Date.now()).slice(-12),
    agora: new Date(),
    registroAns: guia.convenio.codigoAns,
    codigoPrestador: guia.convenio.codigoPrestador,
    numeroGuiaPrestador: String(guia.numero),
    numeroGuiaOperadora: guia.numeroGuiaOperadora,
    // A carteirinha é a que foi na solicitação.
    carteirinha: guia.xml.match(/<(?:\w+:)?numeroCarteira>([^<]+)</)?.[1] ?? null,
  };
  return { guia, dados };
}

/**
 * Pergunta à operadora o status da guia (solicitacaoStatusAutorizacao) e
 * grava a resposta, como no envio. Enquanto a guia segue em análise, deixa
 * marcada a próxima consulta da rotina.
 */
export async function consultarStatusGuia(id: string): Promise<GuiaEnviada> {
  const { guia, dados: d } = await guiaEnviada(id);
  if (guia.canceladaEm) throw new ErroHttp(409, "Esta guia foi cancelada na operadora.");
  const pedido = montarSolicitacaoStatus(d);
  if (!pedido.ok) throw new ErroHttp(422, pedido.erros.join("; "));
  const errosXsd = await validarMensagemTiss(pedido.xmlUtf8);
  if (errosXsd.length) throw new ErroHttp(422, `Pedido fora do padrão TISS: ${errosXsd.join("; ")}`);

  const envio = await enviarSoap(pedido.xml, exigirConfig());
  const consultas = guia.consultasStatus + 1;
  const lida = envio.ok ? lerRespostaSolicitacao(envio.resposta) : null;
  if (lida?.tipo !== "autorizacao") {
    // Sem status novo: mantém o que a guia tinha e tenta de novo mais tarde.
    const erro = !envio.ok ? envio.erro : lida?.tipo === "erro" ? lida.glosas.join("; ") : lida?.mensagem ?? null;
    await prisma.guiaTiss.update({
      where: { id },
      data: { consultasStatus: consultas, proximaConsultaEm: proximaConsultaStatus(consultas, new Date()), erroEnvio: erro?.slice(0, 1000) ?? null },
    });
    return { ...(await resumoDaGuia(id)), erroEnvio: erro };
  }
  await prisma.guiaTiss.update({
    where: { id },
    data: {
      ...agendaDeConsulta(lida, consultas),
      statusOperadora: lida.status,
      numeroGuiaOperadora: lida.numeroGuiaOperadora?.slice(0, 20) ?? guia.numeroGuiaOperadora,
      senhaOperadora: lida.senha?.slice(0, 20) ?? null,
      validadeSenha: lida.validadeSenha && /^\d{4}-\d{2}-\d{2}$/.test(lida.validadeSenha) ? new Date(`${lida.validadeSenha}T00:00:00Z`) : null,
      glosas: lida.glosas,
      conferir: lida.conferir,
      erroEnvio: null,
      respostaXml: envio.ok ? envio.resposta : null,
    },
  });
  return resumoDaGuia(id);
}

/**
 * Pede à operadora o cancelamento da guia (cancelaGuia). O motivo fica só no
 * sistema: a mensagem TISS não tem esse campo. Cancelada (ou inexistente na
 * operadora), a guia deixa de cobrir a sessão e a vaga fica livre.
 */
export async function cancelarGuia(id: string, motivo: string): Promise<GuiaEnviada> {
  const { guia, dados: d } = await guiaEnviada(id);
  if (guia.canceladaEm) throw new ErroHttp(409, "Esta guia já foi cancelada.");
  const pedido = montarCancelaGuia(d);
  if (!pedido.ok) throw new ErroHttp(422, pedido.erros.join("; "));
  const errosXsd = await validarMensagemTiss(pedido.xmlUtf8);
  if (errosXsd.length) throw new ErroHttp(422, `Pedido fora do padrão TISS: ${errosXsd.join("; ")}`);

  const envio = await enviarSoap(pedido.xml, exigirConfig());
  const lida = envio.ok ? lerRespostaCancelamento(envio.resposta) : null;
  if (lida?.tipo === "recibo" && lida.cancelada) {
    await prisma.guiaTiss.update({
      where: { id },
      data: {
        canceladaEm: new Date(), motivoCancelamento: motivo.slice(0, 500), erroCancelamento: null,
        statusOperadora: "6", proximaConsultaEm: null,
      },
    });
  } else {
    const erro = !envio.ok
      ? envio.erro
      : lida?.tipo === "recibo"
        ? lida.descricao
        : lida?.tipo === "erro"
          ? lida.glosas.join("; ")
          : lida?.mensagem ?? "Resposta sem recibo de cancelamento.";
    await prisma.guiaTiss.update({ where: { id }, data: { motivoCancelamento: motivo.slice(0, 500), erroCancelamento: erro.slice(0, 1000) } });
  }
  return resumoDaGuia(id);
}

async function resumoDaGuia(id: string): Promise<GuiaEnviada> {
  const g = await prisma.guiaTiss.findUniqueOrThrow({ where: { id } });
  return {
    id,
    statusOperadora: g.statusOperadora,
    situacao: situacaoDaGuia(g),
    numeroGuiaOperadora: g.numeroGuiaOperadora,
    senhaOperadora: g.senhaOperadora,
    validadeSenha: g.validadeSenha && deDate(g.validadeSenha),
    glosas: g.glosas,
    erroEnvio: g.erroCancelamento ?? g.erroEnvio,
  };
}

/** Situação da guia em relação à operadora, em uma palavra para a tela. */
export function situacaoDaGuia(g: {
  enviadaEm: Date | null;
  statusOperadora: string | null;
  erroEnvio: string | null;
  glosas: string[];
  conferir: string | null;
  canceladaEm?: Date | null;
}) {
  if (g.canceladaEm) return "Cancelada na operadora";
  if (!g.enviadaEm) return g.erroEnvio ? "Não chegou à operadora" : "Não enviada";
  if (g.conferir) return "Conferir no portal";
  if (g.statusOperadora) return STATUS_SOLICITACAO[g.statusOperadora] ?? `Status ${g.statusOperadora}`;
  if (g.erroEnvio) return "Falha no envio";
  return g.glosas.length ? "Recusada pela operadora" : "Sem resposta";
}
