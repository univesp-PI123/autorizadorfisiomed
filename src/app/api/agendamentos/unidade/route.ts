import { z } from "zod";
import { ErroHttp, json, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { lerCorpo } from "@/lib/validacao";

const esquema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Selecione ao menos uma sessão.").max(2000),
  unidadeId: z.string().uuid("Unidade inválida.").nullable(),
  // Também as outras sessões sem unidade dos mesmos pacientes (qualquer data).
  incluirPaciente: z.boolean().optional(),
});

// Atribui (ou tira) a unidade de atendimento de sessões da agenda. A escolha
// fica marcada como manual: a próxima importação do AnClinic não a troca.
// Tirar a unidade devolve o controle ao AnClinic.
export const PATCH = rota(async (req) => {
  await exigirSessao(req);
  const { ids, unidadeId, incluirPaciente } = await lerCorpo(req, esquema);
  if (unidadeId && !(await prisma.unidade.findUnique({ where: { id: unidadeId } }))) {
    throw new ErroHttp(422, "Unidade não encontrada.");
  }
  let alvo = ids;
  if (incluirPaciente) {
    const pacientes = (
      await prisma.agendamento.findMany({ where: { id: { in: ids }, pacienteId: { not: null } }, select: { pacienteId: true } })
    ).map((a) => a.pacienteId!);
    const outras = await prisma.agendamento.findMany({
      where: { pacienteId: { in: pacientes }, unidadeId: null, removidoEm: null },
      select: { id: true },
    });
    alvo = [...new Set([...ids, ...outras.map((o) => o.id)])];
  }
  const { count } = await prisma.agendamento.updateMany({
    where: { id: { in: alvo } },
    data: { unidadeId, unidadeManual: unidadeId !== null },
  });
  return json({ atualizadas: count });
});
