import { z } from "zod";
import { ehDataISO, paraDate } from "@/lib/datas";

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

const dinheiroOpcional = z.preprocess(
  vazioParaNulo,
  z.coerce
    .number({ invalid_type_error: "Valor inválido." })
    .min(0, "Valor inválido.")
    .max(99_999_999.99, "Valor alto demais.")
    .nullable()
    .optional(),
);

const email = z.string().trim().toLowerCase().email("E-mail inválido.").max(255);
const emailOpcional = z.preprocess(vazioParaNulo, email.nullable().optional());
const uuid = (mensagem: string) => z.string().uuid(mensagem);
const uuidOpcional = (mensagem: string) =>
  z.preprocess(vazioParaNulo, uuid(mensagem).nullable().optional());
const hora = z.preprocess(
  vazioParaNulo,
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (use HH:MM).")
    .nullable()
    .optional(),
);

// --- Auth / usuários ----------------------------------------------------

export const PERFIS = ["admin", "recepcionista", "terapeuta", "financeiro"] as const;
const senhaNova = z.string().min(8, "A senha deve ter ao menos 8 caracteres.").max(128);

export const esquemaLogin = z.object({
  email,
  senha: z.string().min(1, "Senha é obrigatória.").max(128),
});

export const esquemaUsuarioNovo = z.object({
  nome: textoObrigatorio(150, "Nome é obrigatório."),
  email,
  senha: senhaNova,
  perfil: z.enum(PERFIS, { message: "Perfil inválido." }),
});

export const esquemaUsuarioEdicao = z
  .object({
    nome: textoObrigatorio(150, "Nome é obrigatório."),
    email,
    perfil: z.enum(PERFIS, { message: "Perfil inválido." }),
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
});

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

// --- Atendimentos ------------------------------------------------------

export const STATUS_COBRANCA = ["pendente", "faturado", "pago", "glosado", "cancelado"] as const;

export const esquemaAtendimento = z.object({
  pacienteId: uuid("Selecione um paciente."),
  autorizacaoId: uuidOpcional("Autorização inválida."),
  terapeutaId: uuidOpcional("Terapeuta inválido."),
  procedimento: textoObrigatorio(200, "Procedimento é obrigatório."),
  codigoProcedimento: textoOpcional(30),
  dataAtendimento: data("Data do atendimento inválida."),
  horaInicio: hora,
  horaFim: hora,
  valorCobrado: dinheiroOpcional,
  evolucao: textoOpcional(5000),
  observacoes: textoOpcional(2000),
});

// Paciente e autorização não mudam depois de registrado: isso alteraria a
// contagem de sessões usadas.
export const esquemaAtendimentoEdicao = z
  .object({
    procedimento: textoObrigatorio(200, "Procedimento é obrigatório."),
    codigoProcedimento: textoOpcional(30),
    dataAtendimento: data("Data do atendimento inválida."),
    horaInicio: hora,
    horaFim: hora,
    statusCobranca: z.enum(STATUS_COBRANCA, { message: "Status de cobrança inválido." }),
    valorCobrado: dinheiroOpcional,
    valorPago: dinheiroOpcional,
    motivoGlosa: textoOpcional(2000),
    evolucao: textoOpcional(5000),
    observacoes: textoOpcional(2000),
  })
  .partial();

/** Lê e valida o corpo JSON da requisição. */
export async function lerCorpo<T extends z.ZodTypeAny>(
  req: Request,
  esquema: T,
): Promise<z.output<T>> {
  return esquema.parse(await req.json());
}
