-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('RECEPCAO', 'AUTORIZADOR', 'GESTOR');

-- CreateEnum
CREATE TYPE "StatusAutorizacao" AS ENUM ('RASCUNHO', 'SOLICITADA', 'EM_ANALISE', 'AUTORIZADA', 'NEGADA', 'PARCIAL', 'VENCIDA', 'ESGOTADA');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('VENCIMENTO', 'SALDO_BAIXO', 'SEM_AUTORIZACAO');

-- CreateEnum
CREATE TYPE "SituacaoAlerta" AS ENUM ('PENDENTE', 'VISUALIZADO', 'RESOLVIDO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Paciente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "dataNascimento" TIMESTAMP(3) NOT NULL,
    "carteirinha" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Convenio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "adapterConfig" TEXT NOT NULL,

    CONSTRAINT "Convenio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Autorizacao" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "convenioId" TEXT NOT NULL,
    "numeroGuia" TEXT,
    "codigoProcedimento" TEXT NOT NULL,
    "valorProcedimento" DECIMAL(10,2) NOT NULL,
    "sessoesAutorizadas" INTEGER NOT NULL DEFAULT 0,
    "sessoesUtilizadas" INTEGER NOT NULL DEFAULT 0,
    "validade" TIMESTAMP(3),
    "status" "StatusAutorizacao" NOT NULL DEFAULT 'RASCUNHO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Autorizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoStatus" (
    "id" TEXT NOT NULL,
    "autorizacaoId" TEXT NOT NULL,
    "statusAnterior" "StatusAutorizacao",
    "statusNovo" "StatusAutorizacao" NOT NULL,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" TEXT NOT NULL,
    "pacienteId" TEXT NOT NULL,
    "autorizacaoId" TEXT,
    "dataHora" TIMESTAMP(3) NOT NULL,
    "realizado" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "situacao" "SituacaoAlerta" NOT NULL DEFAULT 'PENDENTE',
    "destinatarioId" TEXT NOT NULL,
    "autorizacaoId" TEXT,
    "mensagem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Autorizacao_status_idx" ON "Autorizacao"("status");

-- CreateIndex
CREATE INDEX "Autorizacao_validade_idx" ON "Autorizacao"("validade");

-- AddForeignKey
ALTER TABLE "Paciente" ADD CONSTRAINT "Paciente_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "Convenio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autorizacao" ADD CONSTRAINT "Autorizacao_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Autorizacao" ADD CONSTRAINT "Autorizacao_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "Convenio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoStatus" ADD CONSTRAINT "HistoricoStatus_autorizacaoId_fkey" FOREIGN KEY ("autorizacaoId") REFERENCES "Autorizacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "Paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_autorizacaoId_fkey" FOREIGN KEY ("autorizacaoId") REFERENCES "Autorizacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_destinatarioId_fkey" FOREIGN KEY ("destinatarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alerta" ADD CONSTRAINT "Alerta_autorizacaoId_fkey" FOREIGN KEY ("autorizacaoId") REFERENCES "Autorizacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
