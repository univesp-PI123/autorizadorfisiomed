import { api } from "./api";
import type {
  Atendimento,
  Autorizacao,
  AutorizacoesPorConvenio,
  Convenio,
  Dashboard,
  EvolucaoMes,
  Paciente,
  Paginado,
  ResumoGlosas,
  Usuario,
  UsuarioLogado,
  Vinculo,
} from "./tipos";

type Filtros = Record<string, string | number | boolean | undefined>;

export const authService = {
  login: (email: string, senha: string) =>
    api.post<{ usuario: UsuarioLogado }>("/auth/login", { email, senha }),
  logout: () => api.post("/auth/logout"),
};

export const pacienteService = {
  listar: (params: Filtros = {}) => api.get<Paginado<Paciente>>("/pacientes", params),
  buscarPorId: (id: string) =>
    api.get<Paciente & { autorizacoes: Autorizacao[] }>(`/pacientes/${id}`),
  criar: (dados: unknown) => api.post<Paciente>("/pacientes", dados),
  atualizar: (id: string, dados: unknown) => api.put<Paciente>(`/pacientes/${id}`, dados),
  desativar: (id: string) => api.patch(`/pacientes/${id}/desativar`),
  vincularConvenio: (id: string, dados: unknown) =>
    api.post<Vinculo>(`/pacientes/${id}/convenios`, dados),
};

export const convenioService = {
  listar: (params: Filtros = {}) => api.get<Convenio[]>("/convenios", params),
  criar: (dados: unknown) => api.post<Convenio>("/convenios", dados),
  atualizar: (id: string, dados: unknown) => api.put<Convenio>(`/convenios/${id}`, dados),
};

export const autorizacaoService = {
  listar: (params: Filtros = {}) => api.get<Paginado<Autorizacao>>("/autorizacoes", params),
  buscarPorId: (id: string) => api.get<Autorizacao>(`/autorizacoes/${id}`),
  criar: (dados: unknown) => api.post<Autorizacao>("/autorizacoes", dados),
  atualizarStatus: (id: string, dados: unknown) =>
    api.patch<Autorizacao>(`/autorizacoes/${id}/status`, dados),
  alertasVencimento: (dias = 7) =>
    api.get<{ total: number; autorizacoes: Autorizacao[] }>("/autorizacoes/alertas/vencimento", {
      dias,
    }),
};

export const atendimentoService = {
  listar: (params: Filtros = {}) => api.get<Paginado<Atendimento>>("/atendimentos", params),
  criar: (dados: unknown) => api.post<Atendimento>("/atendimentos", dados),
  atualizar: (id: string, dados: unknown) => api.put<Atendimento>(`/atendimentos/${id}`, dados),
  resumoGlosas: () => api.get<ResumoGlosas>("/atendimentos/resumo/glosas"),
};

export const relatorioService = {
  dashboard: () => api.get<Dashboard>("/relatorios/dashboard"),
  autorizacoesPorConvenio: () =>
    api.get<AutorizacoesPorConvenio[]>("/relatorios/autorizacoes-por-convenio"),
  evolucaoAtendimentos: (meses = 6) =>
    api.get<EvolucaoMes[]>("/relatorios/evolucao-atendimentos", { meses }),
};

export const usuarioService = {
  listar: () => api.get<Usuario[]>("/usuarios"),
  criar: (dados: unknown) => api.post<Usuario>("/usuarios", dados),
  atualizar: (id: string, dados: unknown) => api.put<Usuario>(`/usuarios/${id}`, dados),
  alterarSenha: (dados: { senhaAtual: string; novaSenha: string }) =>
    api.patch("/usuarios/me/senha", dados),
};
