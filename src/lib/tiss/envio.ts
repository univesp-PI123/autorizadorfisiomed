// Chamadas ao webservice da Amil: verificação de elegibilidade de uma
// carteirinha e envio de uma guia gerada (guias.ts), com a resposta gravada
// na própria guia.

import { ErroHttp, naoEncontrado } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { deDate, hojeISO } from "@/lib/datas";
import { STATUS_SOLICITACAO } from "@/lib/tiss/dominios";
import { montarPedidoElegibilidade } from "@/lib/tiss/elegibilidade";
import { lerRespostaElegibilidade, lerRespostaSolicitacao, type RespostaElegibilidade } from "@/lib/tiss/resposta";
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
  return envio.ok ? lerRespostaElegibilidade(envio.resposta) : { tipo: "falha", mensagem: envio.erro };
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
    select: { id: true, xml: true, statusOperadora: true, createdAt: true, convenio: { select: { integracao: true } } },
  });
  if (!guia) naoEncontrado("Guia");
  if (guia.convenio.integracao !== "tiss_amil") throw new ErroHttp(422, "Só as guias da Amil são enviadas pelo webservice.");
  // Guia que a operadora já respondeu não vai de novo: o número da guia no
  // prestador seria repetido. Negada ou cancelada, gera-se uma guia nova.
  if (guia.statusOperadora) {
    throw new ErroHttp(409, `A operadora já respondeu esta guia (${STATUS_SOLICITACAO[guia.statusOperadora] ?? guia.statusOperadora}).`);
  }

  // A guia leva o token do paciente, que vale só no dia em que foi gerado.
  if (hojeISO(guia.createdAt) !== hojeISO()) {
    throw new ErroHttp(409, "O token desta guia já venceu (vale só no dia). Pegue um novo token com o paciente e gere a guia de novo.");
  }

  const envio = await enviarSoap(guia.xml, exigirConfig());
  const lida = envio.ok ? lerRespostaSolicitacao(envio.resposta) : null;
  const dados = {
    enviadaEm: new Date(),
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

/** Situação da guia em relação à operadora, em uma palavra para a tela. */
export function situacaoDaGuia(g: { enviadaEm: Date | null; statusOperadora: string | null; erroEnvio: string | null; glosas: string[] }) {
  if (!g.enviadaEm) return "Não enviada";
  if (g.statusOperadora) return STATUS_SOLICITACAO[g.statusOperadora] ?? `Status ${g.statusOperadora}`;
  if (g.erroEnvio) return "Falha no envio";
  return g.glosas.length ? "Recusada pela operadora" : "Sem resposta";
}
