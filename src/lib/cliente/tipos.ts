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

export type SituacaoAtendimento = "aguardando_confirmacao" | "confirmado" | "cancelado";

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
  convenio?: Referencia & { integracao?: string };
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
  atendimentos?: Partial<Record<SituacaoAtendimento, number>>;
  atendimentosGerados?: number;
  plano?: {
    id: string;
    medicoNome: string;
    conselho: string;
    numeroConselho: string;
    ufConselho: string;
    cid: string | null;
    dataPedido: string;
    validoAte: string | null;
    sessoesSemanais: number | null;
    planoItens: ItemPlano[] | null;
    documentos: DocumentoResumo[];
  } | null;
};

export type PacienteBusca = {
  id: string;
  nome: string;
  cpf: string | null;
  dataNascimento: string | null;
  vinculos: { numeroCarteirinha: string; convenio: Referencia }[];
};

export type DadosParaAutorizacao = {
  paciente: {
    id: string;
    nome: string;
    cpf: string | null;
    dataNascimento: string | null;
    ativo: boolean;
    cid: string | null;
    vinculos: { convenioId: string; numeroCarteirinha: string; convenio: Referencia }[];
  };
  agenda: {
    convenio: Referencia;
    procedimento: { id: string; codigoAnclinic: string; descricao: string };
    codigo: string | null;
    sessoes: number;
    ultima: string;
    proxima: string | null;
  }[];
  pedido: {
    id: string;
    medicoNome: string;
    numeroConselho: string;
    ufConselho: string;
    cid: string | null;
    dataPedido: string;
    validoAte: string | null;
    sessoesSemanais: number | null;
    planoItens: ItemPlano[] | null;
  } | null;
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
  motivoGlosa: string | null;
  semAutorizacao: boolean;
  evolucao: string | null;
  situacao: SituacaoAtendimento;
  motivoCancelamento: string | null;
  confirmadoEm: string | null;
  agendamentoId: string | null;
  paciente?: Referencia;
  terapeuta?: Referencia | null;
  profissional?: Referencia | null;
  confirmadoPor?: Referencia | null;
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

export type ResumoGlosas = { total: number; glosas: Atendimento[] };

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
  _count?: { agendamentos: number };
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
  termoTuss?: string | null;
  ativo: boolean;
  equivalencia?: Equivalencia | null;
  _count?: { agendamentos: number };
};

export type Equivalencia = {
  id: string;
  codigo: string;
  descricao: string;
  tabela: string;
  codigoTuss: string | null;
};

export type ProcedimentoOperadora = Equivalencia & {
  ativo: boolean;
  procedimento: { id: string; codigoAnclinic: string; descricao: string } | null;
};

export type TussProcedimento = { codigo: string; termo: string };

export type AvisoImportacao = { mensagem: string; quantidade: number; linhas: number[] };

export type Importacao = {
  id: string;
  tipo: "agenda" | "profissionais" | "documentos" | "tabela_operadora" | "tuss";
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
    // documentos
    vinculados?: number;
    semPaciente?: number;
    duplicados?: number;
    erros?: number;
    pedidosCriados?: number;
    arquivos?: ResultadoDocumento[];
    // tabela da operadora / TUSS
    equivalencias?: number;
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
  procedimento: { id: string; codigoAnclinic: string; descricao: string; codigoGuia: string | null } | null;
  profissional: (Referencia & { conselho: string | null; numeroConselho: string | null }) | null;
  unidade: Referencia | null;
  unidadeManual: boolean;
  statusAnclinic: string | null;
  agendamentosRestantes: number | null;
  atendimento: { id: string; situacao: SituacaoAtendimento } | null;
  situacao: SituacaoSessao;
  pendencias: string[];
  motivo?: string;
  pedeToken: boolean; // sessão da Amil: a guia leva o token do paciente
  token: string | null;
  tokenDoDia: boolean; // informado no dia da sessão (fora disso, não vale)
  // Última guia TISS gerada com esta sessão e a resposta da operadora.
  guia: {
    id: string;
    numero: number;
    situacao: string;
    enviada: boolean;
    podeEnviar: boolean;
    senha: string | null;
    validadeSenha: string | null;
    glosas: string[];
    erro: string | null;
  } | null;
};

export type Agenda = {
  data: string;
  total: number;
  semUnidade: number;
  resumo: Record<SituacaoSessao, number>;
  pendencias: { pendencia: string; quantidade: number }[];
  sessoes: SessaoAgenda[];
};

export type RespostaElegibilidade =
  | { tipo: "recibo"; elegivel: boolean; nome: string | null; carteira: string | null; validade: string | null; glosas: string[] }
  | { tipo: "erro"; glosas: string[] }
  | { tipo: "falha"; mensagem: string };

export type GuiaEnviada = {
  id: string;
  statusOperadora: string | null;
  situacao: string;
  numeroGuiaOperadora: string | null;
  senhaOperadora: string | null;
  validadeSenha: string | null;
  glosas: string[];
  erroEnvio: string | null;
};

export type ResultadoGuias = {
  guias: { id: string; numero: number; paciente: string; procedimento: string; codigo: string; sessao: string }[];
  erros: { paciente: string; procedimento: string; erros: string[] }[];
  recusadas: { agendamentoId: string; paciente: string; motivo: string }[];
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
  sessoesSemanais: number | null;
  planoItens: ItemPlano[] | null;
  documentos: DocumentoResumo[];
};

export type TipoDocumento = "pedido_medico" | "plano_terapeutico" | "relatorio" | "outro";

export type DocumentoResumo = {
  id: string;
  tipo: TipoDocumento;
  nomeOriginal: string;
  tamanho: number;
  origem: "manual" | "lote";
  createdAt: string;
};

export type Dia = "seg" | "ter" | "qua" | "qui" | "sex" | "sab";
export type ItemPlano = { especialidade: string; dias: Partial<Record<Dia, number>>; total: number };

export type PlanoLido = {
  paciente: { nome: string | null; nascimento: string | null };
  cid: string | null;
  responsavel: { nome: string | null; cpf: string | null };
  medico: { nome: string | null; crm: string | null };
  dataSolicitacao: string | null;
  sessoesSemanais: number | null;
  itens: ItemPlano[];
  metodos: string[];
};

export type ResultadoDocumento = {
  arquivo: string;
  status: "vinculado" | "sem_paciente" | "duplicado" | "erro";
  tipo?: TipoDocumento;
  paciente?: Referencia;
  vinculoPor?: "cpf" | "carteirinha" | "nome_no_plano" | "escolhido";
  pedido?: { id: string; criado: boolean } | null;
  motivo?: string;
};
