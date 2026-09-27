-- CreateEnum
CREATE TYPE "TipoIntegracao" AS ENUM ('manual', 'tiss_amil');

-- CreateEnum
CREATE TYPE "TipoImportacao" AS ENUM ('agenda', 'profissionais');

-- AlterTable
ALTER TABLE "convenios" ADD COLUMN     "codigoPrestador" VARCHAR(20),
ADD COLUMN     "integracao" "TipoIntegracao" NOT NULL DEFAULT 'manual',
ADD COLUMN     "nomesAnclinic" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "pacientes" ALTER COLUMN "dataNascimento" DROP NOT NULL;

-- CreateTable
CREATE TABLE "clinica" (
    "id" UUID NOT NULL,
    "razaoSocial" VARCHAR(200) NOT NULL,
    "nomeFantasia" VARCHAR(200),
    "cnpj" VARCHAR(18) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidades" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "nomeAnclinic" VARCHAR(200) NOT NULL,
    "cnes" VARCHAR(7),
    "cep" VARCHAR(9),
    "tipoLogradouro" VARCHAR(30),
    "logradouro" VARCHAR(200),
    "numero" VARCHAR(20),
    "complemento" VARCHAR(100),
    "bairro" VARCHAR(100),
    "municipio" VARCHAR(100),
    "uf" VARCHAR(2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissionais" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "cpf" VARCHAR(11) NOT NULL,
    "cns" VARCHAR(15),
    "conselho" VARCHAR(10),
    "numeroConselho" VARCHAR(15),
    "ufConselho" VARCHAR(2),
    "cbo" VARCHAR(6),
    "especialidades" VARCHAR(300),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profissionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profissional_convenios" (
    "profissionalId" UUID NOT NULL,
    "convenioId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profissional_convenios_pkey" PRIMARY KEY ("profissionalId","convenioId")
);

-- CreateTable
CREATE TABLE "procedimentos" (
    "id" UUID NOT NULL,
    "codigoAnclinic" VARCHAR(20) NOT NULL,
    "descricao" VARCHAR(200) NOT NULL,
    "codigoTuss" VARCHAR(10),
    "tabelaTuss" VARCHAR(2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agendamentos" (
    "id" UUID NOT NULL,
    "idAnclinic" VARCHAR(20) NOT NULL,
    "data" DATE NOT NULL,
    "horaInicio" VARCHAR(5),
    "horaFim" VARCHAR(5),
    "pacienteId" UUID,
    "profissionalId" UUID,
    "convenioId" UUID,
    "procedimentoId" UUID,
    "unidadeId" UUID,
    "pacienteAnclinic" VARCHAR(200),
    "convenioAnclinic" VARCHAR(200),
    "carteirinha" VARCHAR(100),
    "statusAnclinic" VARCHAR(60),
    "statusFaturamento" VARCHAR(60),
    "senhaAutorizacao" VARCHAR(40),
    "senhaExecucao" VARCHAR(40),
    "agendamentosRestantes" INTEGER,
    "valorFaturamento" DECIMAL(10,2),
    "agenda" VARCHAR(200),
    "sala" VARCHAR(200),
    "removidoEm" TIMESTAMP(3),
    "importacaoId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agendamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacoes" (
    "id" UUID NOT NULL,
    "tipo" "TipoImportacao" NOT NULL,
    "arquivoNome" VARCHAR(255) NOT NULL,
    "usuarioId" UUID,
    "linhas" INTEGER NOT NULL DEFAULT 0,
    "criados" INTEGER NOT NULL DEFAULT 0,
    "atualizados" INTEGER NOT NULL DEFAULT 0,
    "ignorados" INTEGER NOT NULL DEFAULT 0,
    "resumo" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "importacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos_medicos" (
    "id" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "convenioId" UUID,
    "medicoNome" VARCHAR(200) NOT NULL,
    "conselho" VARCHAR(10) NOT NULL DEFAULT 'CRM',
    "numeroConselho" VARCHAR(15) NOT NULL,
    "ufConselho" VARCHAR(2) NOT NULL,
    "cbo" VARCHAR(6),
    "cid" VARCHAR(20),
    "indicacaoClinica" TEXT,
    "dataPedido" DATE NOT NULL,
    "validoAte" DATE,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "observacoes" TEXT,
    "usuarioId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pedidos_medicos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arquivos_pedido" (
    "id" UUID NOT NULL,
    "pedidoId" UUID NOT NULL,
    "nomeOriginal" VARCHAR(255) NOT NULL,
    "caminho" VARCHAR(255) NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_pedido_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "unidades_nomeAnclinic_key" ON "unidades"("nomeAnclinic");

-- CreateIndex
CREATE UNIQUE INDEX "profissionais_cpf_key" ON "profissionais"("cpf");

-- CreateIndex
CREATE INDEX "profissionais_nome_idx" ON "profissionais"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "procedimentos_codigoAnclinic_key" ON "procedimentos"("codigoAnclinic");

-- CreateIndex
CREATE UNIQUE INDEX "agendamentos_idAnclinic_key" ON "agendamentos"("idAnclinic");

-- CreateIndex
CREATE INDEX "agendamentos_data_idx" ON "agendamentos"("data");

-- CreateIndex
CREATE INDEX "agendamentos_pacienteId_idx" ON "agendamentos"("pacienteId");

-- CreateIndex
CREATE INDEX "importacoes_createdAt_idx" ON "importacoes"("createdAt");

-- CreateIndex
CREATE INDEX "pedidos_medicos_pacienteId_idx" ON "pedidos_medicos"("pacienteId");

-- CreateIndex
CREATE INDEX "arquivos_pedido_pedidoId_idx" ON "arquivos_pedido"("pedidoId");

-- AddForeignKey
ALTER TABLE "profissional_convenios" ADD CONSTRAINT "profissional_convenios_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profissional_convenios" ADD CONSTRAINT "profissional_convenios_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "procedimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "importacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacoes" ADD CONSTRAINT "importacoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_medicos" ADD CONSTRAINT "pedidos_medicos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_medicos" ADD CONSTRAINT "pedidos_medicos_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos_medicos" ADD CONSTRAINT "pedidos_medicos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos_pedido" ADD CONSTRAINT "arquivos_pedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos_medicos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

