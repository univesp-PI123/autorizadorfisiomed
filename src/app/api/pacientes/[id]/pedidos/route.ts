import { ErroHttp, json, naoEncontrado, rota } from "@/lib/api/http";
import { apagarArquivo, lerPdfEnviado, MAX_PDFS_POR_PEDIDO } from "@/lib/arquivos";
import { exigirSessao } from "@/lib/auth/sessao";
import { gravarDocumento } from "@/lib/documentos/salvar";
import { prisma } from "@/lib/prisma";
import { esquemaPedidoMedico } from "@/lib/validacao";

type Params = { id: string };

const DOC = { select: { id: true, tipo: true, nomeOriginal: true, tamanho: true, origem: true, createdAt: true } } as const;

const INCLUIR = {
  convenio: { select: { id: true, nome: true } },
  usuario: { select: { id: true, nome: true } },
  documentos: { ...DOC, orderBy: { createdAt: "asc" as const } },
};

// Pedidos médicos do paciente, com os PDFs, e os documentos avulsos (enviados
// em lote sem pedido ainda cadastrado).
export const GET = rota<Params>(async (req, { params }) => {
  await exigirSessao(req, ["admin", "recepcionista", "terapeuta"]);
  const { id } = await params;
  const [pedidos, avulsos] = await Promise.all([
    prisma.pedidoMedico.findMany({
      where: { pacienteId: id },
      orderBy: [{ ativo: "desc" }, { dataPedido: "desc" }],
      include: INCLUIR,
    }),
    prisma.documento.findMany({ where: { pacienteId: id, pedidoId: null }, orderBy: { createdAt: "desc" }, ...DOC }),
  ]);
  return json({ pedidos, avulsos });
});

// Multipart: campos do pedido + um ou mais "arquivos" (PDF). Um plano
// terapêutico entre eles completa as sessões por semana do pedido.
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

  const pedido = await prisma.pedidoMedico.create({ data: { ...dados, pacienteId, usuarioId: usuario.id } });
  try {
    for (const c of conteudos) {
      await gravarDocumento({
        nomeArquivo: c.nome,
        conteudo: c.conteudo,
        tipoPadrao: "pedido_medico",
        usuarioId: usuario.id,
        origem: "manual",
        pacienteId,
        pedidoId: pedido.id,
      });
    }
  } catch (erro) {
    const docs = await prisma.documento.findMany({ where: { pedidoId: pedido.id, origem: "manual", createdAt: { gte: pedido.createdAt } } });
    await prisma.documento.deleteMany({ where: { id: { in: docs.map((d) => d.id) } } });
    await Promise.all(docs.map((d) => apagarArquivo(d.caminho)));
    await prisma.pedidoMedico.delete({ where: { id: pedido.id } });
    throw erro;
  }
  return json(await prisma.pedidoMedico.findUniqueOrThrow({ where: { id: pedido.id }, include: INCLUIR }), 201);
});
