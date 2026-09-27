-- Substitui o modelo da Fase 1 pelo modelo do sistema integrado.
--
-- ATENÇÃO: remove as tabelas antigas (Usuario, Paciente, Convenio, Autorizacao,
-- HistoricoStatus, Agendamento, Alerta). Na Fase 1 elas ainda não eram usadas
-- por nenhuma tela, então devem estar vazias.

-- DropTable (modelo da Fase 1)
DROP TABLE IF EXISTS "Agendamento" CASCADE;
DROP TABLE IF EXISTS "Alerta" CASCADE;
DROP TABLE IF EXISTS "HistoricoStatus" CASCADE;
DROP TABLE IF EXISTS "Autorizacao" CASCADE;
DROP TABLE IF EXISTS "Paciente" CASCADE;
DROP TABLE IF EXISTS "Convenio" CASCADE;
DROP TABLE IF EXISTS "Usuario" CASCADE;

-- DropEnum (modelo da Fase 1)
DROP TYPE IF EXISTS "SituacaoAlerta";
DROP TYPE IF EXISTS "TipoAlerta";
DROP TYPE IF EXISTS "StatusAutorizacao";
DROP TYPE IF EXISTS "PerfilUsuario";

-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('admin', 'recepcionista', 'terapeuta', 'financeiro');

-- CreateEnum
CREATE TYPE "StatusAutorizacao" AS ENUM ('pendente', 'em_analise', 'autorizada', 'negada', 'vencida', 'cancelada', 'esgotada');

-- CreateEnum
CREATE TYPE "StatusCobranca" AS ENUM ('pendente', 'faturado', 'pago', 'glosado', 'cancelado');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'recepcionista',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcesso" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacientes" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "dataNascimento" DATE NOT NULL,
    "cpf" VARCHAR(14),
    "responsavel" VARCHAR(200),
    "telefone" VARCHAR(20),
    "email" VARCHAR(255),
    "endereco" TEXT,
    "diagnostico" TEXT,
    "cid" VARCHAR(20),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pacientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "convenios" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "codigoAns" VARCHAR(20),
    "cnpj" VARCHAR(18),
    "contatoNome" VARCHAR(150),
    "contatoTelefone" VARCHAR(20),
    "contatoEmail" VARCHAR(255),
    "prazoAutorizacaoDias" INTEGER NOT NULL DEFAULT 30,
    "alertaAntecipacaoDias" INTEGER NOT NULL DEFAULT 7,
    "procedimentosCobertos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "convenios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente_convenios" (
    "id" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "convenioId" UUID NOT NULL,
    "numeroCarteirinha" VARCHAR(100) NOT NULL,
    "plano" VARCHAR(100),
    "titular" VARCHAR(200),
    "dataValidade" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paciente_convenios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autorizacoes" (
    "id" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "convenioId" UUID NOT NULL,
    "pacienteConvenioId" UUID,
    "numeroAutorizacao" VARCHAR(100),
    "protocolo" VARCHAR(100),
    "procedimento" VARCHAR(200) NOT NULL,
    "codigoProcedimento" VARCHAR(30),
    "quantidadeSolicitada" INTEGER NOT NULL DEFAULT 1,
    "quantidadeAutorizada" INTEGER,
    "quantidadeUtilizada" INTEGER NOT NULL DEFAULT 0,
    "dataInicioVigencia" DATE,
    "dataFimVigencia" DATE,
    "dataSolicitacao" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataResposta" DATE,
    "status" "StatusAutorizacao" NOT NULL DEFAULT 'pendente',
    "motivoNegativa" TEXT,
    "usuarioCriouId" UUID,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autorizacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "historico_status" (
    "id" UUID NOT NULL,
    "autorizacaoId" UUID NOT NULL,
    "statusAnterior" "StatusAutorizacao",
    "statusNovo" "StatusAutorizacao" NOT NULL,
    "observacao" TEXT,
    "usuarioId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historico_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atendimentos" (
    "id" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "autorizacaoId" UUID,
    "terapeutaId" UUID,
    "dataAtendimento" DATE NOT NULL,
    "horaInicio" VARCHAR(5),
    "horaFim" VARCHAR(5),
    "procedimento" VARCHAR(200) NOT NULL,
    "codigoProcedimento" VARCHAR(30),
    "statusCobranca" "StatusCobranca" NOT NULL DEFAULT 'pendente',
    "valorCobrado" DECIMAL(10,2),
    "valorPago" DECIMAL(10,2),
    "motivoGlosa" TEXT,
    "semAutorizacao" BOOLEAN NOT NULL DEFAULT false,
    "evolucao" TEXT,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "atendimentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "pacientes_cpf_key" ON "pacientes"("cpf");

-- CreateIndex
CREATE INDEX "pacientes_nome_idx" ON "pacientes"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "convenios_nome_key" ON "convenios"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_convenios_pacienteId_convenioId_key" ON "paciente_convenios"("pacienteId", "convenioId");

-- CreateIndex
CREATE INDEX "autorizacoes_status_idx" ON "autorizacoes"("status");

-- CreateIndex
CREATE INDEX "autorizacoes_dataFimVigencia_idx" ON "autorizacoes"("dataFimVigencia");

-- CreateIndex
CREATE INDEX "autorizacoes_pacienteId_idx" ON "autorizacoes"("pacienteId");

-- CreateIndex
CREATE INDEX "historico_status_autorizacaoId_idx" ON "historico_status"("autorizacaoId");

-- CreateIndex
CREATE INDEX "atendimentos_dataAtendimento_idx" ON "atendimentos"("dataAtendimento");

-- CreateIndex
CREATE INDEX "atendimentos_statusCobranca_idx" ON "atendimentos"("statusCobranca");

-- AddForeignKey
ALTER TABLE "paciente_convenios" ADD CONSTRAINT "paciente_convenios_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente_convenios" ADD CONSTRAINT "paciente_convenios_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autorizacoes" ADD CONSTRAINT "autorizacoes_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autorizacoes" ADD CONSTRAINT "autorizacoes_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autorizacoes" ADD CONSTRAINT "autorizacoes_pacienteConvenioId_fkey" FOREIGN KEY ("pacienteConvenioId") REFERENCES "paciente_convenios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autorizacoes" ADD CONSTRAINT "autorizacoes_usuarioCriouId_fkey" FOREIGN KEY ("usuarioCriouId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_status" ADD CONSTRAINT "historico_status_autorizacaoId_fkey" FOREIGN KEY ("autorizacaoId") REFERENCES "autorizacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "historico_status" ADD CONSTRAINT "historico_status_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_autorizacaoId_fkey" FOREIGN KEY ("autorizacaoId") REFERENCES "autorizacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_terapeutaId_fkey" FOREIGN KEY ("terapeutaId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

