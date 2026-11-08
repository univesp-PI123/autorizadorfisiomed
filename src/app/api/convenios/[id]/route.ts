import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirAdmin, exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaConvenio, lerCorpo } from "@/lib/validacao";

type Params = { id: string };

export const GET = rota<Params>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  const convenio = await prisma.convenio.findUnique({ where: { id } });
  if (!convenio) naoEncontrado("Convênio");
  return json(convenio);
});

export const PUT = rota<Params>(async (req, { params }) => {
  await exigirAdmin(req);
  const { id } = await params;
  const dados = await lerCorpo(req, esquemaConvenio);
  const outro = await prisma.convenio.findUnique({ where: { nome: dados.nome } });
  if (outro && outro.id !== id) throw new ErroHttp(409, "Convênio com este nome já existe.");
  if (!(await prisma.convenio.findUnique({ where: { id } }))) naoEncontrado("Convênio");
  return json(await prisma.convenio.update({ where: { id }, data: dados }));
});
