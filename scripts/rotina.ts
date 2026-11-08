// Processo da rotina automática (lib/rotina.ts). Em produção, roda no PM2 ao
// lado da aplicação:
//
//   pm2 start npm --name sga-rotina -- run rotina
//
// "npm run rotina -- --uma-vez" roda uma rodada só e sai (útil para testar).

import { prisma } from "@/lib/prisma";
import { executarRotina } from "@/lib/rotina";

const INTERVALO_MS = 5 * 60_000;
let rodando = false;

async function rodada() {
  if (rodando) return; // a rodada anterior ainda não terminou
  rodando = true;
  try {
    const r = await executarRotina();
    const { erros, ...contagens } = r;
    console.log(new Date().toISOString(), JSON.stringify(contagens));
    for (const e of erros) console.warn(new Date().toISOString(), e);
  } catch (e) {
    console.error(new Date().toISOString(), e);
  } finally {
    rodando = false;
  }
}

if (process.argv.includes("--uma-vez")) {
  rodada().finally(() => prisma.$disconnect());
} else {
  void rodada();
  setInterval(rodada, INTERVALO_MS);
}
