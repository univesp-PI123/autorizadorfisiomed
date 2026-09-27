// Ambientes (tenants) da CFTConsult. Cada cliente roda no próprio subdomínio,
// com banco e usuários próprios; trocar de ambiente é abrir o endereço dele.
// Para um novo cliente: suba a aplicação no subdomínio e acrescente aqui.

export type Ambiente = { id: string; nome: string; dominio: string };

export const AMBIENTES: Ambiente[] = [
  { id: "fisiomed", nome: "Fisiomed ABA", dominio: "autofisiomed.cftconsult.com.br" },
];

/** Ambiente do endereço atual; em testes/local (IP, localhost) usa o primeiro. */
export function ambienteDoHost(host: string): Ambiente {
  return AMBIENTES.find((a) => a.dominio === host.toLowerCase()) ?? AMBIENTES[0];
}
