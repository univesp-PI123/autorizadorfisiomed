import { ErroHttp, json, rota } from "@/lib/api/http";
import { exigirAdmin, exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaUnidade, lerCorpo } from "@/lib/validacao";

// As unidades vêm da importação da agenda (pelo nome no AnClinic) ou são
// criadas aqui; os dados (CNES, endereço) se completam na tela.
export const GET = rota(async (req) => {
  await exigirSessao(req);
  const unidades = await prisma.unidade.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { agendamentos: { where: { removidoEm: null } } } } },
  });
  return json(unidades);
});

export const POST = rota(async (req) => {
  await exigirAdmin(req);
  const dados = await lerCorpo(req, esquemaUnidade);
  if (await prisma.unidade.findUnique({ where: { nomeAnclinic: dados.nome } })) {
    throw new ErroHttp(409, "Já existe uma unidade com este nome.");
  }
  // Sem nome próprio no AnClinic: usa o nome dado aqui.
  return json(await prisma.unidade.create({ data: { ...dados, nomeAnclinic: dados.nome } }), 201);
});
