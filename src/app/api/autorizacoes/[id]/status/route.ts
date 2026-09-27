import type { Prisma } from "@prisma/client";
import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { deDate, hojeISO, paraDate } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { marcarVencidas, podeTransitar, statusAutomatico } from "@/lib/regras/autorizacao";
import { esquemaMudancaStatus, lerCorpo } from "@/lib/validacao";

const ROTULOS: Record<string, string> = {
  pendente: "pendente",
  em_analise: "em análise",
  autorizada: "autorizada",
  negada: "negada",
  vencida: "vencida",
  cancelada: "cancelada",
  esgotada: "esgotada",
};

export const PATCH = rota<{ id: string }>(async (req, { params }) => {
  const usuario = await exigirSessao(req);
  const { id } = await params;
  const dados = await lerCorpo(req, esquemaMudancaStatus);
  await marcarVencidas();

  const atual = await prisma.autorizacao.findUnique({ where: { id } });
  if (!atual) naoEncontrado("Autorização");

  if (!podeTransitar(atual.status, dados.status)) {
    throw new ErroHttp(
      422,
      `Não é possível mudar de "${ROTULOS[atual.status]}" para "${ROTULOS[dados.status]}".`,
    );
  }

  const hoje = hojeISO();
  const alteracoes: Prisma.AutorizacaoUpdateManyMutationInput = { status: dados.status };
  if (dados.numeroAutorizacao) alteracoes.numeroAutorizacao = dados.numeroAutorizacao;
  if (dados.motivoNegativa) alteracoes.motivoNegativa = dados.motivoNegativa;
  if (dados.status === "autorizada" || dados.status === "negada") {
    alteracoes.dataResposta = dados.dataResposta ?? paraDate(hoje);
  }
  if (dados.status === "autorizada") {
    // Se o convênio não informou a quantidade, vale o que foi solicitado.
    alteracoes.quantidadeAutorizada =
      dados.quantidadeAutorizada ?? atual.quantidadeAutorizada ?? atual.quantidadeSolicitada;
  }

  // Ao autorizar, a vigência pode já ter acabado ou as sessões já estarem gastas.
  const statusFinal = statusAutomatico({
    status: dados.status,
    dataFimVigencia: atual.dataFimVigencia ? deDate(atual.dataFimVigencia) : null,
    quantidadeAutorizada: (alteracoes.quantidadeAutorizada as number | undefined) ?? null,
    quantidadeUtilizada: atual.quantidadeUtilizada,
    hoje,
  });
  alteracoes.status = statusFinal;

  const historico: Prisma.HistoricoStatusCreateManyInput[] = [
    {
      autorizacaoId: id,
      statusAnterior: atual.status,
      statusNovo: dados.status,
      usuarioId: usuario.id,
      observacao: dados.observacao ?? dados.motivoNegativa ?? null,
    },
  ];
  if (statusFinal !== dados.status) {
    historico.push({
      autorizacaoId: id,
      statusAnterior: dados.status,
      statusNovo: statusFinal,
      observacao:
        statusFinal === "vencida"
          ? "Vigência já encerrada (automático)."
          : "Todas as sessões já utilizadas (automático).",
    });
  }

  await prisma.$transaction(async (tx) => {
    // Só aplica se ninguém mudou o status enquanto isso.
    const { count } = await tx.autorizacao.updateMany({
      where: { id, status: atual.status },
      data: alteracoes,
    });
    if (count === 0) {
      throw new ErroHttp(409, "A autorização foi alterada por outra pessoa. Recarregue a página.");
    }
    await tx.historicoStatus.createMany({ data: historico });
  });

  return json(await prisma.autorizacao.findUnique({ where: { id } }));
});
