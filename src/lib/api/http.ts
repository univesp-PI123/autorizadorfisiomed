import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { deDate, ehDataISO, paraDate } from "@/lib/datas";

/** Erro que vira uma resposta HTTP com a mensagem mostrada ao usuário. */
export class ErroHttp extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// Campos gravados como DATE: saem da API como "YYYY-MM-DD", no formato que as
// telas esperam. Os demais Date (createdAt, ultimoAcesso…) saem em ISO completo.
const CAMPOS_SO_DATA = new Set([
  "dataNascimento",
  "dataValidade",
  "dataInicioVigencia",
  "dataFimVigencia",
  "dataSolicitacao",
  "dataResposta",
  "dataAtendimento",
]);

export function serializar(valor: unknown, chave?: string): unknown {
  if (valor instanceof Date) {
    return chave && CAMPOS_SO_DATA.has(chave) ? deDate(valor) : valor.toISOString();
  }
  if (valor instanceof Prisma.Decimal) return valor.toString();
  if (Array.isArray(valor)) return valor.map((v) => serializar(v));
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, serializar(v, k)]),
    );
  }
  return valor;
}

export function json(dados: unknown, status = 200) {
  return NextResponse.json(serializar(dados), { status });
}

function tratarErro(erro: unknown) {
  if (erro instanceof ErroHttp) {
    return NextResponse.json({ error: erro.message }, { status: erro.status });
  }
  if (erro instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Dados inválidos.",
        detalhes: erro.issues.map((i) => ({
          campo: i.path.join("."),
          mensagem: i.message,
        })),
      },
      { status: 422 },
    );
  }
  if (erro instanceof SyntaxError) {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (erro instanceof Prisma.PrismaClientKnownRequestError) {
    if (erro.code === "P2002") {
      return NextResponse.json({ error: "Registro já existe." }, { status: 409 });
    }
    // P2023: id malformado na URL (não é um UUID) — para o usuário, não existe.
    if (erro.code === "P2025" || erro.code === "P2023") {
      return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
    }
    if (erro.code === "P2003") {
      return NextResponse.json({ error: "Registro relacionado não encontrado." }, { status: 422 });
    }
  }
  console.error(erro);
  return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 });
}

type Contexto<P> = { params: Promise<P> };

/** Envolve um route handler: erros conhecidos viram respostas HTTP. */
export function rota<P = Record<string, never>>(
  fn: (req: NextRequest, ctx: Contexto<P>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: Contexto<P>) => {
    try {
      return await fn(req, ctx);
    } catch (erro) {
      return tratarErro(erro);
    }
  };
}

export function naoEncontrado(entidade: string): never {
  throw new ErroHttp(404, `${entidade} não encontrado(a).`);
}

export function paginacao(req: NextRequest, limitePadrao = 20) {
  const sp = req.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(sp.get("limit") ?? String(limitePadrao), 10) || limitePadrao),
  );
  return { page, limit, skip: (page - 1) * limit };
}

export function respostaPaginada<T>(
  data: T[],
  total: number,
  { page, limit }: { page: number; limit: number },
) {
  return json({
    data,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  });
}

/** Lê um filtro booleano "true"/"false" da query string. */
export function filtroBooleano(valor: string | null): boolean | undefined {
  if (valor === "true") return true;
  if (valor === "false") return false;
  return undefined;
}

/** Filtro de intervalo de datas a partir de "YYYY-MM-DD" da query string. */
export function filtroPeriodo(dataInicio: string | null, dataFim: string | null) {
  const filtro: Prisma.DateTimeFilter = {};
  if (dataInicio && ehDataISO(dataInicio)) filtro.gte = paraDate(dataInicio);
  if (dataFim && ehDataISO(dataFim)) filtro.lte = paraDate(dataFim);
  return Object.keys(filtro).length ? filtro : undefined;
}
