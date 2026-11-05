import type { NomeIcone } from "@/components/Icone";

export type SubItem = { rotulo: string; href: string };

// Telas que dividem um item do menu: aparecem como abas no topo do conteúdo.
export type Aba = { rotulo: string; caminho: string };

export type ItemMenu = {
  caminho: string;
  rotulo: string;
  grupo: string;
  icone: NomeIcone;
  // Opções do popup ao passar o mouse sobre o item.
  subitens: SubItem[];
  abas?: Aba[];
};

// Itens do menu e seus grupos. O sistema tem um perfil só (admin), então
// todo usuário vê tudo. Nos submenus, as ações ("Nova…", "Importar…") vêm
// primeiro.
export const ITENS_MENU: ItemMenu[] = [
  {
    caminho: "/dashboard",
    rotulo: "Visão geral",
    grupo: "Geral",
    icone: "painel",
    subitens: [{ rotulo: "Painel principal", href: "/dashboard" }],
  },
  {
    caminho: "/relatorios",
    rotulo: "Relatórios",
    grupo: "Geral",
    icone: "relatorios",
    subitens: [
      { rotulo: "Atendimentos por mês", href: "/relatorios#rel-evolucao" },
      { rotulo: "Autorizações por convênio", href: "/relatorios#rel-convenio" },
      { rotulo: "Glosas", href: "/relatorios#rel-glosas" },
    ],
  },
  {
    caminho: "/solicitacoes",
    rotulo: "Solicitações",
    grupo: "Operação",
    icone: "agenda",
    subitens: [
      { rotulo: "Importar agenda do AnClinic", href: "/importacoes#importar-agenda" },
      { rotulo: "Sessões do dia", href: "/solicitacoes" },
      { rotulo: "Com pendência", href: "/solicitacoes?situacao=pendente" },
      { rotulo: "Prontas para solicitar", href: "/solicitacoes?situacao=pronta" },
      { rotulo: "Sem unidade de atendimento", href: "/solicitacoes?unidade=sem" },
    ],
  },
  {
    caminho: "/autorizacoes",
    rotulo: "Autorizações",
    grupo: "Operação",
    icone: "autorizacoes",
    subitens: [
      { rotulo: "Nova autorização", href: "/autorizacoes?novo=1" },
      { rotulo: "Todas", href: "/autorizacoes" },
      { rotulo: "Pendentes", href: "/autorizacoes?status=pendente" },
      { rotulo: "Em análise", href: "/autorizacoes?status=em_analise" },
      { rotulo: "Vencendo em 7 dias", href: "/autorizacoes?vencendoEm=7" },
    ],
  },
  {
    caminho: "/pacientes",
    rotulo: "Pacientes",
    grupo: "Cadastros",
    icone: "pacientes",
    subitens: [
      { rotulo: "Novo paciente", href: "/pacientes?novo=1" },
      { rotulo: "Ativos", href: "/pacientes" },
      { rotulo: "Inativos", href: "/pacientes?ativo=false" },
    ],
  },
  {
    caminho: "/convenios",
    rotulo: "Cadastros",
    grupo: "Cadastros",
    icone: "convenios",
    subitens: [
      { rotulo: "Novo convênio", href: "/convenios?novo=1" },
      { rotulo: "Convênios", href: "/convenios" },
      { rotulo: "Profissionais", href: "/profissionais" },
      { rotulo: "Procedimentos", href: "/procedimentos" },
      { rotulo: "Clínica e unidades", href: "/unidades" },
    ],
    abas: [
      { rotulo: "Convênios", caminho: "/convenios" },
      { rotulo: "Profissionais", caminho: "/profissionais" },
      { rotulo: "Procedimentos", caminho: "/procedimentos" },
      { rotulo: "Clínica e unidades", caminho: "/unidades" },
    ],
  },
  {
    caminho: "/importacoes",
    rotulo: "Importações e configurações",
    grupo: "Sistema",
    icone: "configuracoes",
    subitens: [
      { rotulo: "Importar agenda", href: "/importacoes#importar-agenda" },
      { rotulo: "Importar profissionais", href: "/importacoes#importar-profissionais" },
      { rotulo: "Enviar documentos", href: "/importacoes#importar-documentos" },
      { rotulo: "Histórico de importações", href: "/importacoes#historico" },
      { rotulo: "Minha conta", href: "/configuracoes#minha-conta" },
      { rotulo: "Usuários", href: "/configuracoes#usuarios-sistema" },
    ],
    abas: [
      { rotulo: "Importações", caminho: "/importacoes" },
      { rotulo: "Configurações", caminho: "/configuracoes" },
    ],
  },
];

const naRota = (pathname: string, caminho: string) => pathname === caminho || pathname.startsWith(caminho + "/");

/** Item do menu da tela atual (inclusive as telas que são abas de um item). */
export function itemDaRota(pathname: string) {
  return ITENS_MENU.find((i) => naRota(pathname, i.caminho) || i.abas?.some((a) => naRota(pathname, a.caminho)));
}

/** Aba da tela atual, quando o item do menu tem abas. */
export function abaDaRota(item: ItemMenu | undefined, pathname: string) {
  return item?.abas?.find((a) => naRota(pathname, a.caminho));
}
