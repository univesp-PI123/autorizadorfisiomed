import type { Prisma, SituacaoAtendimento, StatusCobranca } from "@prisma/client";
import {
  ErroHttp,
  filtroBooleano,
  filtroPeriodo,
  json,
  paginacao,
  rota,
} from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { marcarVencidas } from "@/lib/regras/autorizacao";
import { consumirSessao, fimDaSessao, sincronizarAtendimentos } from "@/lib/regras/atendimentos";
import { esquemaAtendimento, lerCorpo, STATUS_COBRANCA } from "@/lib/validacao";

const SITUACOES: SituacaoAtendimento[] = ["aguardando_confirmacao", "confirmado", "cancelado"];

export const GET = rota(async (req) => {
  await exigirSessao(req);
  const sp = req.nextUrl.searchParams;
  const pag = paginacao(req);

  // Sessões autorizadas da agenda viram atendimentos aguardando confirmação.
  await marcarVencidas();
  await sincronizarAtendimentos();

  const where: Prisma.AtendimentoWhereInput = {};
  if (sp.get("pacienteId")) where.pacienteId = sp.get("pacienteId")!;
  const status = sp.get("statusCobranca");
  if (status && (STATUS_COBRANCA as readonly string[]).includes(status)) {
    where.statusCobranca = status as StatusCobranca;
  }
  const situacao = sp.get("situacao");
  if (situacao && (SITUACOES as string[]).includes(situacao)) where.situacao = situacao as SituacaoAtendimento;
  const semAutorizacao = filtroBooleano(sp.get("semAutorizacao"));
  if (semAutorizacao !== undefined) where.semAutorizacao = semAutorizacao;
  const periodo = filtroPeriodo(sp.get("dataInicio"), sp.get("dataFim"));
  if (periodo) where.dataAtendimento = periodo;

  const [total, data, aguardando] = await prisma.$transaction([
    prisma.atendimento.count({ where }),
    prisma.atendimento.findMany({
      where,
      include: {
        paciente: { select: { id: true, nome: true } },
        autorizacao: { select: { id: true, numeroAutorizacao: true, procedimento: true } },
        terapeuta: { select: { id: true, nome: true } },
        profissional: { select: { id: true, nome: true } },
        confirmadoPor: { select: { id: true, nome: true } },
      },
      orderBy: [{ dataAtendimento: "desc" }, { horaInicio: "asc" }, { createdAt: "desc" }],
      skip: pag.skip,
      take: pag.limit,
    }),
    prisma.atendimento.count({ where: { situacao: "aguardando_confirmacao" } }),
  ]);
  return json({
    data,
    aguardandoConfirmacao: aguardando,
    pagination: { total, page: pag.page, limit: pag.limit, totalPages: Math.ceil(total / pag.limit) },
  });
});

// Registro manual pelo operador (o terapeuta não registra mais): já entra
// confirmado e desconta a sessão da autorização.
export const POST = rota(async (req) => {
  const usuario = await exigirSessao(req, ["admin", "recepcionista"]);
  const { autorizacaoId, procedimentoId, horaInicio, ...dados } = await lerCorpo(req, esquemaAtendimento);

  if (!(await prisma.paciente.findUnique({ where: { id: dados.pacienteId } }))) throw new ErroHttp(422, "Paciente não encontrado.");
  const proc = procedimentoId ? await prisma.procedimento.findUnique({ where: { id: procedimentoId } }) : null;
  if (procedimentoId && !proc) throw new ErroHttp(422, "Procedimento não encontrado.");
  if (autorizacaoId) await marcarVencidas();

  const atendimento = await prisma.$transaction(async (tx) => {
    if (autorizacaoId) await consumirSessao(tx, autorizacaoId, dados.pacienteId, dados.dataAtendimento);
    return tx.atendimento.create({
      data: {
        ...dados,
        procedimento: proc?.descricao ?? dados.procedimento!,
        procedimentoId: proc?.id ?? null,
        codigoProcedimento: proc?.codigoTuss ?? null,
        horaInicio: horaInicio ?? null,
        horaFim: horaInicio ? fimDaSessao(horaInicio) : null,
        autorizacaoId: autorizacaoId ?? null,
        semAutorizacao: !autorizacaoId,
        terapeutaId: usuario.id,
        situacao: "confirmado",
        confirmadoEm: new Date(),
        confirmadoPorId: usuario.id,
      },
    });
  });

  return json(atendimento, 201);
});
