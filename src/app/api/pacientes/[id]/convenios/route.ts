import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaVinculo, lerCorpo } from "@/lib/validacao";

// Vincula o paciente a um convênio (carteirinha).
export const POST = rota<{ id: string }>(async (req, { params }) => {
  await exigirSessao(req);
  const { id: pacienteId } = await params;
  const dados = await lerCorpo(req, esquemaVinculo);

  if (!(await prisma.paciente.findUnique({ where: { id: pacienteId } }))) naoEncontrado("Paciente");
  const convenio = await prisma.convenio.findUnique({ where: { id: dados.convenioId } });
  if (!convenio || !convenio.ativo) throw new ErroHttp(422, "Convênio inexistente ou inativo.");

  const existente = await prisma.pacienteConvenio.findUnique({
    where: { pacienteId_convenioId: { pacienteId, convenioId: dados.convenioId } },
  });
  if (existente) throw new ErroHttp(409, "O paciente já está vinculado a este convênio.");

  const vinculo = await prisma.pacienteConvenio.create({
    data: { ...dados, pacienteId },
    include: { convenio: true },
  });
  return json(vinculo, 201);
});
