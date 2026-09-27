// Formato dos dados como chegam da API (datas "só dia" em YYYY-MM-DD,
// valores monetários como texto).

export type Perfil = "admin" | "recepcionista" | "terapeuta" | "financeiro";

export type StatusAutorizacao =
  | "pendente"
  | "em_analise"
  | "autorizada"
  | "negada"
  | "vencida"
  | "cancelada"
  | "esgotada";

export type StatusCobranca = "pendente" | "faturado" | "pago" | "glosado" | "cancelado";

export type Referencia = { id: string; nome: string };

export type UsuarioLogado = Referencia & { email: string; perfil: Perfil };

export type Usuario = UsuarioLogado & {
  ativo: boolean;
  ultimoAcesso: string | null;
  createdAt: string;
};

export type Convenio = {
  id: string;
  nome: string;
  codigoAns: string | null;
  cnpj: string | null;
  contatoNome: string | null;
  contatoTelefone: string | null;
  contatoEmail: string | null;
  prazoAutorizacaoDias: number;
  alertaAntecipacaoDias: number;
  procedimentosCobertos: string[];
  ativo: boolean;
  observacoes: string | null;
  integracao: "manual" | "tiss_amil";
  codigoPrestador: string | null;
  nomesAnclinic: string[];
};

export type Vinculo = {
  id: string;
  convenioId: string;
  numeroCarteirinha: string;
  plano: string | null;
  titular: string | null;
  dataValidade: string | null;
  ativo: boolean;
  convenio?: Referencia;
};

export type Paciente = {
  id: string;
  nome: string;
  dataNascimento: string | null;
  cpf: string | null;
  responsavel: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  diagnostico: string | null;
  cid: string | null;
  ativo: boolean;
  observacoes: string | null;
  vinculos?: Vinculo[];
};

export type HistoricoStatus = {
  id: string;
  statusAnterior: StatusAutorizacao | null;
  statusNovo: StatusAutorizacao;
  observacao: string | null;
  createdAt: string;
  usuario: Referencia | null;
};

export type Autorizacao = {
  id: string;
  pacienteId: string;
  convenioId: string;
  numeroAutorizacao: string | null;
  protocolo: string | null;
  procedimento: string;
  codigoProcedimento: string | null;
  quantidadeSolicitada: number;
  quantidadeAutorizada: number | null;
  quantidadeUtilizada: number;
  dataInicioVigencia: string | null;
  dataFimVigencia: string | null;
  dataSolicitacao: string;
  dataResposta: string | null;
  status: StatusAutorizacao;
  motivoNegativa: string | null;
  observacoes: string | null;
  paciente?: Referencia & { cpf?: string | null; telefone?: string | null };
  convenio?: Referencia;
  vinculo?: Vinculo | null;
  usuarioCriou?: Referencia | null;
  historico?: HistoricoStatus[];
};

export type Atendimento = {
  id: string;
  pacienteId: string;
  autorizacaoId: string | null;
  dataAtendimento: string;
  horaInicio: string | null;
  horaFim: string | null;
  procedimento: string;
  statusCobranca: StatusCobranca;
  valorCobrado: string | null;
  valorPago: string | null;
  motivoGlosa: string | null;
  semAutorizacao: boolean;
  evolucao: string | null;
  paciente?: Referencia;
  terapeuta?: Referencia | null;
  autorizacao?: {
    id: string;
    numeroAutorizacao: string | null;
    procedimento: string;
    convenio?: Referencia;
  } | null;
};

export type Paginado<T> = {
  data: T[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
};

export type Dashboard = {
  totalPacientes: number;
  autorizacoesAtivas: number;
  autorizacoesPendentes: number;
  autorizacoesVencendo: number;
  atendimentosMes: number;
  glosasAberto: number;
  semAutorizacaoMes: number;
  totalGlosado: number;
};

export type EvolucaoMes = { mes: string; total: number; semAutorizacao: number; glosados: number };

export type AutorizacoesPorConvenio = { status: StatusAutorizacao; total: number; convenio: Referencia };

export type ResumoGlosas = { total: number; totalGlosado: number; glosas: Atendimento[] };

// --- Integração AnClinic / TISS ---------------------------------------

export type Clinica = { id: string; razaoSocial: string; nomeFantasia: string | null; cnpj: string };

export type Unidade = {
  id: string;
  nome: string;
  nomeAnclinic: string;
  cnes: string | null;
  cep: string | null;
  tipoLogradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  ativo: boolean;
};

export type Profissional = {
  id: string;
  nome: string;
  cpf: string;
  cns: string | null;
  conselho: string | null;
  numeroConselho: string | null;
  ufConselho: string | null;
  cbo: string | null;
  especialidades: string | null;
  ativo: boolean;
  credenciamentos: { convenio: Referencia }[];
  _count?: { agendamentos: number };
};

export type Procedimento = {
  id: string;
  codigoAnclinic: string;
  descricao: string;
  codigoTuss: string | null;
  tabelaTuss: string | null;
  ativo: boolean;
  _count?: { agendamentos: number };
};

export type AvisoImportacao = { mensagem: string; quantidade: number; linhas: number[] };

export type Importacao = {
  id: string;
  tipo: "agenda" | "profissionais";
  arquivoNome: string;
  linhas: number;
  criados: number;
  atualizados: number;
  ignorados: number;
  createdAt: string;
  usuario: Referencia | null;
  resumo: {
    avisos?: AvisoImportacao[];
    // agenda
    periodo?: { inicio: string; fim: string } | null;
    sessoes?: number;
    removidas?: number;
    novos?: { pacientes: number; profissionais: number; procedimentos: number; unidades: number };
    porConvenio?: { nome: string; convenioId: string | null; convenio: string | null; sessoes: number }[];
    // profissionais
    convenio?: Referencia | null;
    credenciados?: number;
    descredenciados?: number;
    semConselho?: number;
  };
};

export type SituacaoSessao = "pendente" | "pronta" | "coberta" | "fora" | "cancelada";

export type SessaoAgenda = {
  id: string;
  idAnclinic: string;
  horaInicio: string | null;
  horaFim: string | null;
  paciente: Referencia | null;
  pacienteAnclinic: string | null;
  convenio: Referencia | null;
  convenioAnclinic: string | null;
  carteirinha: string | null;
  procedimento: { id: string; codigoAnclinic: string; descricao: string; codigoTuss: string | null } | null;
  profissional: (Referencia & { conselho: string | null; numeroConselho: string | null }) | null;
  unidade: Referencia | null;
  statusAnclinic: string | null;
  agendamentosRestantes: number | null;
  situacao: SituacaoSessao;
  pendencias: string[];
  motivo?: string;
};

export type Agenda = {
  data: string;
  total: number;
  resumo: Record<SituacaoSessao, number>;
  pendencias: { pendencia: string; quantidade: number }[];
  sessoes: SessaoAgenda[];
};

export type PedidoMedico = {
  id: string;
  pacienteId: string;
  convenio: Referencia | null;
  medicoNome: string;
  conselho: string;
  numeroConselho: string;
  ufConselho: string;
  cbo: string | null;
  cid: string | null;
  indicacaoClinica: string | null;
  dataPedido: string;
  validoAte: string | null;
  ativo: boolean;
  observacoes: string | null;
  usuario: Referencia | null;
  createdAt: string;
  arquivos: { id: string; nomeOriginal: string; tamanho: number; createdAt: string }[];
};
