import type { NomeIcone } from "@/components/Icone";
import type { Perfil } from "@/lib/cliente/tipos";

const TODOS: Perfil[] = ["admin", "recepcionista", "terapeuta", "financeiro"];

export type SubItem = { rotulo: string; href: string; perfis?: Perfil[] };

export type ItemMenu = {
  caminho: string;
  rotulo: string;
  grupo: string;
  icone: NomeIcone;
  perfis: Perfil[];
  // Opções do popup ao passar o mouse sobre o item.
  subitens: SubItem[];
};

// Itens do menu, seus grupos e quais perfis veem cada tela. Usado pela barra
// lateral e para barrar quem digitar o endereço de uma tela fora do perfil.
export const ITENS_MENU: ItemMenu[] = [
  {
    caminho: "/dashboard",
    rotulo: "Visão geral",
    grupo: "Geral",
    icone: "painel",
    perfis: TODOS,
    subitens: [{ rotulo: "Painel principal", href: "/dashboard" }],
  },
  {
    caminho: "/relatorios",
    rotulo: "Relatórios",
    grupo: "Geral",
    icone: "relatorios",
    perfis: ["admin", "financeiro"],
    subitens: [
      { rotulo: "Atendimentos por mês", href: "/relatorios#rel-evolucao" },
      { rotulo: "Autorizações por convênio", href: "/relatorios#rel-convenio" },
      { rotulo: "Glosas", href: "/relatorios#rel-glosas" },
    ],
  },
  {
    caminho: "/autorizacoes",
    rotulo: "Autorizações",
    grupo: "Operação",
    icone: "autorizacoes",
    perfis: ["admin", "recepcionista", "financeiro"],
    subitens: [
      { rotulo: "Todas", href: "/autorizacoes" },
      { rotulo: "Pendentes", href: "/autorizacoes?status=pendente" },
      { rotulo: "Em análise", href: "/autorizacoes?status=em_analise" },
      { rotulo: "Vencendo em 7 dias", href: "/autorizacoes?vencendoEm=7" },
      { rotulo: "Nova autorização", href: "/autorizacoes?novo=1" },
    ],
  },
  {
    caminho: "/atendimentos",
    rotulo: "Atendimentos",
    grupo: "Operação",
    icone: "atendimentos",
    perfis: TODOS,
    subitens: [
      { rotulo: "Todos", href: "/atendimentos" },
      { rotulo: "Sem autorização", href: "/atendimentos?semAutorizacao=true" },
      { rotulo: "Glosados", href: "/atendimentos?statusCobranca=glosado" },
      { rotulo: "Registrar atendimento", href: "/atendimentos?novo=1", perfis: ["admin", "recepcionista", "terapeuta"] },
    ],
  },
  {
    caminho: "/pacientes",
    rotulo: "Pacientes",
    grupo: "Cadastros",
    icone: "pacientes",
    perfis: ["admin", "recepcionista", "terapeuta"],
    subitens: [
      { rotulo: "Ativos", href: "/pacientes" },
      { rotulo: "Inativos", href: "/pacientes?ativo=false" },
      { rotulo: "Novo paciente", href: "/pacientes?novo=1" },
    ],
  },
  {
    caminho: "/convenios",
    rotulo: "Convênios",
    grupo: "Cadastros",
    icone: "convenios",
    perfis: ["admin", "recepcionista", "financeiro"],
    subitens: [
      { rotulo: "Lista", href: "/convenios" },
      { rotulo: "Novo convênio", href: "/convenios?novo=1", perfis: ["admin", "financeiro"] },
    ],
  },
  {
    caminho: "/configuracoes",
    rotulo: "Configurações",
    grupo: "Sistema",
    icone: "configuracoes",
    perfis: TODOS,
    subitens: [
      { rotulo: "Minha conta", href: "/configuracoes#minha-conta" },
      { rotulo: "Usuários", href: "/configuracoes#usuarios-sistema", perfis: ["admin"] },
    ],
  },
];

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
