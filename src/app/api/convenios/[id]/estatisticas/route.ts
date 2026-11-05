import { json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { atualizarAutorizacoes } from "@/lib/regras/atendimentos";

export const GET = rota<{ id: string }>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  if (!(await prisma.convenio.findUnique({ where: { id } }))) naoEncontrado("Convênio");
  await atualizarAutorizacoes();

  const porStatus = await prisma.autorizacao.groupBy({
    by: ["status"],
    where: { convenioId: id },
    _count: { _all: true },
  });
  const contar = (status: string) =>
    porStatus.find((g) => g.status === status)?._count._all ?? 0;

  return json({
    totalAutorizacoes: porStatus.reduce((soma, g) => soma + g._count._all, 0),
    autorizadasAtivas: contar("autorizada"),
    pendentes: contar("pendente"),
    negadas: contar("negada"),
  });
});
