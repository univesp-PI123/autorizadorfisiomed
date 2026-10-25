// Envio de uma guia gerada (guias.ts) ao webservice da operadora e gravação
// da resposta na própria guia.

import { ErroHttp, naoEncontrado } from "@/lib/api/http";
import { prisma } from "@/lib/prisma";
import { STATUS_SOLICITACAO } from "@/lib/tiss/dominios";
import { lerRespostaSolicitacao } from "@/lib/tiss/resposta";
import { configAmil, enviarSoap } from "@/lib/tiss/webservice";

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
    select: { id: true, xml: true, statusOperadora: true, convenio: { select: { integracao: true } } },
  });
  if (!guia) naoEncontrado("Guia");
  if (guia.convenio.integracao !== "tiss_amil") throw new ErroHttp(422, "Só as guias da Amil são enviadas pelo webservice.");
  // Guia que a operadora já respondeu não vai de novo: o número da guia no
  // prestador seria repetido. Negada ou cancelada, gera-se uma guia nova.
  if (guia.statusOperadora) {
    throw new ErroHttp(409, `A operadora já respondeu esta guia (${STATUS_SOLICITACAO[guia.statusOperadora] ?? guia.statusOperadora}).`);
  }

  const cfg = configAmil();
  if (!cfg.ok) throw new ErroHttp(503, `Envio à Amil não configurado no servidor (falta ${cfg.faltando.join(", ")} no .env).`);

  const envio = await enviarSoap(guia.xml, cfg.config);
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
