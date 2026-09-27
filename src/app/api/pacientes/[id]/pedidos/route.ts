import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { apagarArquivo, lerPdfEnviado, MAX_PDFS_POR_PEDIDO, salvarPdf } from "@/lib/arquivos";
import { exigirSessao } from "@/lib/auth/sessao";
import { prisma } from "@/lib/prisma";
import { esquemaPedidoMedico } from "@/lib/validacao";

type Params = { id: string };

const INCLUIR = {
  convenio: { select: { id: true, nome: true } },
  usuario: { select: { id: true, nome: true } },
  arquivos: { select: { id: true, nomeOriginal: true, tamanho: true, createdAt: true }, orderBy: { createdAt: "asc" as const } },
};

export const GET = rota<Params>(async (req, { params }) => {
  await exigirSessao(req, ["admin", "recepcionista", "terapeuta"]);
  const { id } = await params;
  return json(
    await prisma.pedidoMedico.findMany({
      where: { pacienteId: id },
      orderBy: [{ ativo: "desc" }, { dataPedido: "desc" }],
      include: INCLUIR,
    }),
  );
});

// Multipart: campos do pedido + um ou mais "arquivos" (PDF).
export const POST = rota<Params>(async (req, { params }) => {
  const usuario = await exigirSessao(req, ["admin", "recepcionista"]);
  const { id: pacienteId } = await params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ErroHttp(400, "Envie o pedido como formulário (multipart/form-data).");
  }
  const campos = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string"));
  const dados = esquemaPedidoMedico.parse(campos);
  const arquivos = form.getAll("arquivos").filter((a): a is File => a instanceof File && a.size > 0);
  if (!arquivos.length) throw new ErroHttp(422, "Anexe o PDF do pedido médico.");
  if (arquivos.length > MAX_PDFS_POR_PEDIDO) throw new ErroHttp(422, `No máximo ${MAX_PDFS_POR_PEDIDO} PDFs por pedido.`);

  if (!(await prisma.paciente.findUnique({ where: { id: pacienteId } }))) naoEncontrado("Paciente");
  if (dados.convenioId && !(await prisma.convenio.findUnique({ where: { id: dados.convenioId } }))) {
    throw new ErroHttp(422, "Convênio inválido.");
  }

  // Valida todos antes de gravar qualquer um.
  const conteudos = [];
  for (const a of arquivos) conteudos.push({ nome: a.name.slice(0, 255), conteudo: await lerPdfEnviado(a) });

  const salvos: { nomeOriginal: string; caminho: string; tamanho: number; sha256: string }[] = [];
  try {
    for (const c of conteudos) salvos.push({ nomeOriginal: c.nome, ...(await salvarPdf(c.conteudo)) });
    const pedido = await prisma.pedidoMedico.create({
      data: { ...dados, pacienteId, usuarioId: usuario.id, arquivos: { create: salvos } },
      include: INCLUIR,
    });
    return json(pedido, 201);
  } catch (erro) {
    await Promise.all(salvos.map((s) => apagarArquivo(s.caminho)));
    throw erro;
  }
});
