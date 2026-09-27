import type { Perfil } from "@/lib/cliente/tipos";

const TODOS: Perfil[] = ["admin", "recepcionista", "terapeuta", "financeiro"];

// Itens do menu e quais perfis veem cada tela. Usado pelo menu lateral e para
// barrar quem digitar o endereço de uma tela que não é do seu perfil.
export const ITENS_MENU = [
  { caminho: "/dashboard", rotulo: "Dashboard", icone: "📊", perfis: TODOS },
  { caminho: "/pacientes", rotulo: "Pacientes", icone: "👤", perfis: ["admin", "recepcionista", "terapeuta"] },
  { caminho: "/convenios", rotulo: "Convênios", icone: "🏥", perfis: ["admin", "recepcionista", "financeiro"] },
  { caminho: "/autorizacoes", rotulo: "Autorizações", icone: "📋", perfis: ["admin", "recepcionista", "financeiro"] },
  { caminho: "/atendimentos", rotulo: "Atendimentos", icone: "📅", perfis: ["admin", "recepcionista", "terapeuta", "financeiro"] },
  { caminho: "/relatorios", rotulo: "Relatórios", icone: "📈", perfis: ["admin", "financeiro"] },
  { caminho: "/configuracoes", rotulo: "Configurações", icone: "⚙️", perfis: TODOS },
] satisfies { caminho: string; rotulo: string; icone: string; perfis: Perfil[] }[];

export function itemDaRota(pathname: string) {
  const raiz = "/" + (pathname.split("/")[1] ?? "");
  return ITENS_MENU.find((i) => i.caminho === raiz);
}

export const ROTULO_PERFIL: Record<Perfil, string> = {
  admin: "Administrador",
  recepcionista: "Recepção",
  terapeuta: "Terapeuta",
  financeiro: "Financeiro",
};
