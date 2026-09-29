import { Prisma } from "@prisma/client";
import { json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { deDate, hojeISO } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { marcarVencidas, statusAutomatico } from "@/lib/regras/autorizacao";
import { esquemaAutorizacaoEdicao, lerCorpo } from "@/lib/validacao";

type Params = { id: string };

export const GET = rota<Params>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  await marcarVencidas();
  const autorizacao = await prisma.autorizacao.findUnique({
    where: { id },
    include: {
      paciente: true,
      convenio: true,
      vinculo: true,
      usuarioCriou: { select: { id: true, nome: true } },
      historico: {
        include: { usuario: { select: { id: true, nome: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!autorizacao) naoEncontrado("Autorização");
  // Plano terapêutico do paciente (pedido médico ativo mais recente com plano).
  const plano = await prisma.pedidoMedico.findFirst({
    where: { pacienteId: autorizacao.pacienteId, ativo: true, planoItens: { not: Prisma.AnyNull } },
    orderBy: { dataPedido: "desc" },
    select: {
      id: true, medicoNome: true, conselho: true, numeroConselho: true, ufConselho: true, cid: true, dataPedido: true,
      validoAte: true, sessoesSemanais: true, planoItens: true,
      documentos: { select: { id: true, tipo: true, nomeOriginal: true, tamanho: true, origem: true, createdAt: true } },
    },
  });
  return json({ ...autorizacao, plano });
});

// Edita os dados descritivos. Status tem rota própria (/status).
export const PUT = rota<Params>(async (req, { params }) => {
  const usuario = await exigirSessao(req, ["admin", "recepcionista", "financeiro"]);
  const { id } = await params;
  const dados = await lerCorpo(req, esquemaAutorizacaoEdicao);

  const atual = await prisma.autorizacao.findUnique({ where: { id } });
  if (!atual) naoEncontrado("Autorização");

  const fim = dados.dataFimVigencia !== undefined ? dados.dataFimVigencia : atual.dataFimVigencia;
  const novoStatus = statusAutomatico({
    status: atual.status,
    dataFimVigencia: fim ? deDate(fim) : null,
    quantidadeAutorizada: atual.quantidadeAutorizada,
    quantidadeUtilizada: atual.quantidadeUtilizada,
    hoje: hojeISO(),
  });

  const autorizacao = await prisma.autorizacao.update({
    where: { id },
    data: {
      ...dados,
      status: novoStatus,
      ...(novoStatus !== atual.status && {
        historico: {
          create: {
            statusAnterior: atual.status,
            statusNovo: novoStatus,
            usuarioId: usuario.id,
            observacao: "Status ajustado após edição da vigência.",
          },
        },
      }),
    },
  });
  return json(autorizacao);
});
