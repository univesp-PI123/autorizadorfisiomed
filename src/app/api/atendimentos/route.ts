import type { Prisma, StatusCobranca } from "@prisma/client";
import {
  ErroHttp,
  filtroBooleano,
  filtroPeriodo,
  json,
  paginacao,
  respostaPaginada,
  rota,
} from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { marcarVencidas } from "@/lib/regras/autorizacao";
import { esquemaAtendimento, lerCorpo, STATUS_COBRANCA } from "@/lib/validacao";

export const GET = rota(async (req) => {
  await exigirSessao(req);
  const sp = req.nextUrl.searchParams;
  const pag = paginacao(req);

  const where: Prisma.AtendimentoWhereInput = {};
  if (sp.get("pacienteId")) where.pacienteId = sp.get("pacienteId")!;
  const status = sp.get("statusCobranca");
  if (status && (STATUS_COBRANCA as readonly string[]).includes(status)) {
    where.statusCobranca = status as StatusCobranca;
  }
  const semAutorizacao = filtroBooleano(sp.get("semAutorizacao"));
  if (semAutorizacao !== undefined) where.semAutorizacao = semAutorizacao;
  const periodo = filtroPeriodo(sp.get("dataInicio"), sp.get("dataFim"));
  if (periodo) where.dataAtendimento = periodo;

  const [total, data] = await prisma.$transaction([
    prisma.atendimento.count({ where }),
    prisma.atendimento.findMany({
      where,
      include: {
        paciente: { select: { id: true, nome: true } },
        autorizacao: { select: { id: true, numeroAutorizacao: true, procedimento: true } },
        terapeuta: { select: { id: true, nome: true } },
      },
      orderBy: [{ dataAtendimento: "desc" }, { createdAt: "desc" }],
      skip: pag.skip,
      take: pag.limit,
    }),
  ]);
  return respostaPaginada(data, total, pag);
});

export const POST = rota(async (req) => {
  const usuario = await exigirSessao(req, ["admin", "recepcionista", "terapeuta"]);
  const { autorizacaoId, terapeutaId, ...dados } = await lerCorpo(req, esquemaAtendimento);

  const paciente = await prisma.paciente.findUnique({ where: { id: dados.pacienteId } });
  if (!paciente) throw new ErroHttp(422, "Paciente não encontrado.");

  if (terapeutaId && !(await prisma.usuario.findUnique({ where: { id: terapeutaId } }))) {
    throw new ErroHttp(422, "Terapeuta não encontrado.");
  }

  if (autorizacaoId) {
    await marcarVencidas();
  }

  const atendimento = await prisma.$transaction(async (tx) => {
    if (autorizacaoId) {
      const aut = await tx.autorizacao.findUnique({ where: { id: autorizacaoId } });
      if (!aut || aut.pacienteId !== dados.pacienteId) {
        throw new ErroHttp(422, "A autorização escolhida não pertence a este paciente.");
      }
      if (aut.status !== "autorizada") {
        throw new ErroHttp(422, `Autorização com status "${aut.status}" não pode ser utilizada.`);
      }
      const d = dados.dataAtendimento;
      if (
        (aut.dataInicioVigencia && d < aut.dataInicioVigencia) ||
        (aut.dataFimVigencia && d > aut.dataFimVigencia)
      ) {
        throw new ErroHttp(422, "A data do atendimento está fora da vigência da autorização.");
      }

      // Consome uma sessão só se ainda houver saldo — numa única instrução, para
      // dois atendimentos simultâneos não passarem do limite.
      const { count } = await tx.autorizacao.updateMany({
        where: {
          id: aut.id,
          status: "autorizada",
          ...(aut.quantidadeAutorizada !== null && {
            quantidadeUtilizada: { lt: aut.quantidadeAutorizada },
          }),
        },
        data: { quantidadeUtilizada: { increment: 1 } },
      });
      if (count === 0) throw new ErroHttp(409, "Esta autorização não tem mais sessões disponíveis.");

      const atualizada = await tx.autorizacao.findUniqueOrThrow({ where: { id: aut.id } });
      if (
        atualizada.quantidadeAutorizada !== null &&
        atualizada.quantidadeUtilizada >= atualizada.quantidadeAutorizada
      ) {
        await tx.autorizacao.update({
          where: { id: aut.id },
          data: {
            status: "esgotada",
            historico: {
              create: {
                statusAnterior: "autorizada",
                statusNovo: "esgotada",
                observacao: "Todas as sessões autorizadas foram utilizadas (automático).",
              },
            },
          },
        });
      }
    }

    return tx.atendimento.create({
      data: {
        ...dados,
        autorizacaoId: autorizacaoId ?? null,
        semAutorizacao: !autorizacaoId,
        terapeutaId: terapeutaId ?? usuario.id,
      },
    });
  });

  return json(atendimento, 201);
});
