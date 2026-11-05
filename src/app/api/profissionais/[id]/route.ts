import { json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaProfissional, lerCorpo } from "@/lib/validacao";

export const PUT = rota<{ id: string }>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  const { convenioIds, ...dados } = await lerCorpo(req, esquemaProfissional);
  if (!(await prisma.profissional.findUnique({ where: { id } }))) naoEncontrado("Profissional");
  return json(
    await prisma.$transaction(async (tx) => {
      if (convenioIds) {
        await tx.profissionalConvenio.deleteMany({ where: { profissionalId: id, convenioId: { notIn: convenioIds } } });
        await tx.profissionalConvenio.createMany({
          data: convenioIds.map((convenioId) => ({ profissionalId: id, convenioId })),
          skipDuplicates: true,
        });
      }
      return tx.profissional.update({
        where: { id },
        data: dados,
        include: { credenciamentos: { select: { convenio: { select: { id: true, nome: true } } } } },
      });
    }),
  );
});
