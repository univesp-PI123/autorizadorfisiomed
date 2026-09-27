import { naoEncontrado, rota } from "@/lib/api/http";
import { lerArquivo } from "@/lib/arquivos";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";

// Abre o PDF no navegador (só com login).
export const GET = rota<{ id: string; arquivoId: string }>(async (req, { params }) => {
  await exigirSessao(req, ["admin", "recepcionista", "terapeuta"]);
  const { id, arquivoId } = await params;
  const arquivo = await prisma.arquivoPedido.findFirst({ where: { id: arquivoId, pedidoId: id } });
  if (!arquivo) naoEncontrado("Arquivo");
  const conteudo = await lerArquivo(arquivo.caminho);
  const nome = arquivo.nomeOriginal.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(conteudo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(conteudo.length),
      "Content-Disposition": `inline; filename="${nome}"; filename*=UTF-8''${encodeURIComponent(arquivo.nomeOriginal)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
