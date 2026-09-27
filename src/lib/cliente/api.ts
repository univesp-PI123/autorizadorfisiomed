// Cliente HTTP das telas. A sessão vai no cookie httpOnly, que o navegador
// envia sozinho — não há token para guardar ou anexar.

export class ErroApi extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type Parametros = Record<string, string | number | boolean | null | undefined>;

function montarUrl(caminho: string, params?: Parametros) {
  const url = new URL(`/api${caminho}`, window.location.origin);
  for (const [chave, valor] of Object.entries(params ?? {})) {
    if (valor !== undefined && valor !== null && valor !== "") {
      url.searchParams.set(chave, String(valor));
    }
  }
  return url;
}

async function requisicao<T>(
  metodo: string,
  caminho: string,
  { params, corpo }: { params?: Parametros; corpo?: unknown } = {},
): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(montarUrl(caminho, params), {
      method: metodo,
      headers: corpo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ErroApi(0, "Não foi possível conectar ao servidor. Verifique sua conexão.");
  }

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    // Sessão expirada: volta para o login (menos no próprio login).
    // Recarregamento completo de propósito: descarta o estado das telas.
    if (resposta.status === 401 && caminho !== "/auth/login") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login?expirou=1";
    }
    const detalhes: { mensagem: string }[] | undefined = dados?.detalhes;
    const mensagem = detalhes?.length
      ? detalhes.map((d) => d.mensagem).join(" ")
      : dados?.error || `Erro ${resposta.status}.`;
    throw new ErroApi(resposta.status, mensagem);
  }
  return dados as T;
}

export const api = {
  get: <T>(caminho: string, params?: Parametros) => requisicao<T>("GET", caminho, { params }),
  post: <T>(caminho: string, corpo?: unknown) => requisicao<T>("POST", caminho, { corpo }),
  put: <T>(caminho: string, corpo: unknown) => requisicao<T>("PUT", caminho, { corpo }),
  patch: <T>(caminho: string, corpo?: unknown) => requisicao<T>("PATCH", caminho, { corpo }),
};

export function mensagemDeErro(erro: unknown, padrao: string) {
  return erro instanceof Error && erro.message ? erro.message : padrao;
}
