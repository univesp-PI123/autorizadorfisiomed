import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { deDate, hojeISO } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { marcarVencidas } from "@/lib/regras/autorizacao";
import { consumirSessao } from "@/lib/regras/atendimentos";
import { esquemaSituacaoAtendimento, lerCorpo } from "@/lib/validacao";

// O operador confirma que a sessão aconteceu (desconta da autorização) ou
// cancela, com motivo obrigatório.
export const PATCH = rota<{ id: string }>(async (req, { params }) => {
  const usuario = await exigirSessao(req, ["admin", "recepcionista"]);
  const { id } = await params;
  const corpo = await lerCorpo(req, esquemaSituacaoAtendimento);
  const atendimento = await prisma.atendimento.findUnique({ where: { id } });
  if (!atendimento) naoEncontrado("Atendimento");
  if (atendimento.situacao !== "aguardando_confirmacao") {
    throw new ErroHttp(409, "Este atendimento já foi confirmado ou cancelado.");
  }

  if (corpo.acao === "cancelar") {
    return json(
      await prisma.atendimento.update({
        where: { id },
        data: {
          situacao: "cancelado",
          statusCobranca: "cancelado",
          motivoCancelamento: corpo.motivo,
          confirmadoEm: new Date(),
          confirmadoPorId: usuario.id,
        },
      }),
    );
  }

  if (deDate(atendimento.dataAtendimento) > hojeISO()) {
    throw new ErroHttp(409, `A sessão é de ${deDate(atendimento.dataAtendimento).split("-").reverse().join("/")}: confirme depois que ela acontecer.`);
  }
  if (atendimento.autorizacaoId) await marcarVencidas();
  return json(
    await prisma.$transaction(async (tx) => {
      // Só um pedido confirma: o segundo encontra a situação já alterada.
      const { count } = await tx.atendimento.updateMany({
        where: { id, situacao: "aguardando_confirmacao" },
        data: { situacao: "confirmado", confirmadoEm: new Date(), confirmadoPorId: usuario.id },
      });
      if (count === 0) throw new ErroHttp(409, "Este atendimento já foi confirmado ou cancelado.");
      if (atendimento.autorizacaoId) {
        await consumirSessao(tx, atendimento.autorizacaoId, atendimento.pacienteId, atendimento.dataAtendimento);
      }
      return tx.atendimento.findUniqueOrThrow({ where: { id } });
    }),
  );
});
