import { z } from "zod";
import { ehDataISO, paraDate } from "@/lib/datas";
import { validadePadrao } from "@/lib/regras/pedidoMedico";
import { SIGLAS_CONSELHO, UFS } from "@/lib/tiss/dominios";

// Os formulários enviam "" em campos não preenchidos e números como texto.
// Estes auxiliares normalizam isso antes de validar.

const vazioParaNulo = (v: unknown) =>
  v === "" || (typeof v === "string" && v.trim() === "") ? null : v;

const texto = (max: number) => z.string().trim().max(max, `Máximo de ${max} caracteres.`);

const textoObrigatorio = (max: number, mensagem: string) =>
  texto(max).min(1, mensagem);

const textoOpcional = (max: number) =>
  z.preprocess(vazioParaNulo, texto(max).nullable().optional());

const data = (mensagem: string) =>
  z
    .string()
    .refine(ehDataISO, mensagem)
    .transform((v) => paraDate(v));

const dataOpcional = (mensagem: string) =>
  z.preprocess(vazioParaNulo, data(mensagem).nullable().optional());

const inteiro = (min: number, mensagem: string) =>
  z.coerce.number({ invalid_type_error: mensagem }).int(mensagem).min(min, mensagem);

const inteiroOpcional = (min: number, mensagem: string) =>
  z.preprocess(vazioParaNulo, inteiro(min, mensagem).nullable().optional());

const email = z.string().trim().toLowerCase().email("E-mail inválido.").max(255);
const emailOpcional = z.preprocess(vazioParaNulo, email.nullable().optional());
const uuid = (mensagem: string) => z.string().uuid(mensagem);
const uuidOpcional = (mensagem: string) =>
  z.preprocess(vazioParaNulo, uuid(mensagem).nullable().optional());

// --- Auth / usuários ----------------------------------------------------

const senhaNova = z.string().min(8, "A senha deve ter ao menos 8 caracteres.").max(128);

export const esquemaLogin = z.object({
  email,
  senha: z.string().min(1, "Senha é obrigatória.").max(128),
});

export const esquemaUsuarioNovo = z.object({
  nome: textoObrigatorio(150, "Nome é obrigatório."),
  email,
  senha: senhaNova,
});

export const esquemaUsuarioEdicao = z
  .object({
    nome: textoObrigatorio(150, "Nome é obrigatório."),
    email,
    ativo: z.boolean(),
  })
  .partial();

export const esquemaAlterarSenha = z.object({
  senhaAtual: z.string().min(1, "Senha atual é obrigatória."),
  novaSenha: senhaNova,
});

// --- Pacientes / convênios -------------------------------------------

export const esquemaPaciente = z.object({
  nome: texto(200).min(3, "Nome deve ter ao menos 3 caracteres."),
  dataNascimento: data("Data de nascimento inválida."),
  cpf: z.preprocess(
    vazioParaNulo,
    z
      .string()
      .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido. Use o formato 000.000.000-00.")
      .nullable()
      .optional(),
  ),
  responsavel: textoOpcional(200),
  telefone: textoOpcional(20),
  email: emailOpcional,
  endereco: textoOpcional(500),
  diagnostico: textoOpcional(2000),
  cid: textoOpcional(20),
  observacoes: textoOpcional(2000),
});

export const esquemaVinculo = z.object({
  convenioId: uuid("Selecione um convênio."),
  numeroCarteirinha: textoObrigatorio(100, "Número da carteirinha é obrigatório."),
  plano: textoOpcional(100),
  titular: textoOpcional(200),
  dataValidade: dataOpcional("Data de validade inválida."),
});

export const esquemaConvenio = z.object({
  nome: textoObrigatorio(200, "Nome do convênio é obrigatório."),
  codigoAns: textoOpcional(20),
  cnpj: textoOpcional(18),
  contatoNome: textoOpcional(150),
  contatoTelefone: textoOpcional(20),
  contatoEmail: emailOpcional,
  prazoAutorizacaoDias: inteiro(1, "Prazo deve ser um inteiro positivo.").default(30),
  alertaAntecipacaoDias: inteiro(1, "Alerta deve ser um inteiro positivo.").default(7),
  procedimentosCobertos: z.array(texto(200)).max(100).optional(),
  ativo: z.boolean().optional(),
  observacoes: textoOpcional(2000),
  integracao: z.enum(["manual", "tiss_amil"], { message: "Integração inválida." }).optional(),
  codigoPrestador: z.preprocess(
    vazioParaNulo,
    z.string().trim().regex(/^\d{1,20}$/, "Código do prestador: só números.").nullable().optional(),
  ),
  nomesAnclinic: z.array(texto(200).min(1)).max(20).optional(),
});

// --- Cadastros da integração (clínica, unidades, profissionais…) ------

const digitos = (n: number, mensagem: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\D/g, "") : v),
    z.string().length(n, mensagem),
  );
const digitosOpcional = (n: number, mensagem: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\D/g, "") || null : v),
    z.string().length(n, mensagem).nullable().optional(),
  );
const uf = (mensagem: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toUpperCase() || null : v),
    z.enum(UFS, { message: mensagem }).nullable().optional(),
  );
const conselho = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().toUpperCase() || null : v),
  z.enum(SIGLAS_CONSELHO as [string, ...string[]], { message: "Conselho inválido." }).nullable().optional(),
);
const numeroConselho = z.preprocess(
  vazioParaNulo,
  z.string().trim().regex(/^\d{1,15}$/, "Número do conselho: só números.").nullable().optional(),
);

export const esquemaClinica = z.object({
  razaoSocial: textoObrigatorio(200, "Razão social é obrigatória."),
  nomeFantasia: textoOpcional(200),
  cnpj: digitos(14, "CNPJ deve ter 14 dígitos."),
});

export const esquemaUnidade = z.object({
  nome: textoObrigatorio(150, "Nome é obrigatório."),
  cnes: digitosOpcional(7, "CNES deve ter 7 dígitos."),
  cep: digitosOpcional(8, "CEP deve ter 8 dígitos."),
  tipoLogradouro: textoOpcional(30),
  logradouro: textoOpcional(200),
  numero: textoOpcional(20),
  complemento: textoOpcional(100),
  bairro: textoOpcional(100),
  municipio: textoOpcional(100),
  uf: uf("UF inválida."),
  ativo: z.boolean().optional(),
});

export const esquemaProfissional = z.object({
  nome: textoObrigatorio(200, "Nome é obrigatório."),
  cns: digitosOpcional(15, "CNS deve ter 15 dígitos."),
  conselho,
  numeroConselho,
  ufConselho: uf("UF do conselho inválida."),
  cbo: digitosOpcional(6, "CBO deve ter 6 dígitos."),
  ativo: z.boolean().optional(),
  convenioIds: z.array(uuid("Convênio inválido.")).max(50).optional(),
});

const codigoTuss = z.preprocess(
  vazioParaNulo,
  z.string().trim().regex(/^\d{8,10}$/, "Código TUSS: 8 a 10 dígitos.").nullable().optional(),
);
const tabela = z.preprocess(
  vazioParaNulo,
  z.string().trim().regex(/^\d{2}$/, "Tabela: 2 dígitos (ex.: 22).").nullable().optional(),
);

export const esquemaProcedimento = z.object({
  descricao: textoObrigatorio(200, "Descrição é obrigatória."),
  codigoTuss,
  tabelaTuss: tabela,
  ativo: z.boolean().optional(),
  // Equivalente na tabela de uma operadora; código vazio desfaz a ligação.
  equivalencia: z
    .object({
      convenioId: uuid("Convênio inválido."),
      codigo: z.preprocess(
        vazioParaNulo,
        z.string().trim().regex(/^[\w.\-]{1,20}$/, "Código da operadora: até 20 letras ou números.").nullable().optional(),
      ),
      descricao: textoOpcional(300),
      tabela,
      codigoTuss,
  
    })
    .optional(),
});

// Chega por formulário multipart (junto com os PDFs): todos os campos em texto.
export const esquemaPedidoMedico = z
  .object({
    convenioId: uuidOpcional("Convênio inválido."),
    medicoNome: textoObrigatorio(200, "Nome do médico é obrigatório."),
    conselho: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toUpperCase() || "CRM" : v ?? "CRM"),
      z.enum(SIGLAS_CONSELHO as [string, ...string[]], { message: "Conselho inválido." }),
    ),
    numeroConselho: z.string().trim().regex(/^\d{1,15}$/, "Número do conselho: só números."),
    ufConselho: z.preprocess(
      (v) => (typeof v === "string" ? v.trim().toUpperCase() : v),
      z.enum(UFS, { message: "UF do conselho inválida." }),
    ),
    cbo: digitosOpcional(6, "CBO deve ter 6 dígitos."),
    cid: textoOpcional(20),
    indicacaoClinica: textoOpcional(2000),
    dataPedido: data("Data do pedido inválida."),
    validoAte: dataOpcional("Validade inválida."),
    observacoes: textoOpcional(2000),
  })
  .refine((d) => !d.validoAte || d.validoAte >= d.dataPedido, {
    message: "A validade não pode ser antes da data do pedido.",
    path: ["validoAte"],
  })
  // Sem validade informada, vale 1 ano.
  .transform((d) => ({ ...d, validoAte: d.validoAte ?? validadePadrao(d.dataPedido) }));

// --- Autorizações ------------------------------------------------------

const vigenciaValida = (d: { dataInicioVigencia?: Date | null; dataFimVigencia?: Date | null }) =>
  !d.dataInicioVigencia || !d.dataFimVigencia || d.dataFimVigencia >= d.dataInicioVigencia;
const erroVigencia = {
  message: "O fim da vigência não pode ser antes do início.",
  path: ["dataFimVigencia"],
};

const camposAutorizacao = z.object({
  pacienteId: uuid("Selecione um paciente."),
  convenioId: uuid("Selecione um convênio."),
  procedimento: textoObrigatorio(200, "Procedimento é obrigatório."),
  codigoProcedimento: textoOpcional(30),
  protocolo: textoOpcional(100),
  quantidadeSolicitada: inteiro(1, "Quantidade deve ser um inteiro positivo."),
  dataSolicitacao: dataOpcional("Data de solicitação inválida."),
  dataInicioVigencia: dataOpcional("Data de início de vigência inválida."),
  dataFimVigencia: dataOpcional("Data de fim de vigência inválida."),
  observacoes: textoOpcional(2000),
});

export const esquemaAutorizacao = camposAutorizacao.refine(vigenciaValida, erroVigencia);

// Na edição não se troca paciente/convênio nem status (status tem rota própria).
export const esquemaAutorizacaoEdicao = camposAutorizacao
  .omit({ pacienteId: true, convenioId: true })
  .extend({
    numeroAutorizacao: textoOpcional(100),
    // Coluna obrigatória: em branco significa "não alterar".
    dataSolicitacao: z.preprocess(
      (v) => (vazioParaNulo(v) === null ? undefined : v),
      data("Data de solicitação inválida.").optional(),
    ),
  })
  .partial()
  .refine(vigenciaValida, erroVigencia);

export const STATUS_AUTORIZACAO = [
  "pendente",
  "em_analise",
  "autorizada",
  "negada",
  "vencida",
  "cancelada",
  "esgotada",
] as const;

export const esquemaMudancaStatus = z.object({
  status: z.enum(STATUS_AUTORIZACAO, { message: "Status inválido." }),
  numeroAutorizacao: textoOpcional(100),
  quantidadeAutorizada: inteiroOpcional(1, "Quantidade autorizada deve ser um inteiro positivo."),
  motivoNegativa: textoOpcional(2000),
  dataResposta: dataOpcional("Data de resposta inválida."),
  observacao: textoOpcional(2000),
});

/** Lê e valida o corpo JSON da requisição. */
export async function lerCorpo<T extends z.ZodTypeAny>(
  req: Request,
  esquema: T,
): Promise<z.output<T>> {
  return esquema.parse(await req.json());
}
