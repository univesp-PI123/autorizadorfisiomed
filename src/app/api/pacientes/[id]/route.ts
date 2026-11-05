import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { atualizarAutorizacoes } from "@/lib/regras/atendimentos";
import { esquemaPaciente, lerCorpo } from "@/lib/validacao";

type Params = { id: string };

export const GET = rota<Params>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  await atualizarAutorizacoes();
  const paciente = await prisma.paciente.findUnique({
    where: { id },
    include: {
      vinculos: { include: { convenio: true }, orderBy: { createdAt: "asc" } },
      autorizacoes: {
        include: { convenio: { select: { id: true, nome: true } } },
        orderBy: { dataSolicitacao: "desc" },
        take: 10,
      },
    },
  });
  if (!paciente) naoEncontrado("Paciente");
  return json(paciente);
});

export const PUT = rota<Params>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  const dados = await lerCorpo(req, esquemaPaciente);
  if (dados.cpf) {
    const outro = await prisma.paciente.findUnique({ where: { cpf: dados.cpf } });
    if (outro && outro.id !== id) throw new ErroHttp(409, "CPF já cadastrado no sistema.");
  }
  if (!(await prisma.paciente.findUnique({ where: { id } }))) naoEncontrado("Paciente");
  return json(await prisma.paciente.update({ where: { id }, data: dados }));
});
