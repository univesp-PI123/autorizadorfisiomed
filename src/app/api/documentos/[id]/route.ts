import { z } from "zod";
import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { lerArquivo } from "@/lib/arquivos";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { lerCorpo } from "@/lib/validacao";

type Params = { id: string };

// Abre o PDF no navegador (só com login).
export const GET = rota<Params>(async (req, { params }) => {
  await exigirSessao(req, ["admin", "recepcionista", "terapeuta"]);
  const { id } = await params;
  const doc = await prisma.documento.findUnique({ where: { id } });
  if (!doc) naoEncontrado("Documento");
  const conteudo = await lerArquivo(doc.caminho);
  const nome = doc.nomeOriginal.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(conteudo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(conteudo.length),
      "Content-Disposition": `inline; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(doc.nomeOriginal)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

// Liga (ou desliga) o documento a um pedido médico do mesmo paciente.
export const PATCH = rota<Params>(async (req, { params }) => {
  await exigirSessao(req, ["admin", "recepcionista"]);
  const { id } = await params;
  const { pedidoId } = await lerCorpo(req, z.object({ pedidoId: z.string().uuid("Pedido inválido.").nullable() }));
  const doc = await prisma.documento.findUnique({ where: { id } });
  if (!doc) naoEncontrado("Documento");
  if (pedidoId) {
    const pedido = await prisma.pedidoMedico.findUnique({ where: { id: pedidoId } });
    if (!pedido || pedido.pacienteId !== doc.pacienteId) throw new ErroHttp(422, "O pedido não é deste paciente.");
  }
  return json(await prisma.documento.update({ where: { id }, data: { pedidoId } }));
});
