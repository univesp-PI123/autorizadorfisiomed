// Busca única de paciente: nome (sem diferenciar acentos e maiúsculas), CPF
// ou número da carteirinha (ignorando pontuação e zeros à esquerda).

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const COM_ACENTO = "áàâãäéèêëíìîïóòôõöúùûüç";
const SEM_ACENTO = "aaaaaeeeeiiiiooooouuuuc";

export async function idsPacientesPorBusca(termo: string, { ativos = true, limite = 20 } = {}): Promise<string[]> {
  const texto = termo.trim().toLowerCase();
  if (!texto) return [];
  const nome = `%${texto.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[%_]/g, "")}%`;
  const digitos = texto.replace(/\D/g, "");
  const porNumero = digitos.length >= 3;
  const numero = `%${digitos}%`;
  const carteira = `%${digitos.replace(/^0+/, "") || digitos}%`;
  const linhas = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id
      FROM pacientes p
     WHERE (${!ativos} OR p.ativo)
       AND (
             translate(lower(p.nome), ${COM_ACENTO}, ${SEM_ACENTO}) LIKE ${nome}
          OR (${porNumero} AND regexp_replace(coalesce(p.cpf, ''), '\\D', '', 'g') LIKE ${numero})
          OR (${porNumero} AND EXISTS (
                SELECT 1 FROM paciente_convenios v
                 WHERE v."pacienteId" = p.id
                   AND ltrim(regexp_replace(v."numeroCarteirinha", '\\D', '', 'g'), '0') LIKE ${carteira}))
           )
     ORDER BY p.nome
     LIMIT ${Prisma.raw(String(Math.min(Math.max(limite, 1), 500)))}`;
  return linhas.map((l) => l.id);
}
