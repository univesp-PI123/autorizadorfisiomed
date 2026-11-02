// Situação de cada sessão da agenda em relação à autorização:
//
//   cancelada  — desmarcada/cancelada no AnClinic ou excluída da agenda
//   fora       — convênio sem integração, não vinculado, ou sessão que não
//                exige autorização (faturamento por "Assinatura")
//   coberta    — já existe autorização vigente com saldo (ou senha no AnClinic)
//   pronta     — tem tudo o que a guia TISS exige: pode ser solicitada
//   pendente   — falta algum dado; a lista diz qual
//
// Função pura, para ser usada pela tela da agenda e pelo robô de envio.

import { especialidadeDe } from "@/lib/documentos/especialidades";
import { chaveNome } from "@/lib/importacao/planilha";

/**
 * A autorização cobre o procedimento da sessão? Pelo código (de/para ou TUSS)
 * ou, nas autorizações lançadas à mão sem código, pelo nome: um contém o
 * outro, ou os dois são da mesma especialidade (ex.: "Psicologia" e
 * "PSICOLOGIA ABA").
 */
export function mesmoProcedimento(
  aut: { codigoProcedimento: string | null; procedimento?: string },
  sessao: { codigosAceitos: string[]; descricao?: string } | null,
): boolean {
  if (!sessao) return false;
  if (aut.codigoProcedimento && sessao.codigosAceitos.includes(aut.codigoProcedimento)) return true;
  if (!aut.procedimento || !sessao.descricao) return false;
  const a = chaveNome(aut.procedimento);
  const b = chaveNome(sessao.descricao);
  if (a.includes(b) || b.includes(a)) return true;
  const esp = especialidadeDe(sessao.descricao);
  return !!esp && esp === especialidadeDe(aut.procedimento);
}

export type SituacaoSessao = "cancelada" | "fora" | "coberta" | "pronta" | "pendente";

export type SessaoParaAnalise = {
  data: string; // YYYY-MM-DD
  statusAnclinic: string | null;
  statusFaturamento: string | null;
  senhaAutorizacao: string | null;
  removidoEm: Date | string | null;
  carteirinha: string | null;
  convenioAnclinic: string | null;
  pacienteId: string | null;
  convenio: { id: string; integracao: string; codigoPrestador: string | null; codigoAns?: string | null } | null;
  // codigoGuia: código que vai na guia (de/para da operadora ou TUSS);
  // codigosAceitos: códigos que, numa autorização, cobrem este procedimento.
  procedimento: { codigoGuia: string | null; codigosAceitos: string[]; descricao?: string } | null;
  profissional: {
    conselho: string | null;
    numeroConselho: string | null;
    ufConselho: string | null;
    cbo: string | null;
    convenioIds: string[];
  } | null;
  unidade: { cnes: string | null } | null;
};

export type PedidoParaAnalise = {
  id?: string;
  convenioId: string | null;
  dataPedido: string;
  validoAte: string | null;
  arquivos: number;
  cbo: string | null;
  indicacao: boolean; // tem indicação clínica ou CID
};

/** Pedido médico que vale para a sessão: do convênio (ou de qualquer um) e vigente na data; o mais recente. */
export function pedidoDaSessao<P extends PedidoParaAnalise>(pedidos: P[], convenioId: string, data: string): P | undefined {
  return pedidos
    .filter(
      (pm) =>
        (pm.convenioId === null || pm.convenioId === convenioId) &&
        pm.dataPedido <= data &&
        (!pm.validoAte || pm.validoAte >= data),
    )
    .sort((a, b) => b.dataPedido.localeCompare(a.dataPedido))[0];
}

export type ContextoAnalise = {
  clinicaCadastrada: boolean;
  // Pedidos médicos ativos do paciente (convenioId nulo vale para qualquer convênio).
  // cbo e indicacao: dados do médico solicitante e do diagnóstico que vão na guia.
  pedidos: PedidoParaAnalise[];
  // Autorizações do paciente, para saber se a sessão já está coberta.
  autorizacoes: {
    id?: string;
    convenioId: string;
    codigoProcedimento: string | null;
    procedimento?: string; // nome na autorização (autorizações manuais podem não ter código)
    status: string;
    dataInicioVigencia: string | null;
    dataFimVigencia: string | null;
    saldo: number | null; // null = sem quantidade autorizada informada
  }[];
};

const STATUS_INATIVO = /cancel|desmarc|n[aã]o compareceu|falt|n[aã]o autorizad/i;

export function sessaoInativa(statusAnclinic: string | null): boolean {
  return !!statusAnclinic && STATUS_INATIVO.test(statusAnclinic);
}

export function exigeAutorizacao(statusFaturamento: string | null): boolean {
  return !statusFaturamento || /autoriza/i.test(statusFaturamento);
}

export function analisarSessao(
  s: SessaoParaAnalise,
  ctx: ContextoAnalise,
): { situacao: SituacaoSessao; pendencias: string[]; motivo?: string; autorizacaoId?: string } {
  if (s.removidoEm) return { situacao: "cancelada", pendencias: [], motivo: "Excluída da agenda do AnClinic." };
  if (sessaoInativa(s.statusAnclinic)) return { situacao: "cancelada", pendencias: [], motivo: s.statusAnclinic ?? undefined };
  if (!s.convenioAnclinic) return { situacao: "fora", pendencias: [], motivo: "Sem convênio." };
  if (!s.convenio) return { situacao: "fora", pendencias: [], motivo: "Convênio do AnClinic não vinculado a um convênio do sistema." };

  // Cobertura vale para qualquer convênio: autorização registrada no sistema
  // (automática ou manual) ou senha já lançada no AnClinic.
  const codigoGuia = s.procedimento?.codigoGuia ?? null;
  const cobertura = ctx.autorizacoes.find(
    (a) =>
      a.convenioId === s.convenio!.id &&
      a.status === "autorizada" &&
      mesmoProcedimento(a, s.procedimento) &&
      (!a.dataInicioVigencia || a.dataInicioVigencia <= s.data) &&
      (!a.dataFimVigencia || a.dataFimVigencia >= s.data) &&
      (a.saldo === null || a.saldo > 0),
  );
  if (cobertura) return { situacao: "coberta", pendencias: [], motivo: "Autorização vigente com saldo.", autorizacaoId: cobertura.id };
  if (s.senhaAutorizacao) return { situacao: "coberta", pendencias: [], motivo: `Senha ${s.senhaAutorizacao} no AnClinic.` };

  if (s.convenio.integracao === "manual") return { situacao: "fora", pendencias: [], motivo: "Convênio sem envio automático." };
  if (!exigeAutorizacao(s.statusFaturamento)) {
    return { situacao: "fora", pendencias: [], motivo: `Não exige autorização (${s.statusFaturamento}).` };
  }

  const pendencias: string[] = [];
  if (!ctx.clinicaCadastrada) pendencias.push("Dados da clínica não cadastrados");
  if (!s.convenio.codigoPrestador) pendencias.push("Convênio sem código do prestador");
  if (!/^\d{6}$/.test(s.convenio.codigoAns ?? "")) pendencias.push("Convênio sem registro ANS");
  if (!s.unidade) pendencias.push("Sessão sem unidade de atendimento");
  else if (!s.unidade.cnes) pendencias.push("Unidade sem CNES");
  if (!s.pacienteId) pendencias.push("Paciente não identificado");
  if (!s.carteirinha) pendencias.push("Sem carteirinha");
  if (!s.procedimento) pendencias.push("Sem procedimento");
  else if (!codigoGuia) pendencias.push("Procedimento sem código para a operadora");
  const p = s.profissional;
  if (!p) pendencias.push("Profissional não identificado");
  else {
    if (!p.conselho || !p.numeroConselho || !p.ufConselho) pendencias.push("Profissional sem conselho/número/UF");
    if (!p.cbo) pendencias.push("Profissional sem CBO");
    if (!p.convenioIds.includes(s.convenio.id)) pendencias.push("Profissional não credenciado no convênio");
  }
  const pedido = pedidoDaSessao(ctx.pedidos, s.convenio.id, s.data);
  if (!pedido) pendencias.push("Sem pedido médico válido");
  else {
    if (pedido.arquivos === 0) pendencias.push("Pedido médico sem PDF anexado");
    if (!pedido.cbo) pendencias.push("Pedido médico sem CBO do médico");
    if (!pedido.indicacao) pendencias.push("Pedido médico sem indicação clínica nem CID");
  }

  return pendencias.length ? { situacao: "pendente", pendencias } : { situacao: "pronta", pendencias };
}
