import { json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { idsPacientesPorBusca } from "@/lib/pacientes/busca";
import { prisma } from "@/lib/prisma";

// Pacientes por nome, CPF ou carteirinha (para os campos de busca dos formulários).
export const GET = rota(async (req) => {
  await exigirSessao(req);
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const ids = await idsPacientesPorBusca(q, { limite: 20 });
  if (!ids.length) return json([]);
  const pacientes = await prisma.paciente.findMany({
    where: { id: { in: ids } },
    orderBy: { nome: "asc" },
    select: {
      id: true, nome: true, cpf: true, dataNascimento: true,
      vinculos: { where: { ativo: true }, select: { numeroCarteirinha: true, convenio: { select: { id: true, nome: true } } } },
    },
  });
  return json(pacientes);
});
