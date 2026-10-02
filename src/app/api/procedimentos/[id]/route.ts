import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaProcedimento, lerCorpo } from "@/lib/validacao";

// Edita o procedimento do AnClinic e, opcionalmente, o equivalente dele na
// tabela de uma operadora (de/para).
export const PUT = rota<{ id: string }>(async (req, { params }) => {
  await exigirSessao(req, ["admin", "recepcionista"]);
  const { id } = await params;
  const { equivalencia, ...dados } = await lerCorpo(req, esquemaProcedimento);
  if (!(await prisma.procedimento.findUnique({ where: { id } }))) naoEncontrado("Procedimento");

  return json(
    await prisma.$transaction(async (tx) => {
      if (equivalencia) {
        const { convenioId } = equivalencia;
        if (!(await tx.convenio.findUnique({ where: { id: convenioId } }))) throw new ErroHttp(422, "Convênio inválido.");
        // Tira a ligação anterior deste procedimento nesta operadora.
        await tx.procedimentoOperadora.updateMany({ where: { convenioId, procedimentoId: id }, data: { procedimentoId: null } });
        if (equivalencia.codigo) {
          const valores = {
            descricao: equivalencia.descricao || dados.descricao,
            tabela: equivalencia.tabela ?? "22",
            codigoTuss: equivalencia.codigoTuss ?? null,
            procedimentoId: id,
          };
          await tx.procedimentoOperadora.upsert({
            where: { convenioId_codigo: { convenioId, codigo: equivalencia.codigo } },
            create: { convenioId, codigo: equivalencia.codigo, ...valores },
            update: valores,
          });
        }
      }
      return tx.procedimento.update({ where: { id }, data: dados });
    }),
  );
});
