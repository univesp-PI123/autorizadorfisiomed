// Limita tentativas de login erradas por IP para dificultar adivinhação de
// senha. Fica em memória: basta porque a aplicação roda num único processo
// (PM2). Se um dia rodar em várias instâncias, mover para o banco ou Redis.

const JANELA_MS = 15 * 60 * 1000;
const MAX_FALHAS = 10;

const falhas = new Map<string, { quantidade: number; expiraEm: number }>();

export function bloqueado(chave: string, agora = Date.now()): boolean {
  const registro = falhas.get(chave);
  if (!registro) return false;
  if (registro.expiraEm <= agora) {
    falhas.delete(chave);
    return false;
  }
  return registro.quantidade >= MAX_FALHAS;
}

export function registrarFalha(chave: string, agora = Date.now()) {
  const registro = falhas.get(chave);
  if (!registro || registro.expiraEm <= agora) {
    falhas.set(chave, { quantidade: 1, expiraEm: agora + JANELA_MS });
  } else {
    registro.quantidade += 1;
  }
}

export function limparFalhas(chave: string) {
  falhas.delete(chave);
}

// X-Real-IP é definido pelo Nginx com o IP real da conexão (sobrescrevendo o
// que o cliente mandar), por isso é confiável aqui. A porta 3000 não deve ficar
// exposta na internet, senão o cabeçalho poderia ser forjado.
export function ipDaRequisicao(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "desconhecido"
  );
}
