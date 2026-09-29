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

import { chaveNome } from "@/lib/importacao/planilha";

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
  convenio: { id: string; integracao: string; codigoPrestador: string | null } | null;
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

export type ContextoAnalise = {
  clinicaCadastrada: boolean;
  // Pedidos médicos ativos do paciente (convenioId nulo vale para qualquer convênio).
  pedidos: { convenioId: string | null; dataPedido: string; validoAte: string | null; arquivos: number }[];
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
  const aceitos = s.procedimento?.codigosAceitos ?? [];
  const nome = s.procedimento?.descricao ? chaveNome(s.procedimento.descricao) : null;
  const cobertura = ctx.autorizacoes.find(
    (a) =>
      a.convenioId === s.convenio!.id &&
      a.status === "autorizada" &&
      ((!!a.codigoProcedimento && aceitos.includes(a.codigoProcedimento)) ||
        (!!nome && !!a.procedimento && chaveNome(a.procedimento).includes(nome))) &&
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
  const pedido = ctx.pedidos.find(
    (pm) =>
      (pm.convenioId === null || pm.convenioId === s.convenio!.id) &&
      pm.dataPedido <= s.data &&
      (!pm.validoAte || pm.validoAte >= s.data),
  );
  if (!pedido) pendencias.push("Sem pedido médico válido");
  else if (pedido.arquivos === 0) pendencias.push("Pedido médico sem PDF anexado");

  return pendencias.length ? { situacao: "pendente", pendencias } : { situacao: "pronta", pendencias };
}
