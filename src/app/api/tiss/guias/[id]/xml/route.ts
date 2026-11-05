import { naoEncontrado, rota } from "@/lib/api/http";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";

type Params = { id: string };

// Baixa o XML da guia, em ISO-8859-1 como vai para a operadora.
export const GET = rota<Params>(async (req, { params }) => {
  await exigirSessao(req);
  const { id } = await params;
  const guia = await prisma.guiaTiss.findUnique({ where: { id }, select: { numero: true, xml: true } });
  if (!guia) naoEncontrado("Guia");
  const conteudo = Buffer.from(guia.xml, "latin1");
  return new Response(new Uint8Array(conteudo), {
    headers: {
      "Content-Type": "application/xml; charset=ISO-8859-1",
      "Content-Length": String(conteudo.length),
      "Content-Disposition": `attachment; filename="guia-sadt-${guia.numero}.xml"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
