import { z } from "zod";
import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { deDate, hojeISO } from "@/lib/datas";
import { prisma } from "@/lib/prisma";
import { lerCorpo } from "@/lib/validacao";

type Params = { id: string };

const esquema = z.object({
  token: z
    .string()
    .trim()
    .max(10, "O token tem no máximo 10 caracteres.")
    .regex(/^\S*$/, "O token não tem espaços.")
    .transform((t) => t || null)
    .nullable(),
});

// Grava (ou apaga) o token que o paciente gerou para a sessão. Ele vale só no
// dia em que foi gerado, por isso só se informa no dia da própria sessão.
export const PATCH = rota<Params>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  const { token } = await lerCorpo(req, esquema);
  const sessao = await prisma.agendamento.findUnique({ where: { id }, select: { data: true } });
  if (!sessao) naoEncontrado("Sessão");
  if (token && deDate(sessao.data) !== hojeISO()) throw new ErroHttp(422, "O token só pode ser informado no dia da sessão.");
  await prisma.agendamento.update({
    where: { id },
    data: { tokenBeneficiario: token, tokenInformadoEm: token ? new Date() : null },
  });
  return json({ token });
});
