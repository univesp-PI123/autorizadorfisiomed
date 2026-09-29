import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Avisos } from "./avisos";
import type { interpretarTabelaOperadora, interpretarTuss } from "./tabelas";

const OPCOES_TX = { timeout: 120_000, maxWait: 10_000 };

/**
 * Grava a tabela da operadora (atualiza pelo código) e o de/para com os
 * procedimentos do AnClinic. Procedimento do AnClinic ainda não importado é
 * criado; a agenda o reconhece depois pelo código.
 */
export async function gravarTabelaOperadora(
  t: ReturnType<typeof interpretarTabelaOperadora>,
  convenioId: string,
  arquivoNome: string,
  usuarioId: string,
) {
  const avisos = new Avisos();
  for (const a of t.avisos) for (const l of a.linhas) avisos.add(a.mensagem, l);

  return prisma.$transaction(async (tx) => {
    const convenio = await tx.convenio.findUniqueOrThrow({ where: { id: convenioId }, select: { id: true, nome: true } });
    const existentes = new Map(
      (await tx.procedimentoOperadora.findMany({ where: { convenioId } })).map((p) => [p.codigo, p]),
    );
    const procs = new Map((await tx.procedimento.findMany()).map((p) => [p.codigoAnclinic, p]));
    let criados = 0;
    let atualizados = 0;
    let equivalencias = 0;
    const usados = new Map<string, string>(); // procedimentoId → código da operadora nesta planilha

    for (const it of t.itens) {
      let procedimentoId: string | null | undefined = undefined; // undefined = não mexe
      if (it.codigoAnclinic) {
        let proc = procs.get(it.codigoAnclinic);
        if (!proc) {
          proc = await tx.procedimento.create({
            data: { codigoAnclinic: it.codigoAnclinic.slice(0, 20), descricao: it.descricao.slice(0, 200) },
          });
          procs.set(proc.codigoAnclinic, proc);
        }
        if (usados.has(proc.id)) {
          avisos.add(`O procedimento ${it.codigoAnclinic} do AnClinic já tem equivalente nesta planilha (${usados.get(proc.id)}): mantido o primeiro.`, it.linha);
        } else {
          procedimentoId = proc.id;
          usados.set(proc.id, it.codigo);
          equivalencias++;
          // Outro código desta operadora ligado ao mesmo procedimento perde a ligação.
          await tx.procedimentoOperadora.updateMany({
            where: { convenioId, procedimentoId: proc.id, codigo: { not: it.codigo } },
            data: { procedimentoId: null },
          });
          if (!proc.codigoTuss && it.codigoTuss) {
            await tx.procedimento.update({ where: { id: proc.id }, data: { codigoTuss: it.codigoTuss, tabelaTuss: "22" } });
          }
        }
      }
      const dados = {
        descricao: it.descricao,
        tabela: it.tabela,
        codigoTuss: it.codigoTuss,
        valor: it.valor === null ? null : new Prisma.Decimal(it.valor),
        ativo: true,
        ...(procedimentoId !== undefined && { procedimentoId }),
      };
      if (existentes.has(it.codigo)) {
        await tx.procedimentoOperadora.update({ where: { convenioId_codigo: { convenioId, codigo: it.codigo } }, data: dados });
        atualizados++;
      } else {
        await tx.procedimentoOperadora.create({ data: { convenioId, codigo: it.codigo, ...dados } });
        criados++;
      }
    }

    return tx.importacao.create({
      data: {
        tipo: "tabela_operadora",
        arquivoNome: arquivoNome.slice(0, 255),
        usuarioId,
        linhas: t.itens.length + t.ignoradas,
        criados,
        atualizados,
        ignorados: t.ignoradas,
        resumo: { convenio, equivalencias, avisos: avisos.lista() },
      },
    });
  }, OPCOES_TX);
}

/** Grava a Tabela 22 da TUSS em blocos (são milhares de linhas). */
export async function gravarTuss(t: ReturnType<typeof interpretarTuss>, arquivoNome: string, usuarioId: string) {
  const codigos = t.itens.map((i) => i.codigo);
  const jaExistiam = await prisma.tussProcedimento.count({ where: { codigo: { in: codigos } } });
  for (let i = 0; i < t.itens.length; i += 1000) {
    const bloco = t.itens.slice(i, i + 1000);
    await prisma.$executeRaw`
      INSERT INTO tuss_procedimentos (codigo, termo)
      SELECT * FROM unnest(${bloco.map((b) => b.codigo)}::text[], ${bloco.map((b) => b.termo)}::text[])
      ON CONFLICT (codigo) DO UPDATE SET termo = EXCLUDED.termo`;
  }
  return prisma.importacao.create({
    data: {
      tipo: "tuss",
      arquivoNome: arquivoNome.slice(0, 255),
      usuarioId,
      linhas: t.itens.length + t.ignoradas,
      criados: t.itens.length - jaExistiam,
      atualizados: jaExistiam,
      ignorados: t.ignoradas,
      resumo: { avisos: t.avisos },
    },
  });
}
