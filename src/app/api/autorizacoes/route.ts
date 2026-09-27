import type { Prisma, StatusAutorizacao } from "@prisma/client";
import { ErroHttp, json, paginacao, respostaPaginada, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { hojeISO, paraDate, somarDias } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { marcarVencidas } from "@/lib/regras/autorizacao";
import { esquemaAutorizacao, lerCorpo, STATUS_AUTORIZACAO } from "@/lib/validacao";

export const GET = rota(async (req) => {
  await exigirSessao(req);
  await marcarVencidas();
  const sp = req.nextUrl.searchParams;
  const pag = paginacao(req);

  const status = sp.get("status");
  const vencendoEm = Number.parseInt(sp.get("vencendoEm") ?? "", 10);

  const where: Prisma.AutorizacaoWhereInput = {};
  if (status && (STATUS_AUTORIZACAO as readonly string[]).includes(status)) {
    where.status = status as StatusAutorizacao;
  }
  if (sp.get("pacienteId")) where.pacienteId = sp.get("pacienteId")!;
  if (sp.get("convenioId")) where.convenioId = sp.get("convenioId")!;

  // Autorizações ativas que vencem nos próximos N dias
  if (Number.isInteger(vencendoEm) && vencendoEm > 0) {
    const hoje = hojeISO();
    where.status = "autorizada";
    where.dataFimVigencia = {
      gte: paraDate(hoje),
      lte: paraDate(somarDias(hoje, Math.min(vencendoEm, 365))),
    };
  }

  const [total, data] = await prisma.$transaction([
    prisma.autorizacao.count({ where }),
    prisma.autorizacao.findMany({
      where,
      include: {
        paciente: { select: { id: true, nome: true, cpf: true } },
        convenio: { select: { id: true, nome: true } },
        usuarioCriou: { select: { id: true, nome: true } },
      },
      orderBy: [{ dataSolicitacao: "desc" }, { createdAt: "desc" }],
      skip: pag.skip,
      take: pag.limit,
    }),
  ]);
  return respostaPaginada(data, total, pag);
});

export const POST = rota(async (req) => {
  const usuario = await exigirSessao(req, ["admin", "recepcionista", "financeiro"]);
  const dados = await lerCorpo(req, esquemaAutorizacao);

  const [paciente, convenio] = await Promise.all([
    prisma.paciente.findUnique({ where: { id: dados.pacienteId } }),
    prisma.convenio.findUnique({ where: { id: dados.convenioId } }),
  ]);
  if (!paciente || !paciente.ativo) throw new ErroHttp(422, "Paciente inexistente ou inativo.");
  if (!convenio || !convenio.ativo) throw new ErroHttp(422, "Convênio inexistente ou inativo.");

  // Se o paciente tem carteirinha desse convênio, a autorização fica ligada a ela.
  const vinculo = await prisma.pacienteConvenio.findUnique({
    where: {
      pacienteId_convenioId: { pacienteId: dados.pacienteId, convenioId: dados.convenioId },
    },
  });

  const autorizacao = await prisma.autorizacao.create({
    data: {
      ...dados,
      dataSolicitacao: dados.dataSolicitacao ?? paraDate(hojeISO()),
      pacienteConvenioId: vinculo?.id ?? null,
      usuarioCriouId: usuario.id,
      status: "pendente",
      historico: {
        create: { statusNovo: "pendente", usuarioId: usuario.id, observacao: "Solicitação criada." },
      },
    },
    include: {
      paciente: { select: { id: true, nome: true } },
      convenio: { select: { id: true, nome: true } },
    },
  });
  return json(autorizacao, 201);
});
