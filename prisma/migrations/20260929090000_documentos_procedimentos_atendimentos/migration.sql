-- Documentos, de/para de procedimentos e confirmação de atendimentos.
-- Os PDFs de arquivos_pedido passam para documentos (mesmos ids e caminhos
-- em disco) antes de a tabela antiga ser removida.

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('pedido_medico', 'plano_terapeutico', 'relatorio', 'outro');

-- CreateEnum
CREATE TYPE "SituacaoAtendimento" AS ENUM ('aguardando_confirmacao', 'confirmado', 'cancelado');

-- AlterEnum

ALTER TYPE "TipoImportacao" ADD VALUE 'documentos';
ALTER TYPE "TipoImportacao" ADD VALUE 'tabela_operadora';
ALTER TYPE "TipoImportacao" ADD VALUE 'tuss';

-- AlterTable
ALTER TABLE "atendimentos" ADD COLUMN     "agendamentoId" UUID,
ADD COLUMN     "confirmadoEm" TIMESTAMP(3),
ADD COLUMN     "confirmadoPorId" UUID,
ADD COLUMN     "motivoCancelamento" TEXT,
ADD COLUMN     "procedimentoId" UUID,
ADD COLUMN     "profissionalId" UUID,
ADD COLUMN     "situacao" "SituacaoAtendimento" NOT NULL DEFAULT 'confirmado';

-- AlterTable
ALTER TABLE "pedidos_medicos" ADD COLUMN     "planoItens" JSONB,
ADD COLUMN     "sessoesSemanais" INTEGER;

-- CreateTable
CREATE TABLE "documentos" (
    "id" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "pedidoId" UUID,
    "tipo" "TipoDocumento" NOT NULL,
    "nomeOriginal" VARCHAR(255) NOT NULL,
    "caminho" VARCHAR(255) NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "dados" JSONB,
    "origem" VARCHAR(10) NOT NULL DEFAULT 'manual',
    "usuarioId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tuss_procedimentos" (
    "codigo" VARCHAR(10) NOT NULL,
    "termo" VARCHAR(500) NOT NULL,

    CONSTRAINT "tuss_procedimentos_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "procedimentos_operadora" (
    "id" UUID NOT NULL,
    "convenioId" UUID NOT NULL,
    "procedimentoId" UUID,
    "codigo" VARCHAR(20) NOT NULL,
    "descricao" VARCHAR(300) NOT NULL,
    "tabela" VARCHAR(2) NOT NULL DEFAULT '22',
    "codigoTuss" VARCHAR(10),
    "valor" DECIMAL(10,2),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedimentos_operadora_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_pedidoId_idx" ON "documentos"("pedidoId");

-- CreateIndex
CREATE UNIQUE INDEX "documentos_pacienteId_sha256_key" ON "documentos"("pacienteId", "sha256");

-- CreateIndex
CREATE UNIQUE INDEX "procedimentos_operadora_convenioId_codigo_key" ON "procedimentos_operadora"("convenioId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "procedimentos_operadora_convenioId_procedimentoId_key" ON "procedimentos_operadora"("convenioId", "procedimentoId");

-- CreateIndex
CREATE UNIQUE INDEX "atendimentos_agendamentoId_key" ON "atendimentos"("agendamentoId");

-- CreateIndex
CREATE INDEX "atendimentos_situacao_idx" ON "atendimentos"("situacao");

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_confirmadoPorId_fkey" FOREIGN KEY ("confirmadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "agendamentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "profissionais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimentos" ADD CONSTRAINT "atendimentos_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "procedimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos_medicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedimentos_operadora" ADD CONSTRAINT "procedimentos_operadora_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedimentos_operadora" ADD CONSTRAINT "procedimentos_operadora_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "procedimentos"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Copia os PDFs já anexados aos pedidos médicos.
INSERT INTO "documentos" ("id", "pacienteId", "pedidoId", "tipo", "nomeOriginal", "caminho", "tamanho", "sha256", "origem", "usuarioId", "createdAt")
SELECT a."id", p."pacienteId", a."pedidoId", 'pedido_medico', a."nomeOriginal", a."caminho", a."tamanho", a."sha256", 'manual', p."usuarioId", a."createdAt"
  FROM "arquivos_pedido" a
  JOIN "pedidos_medicos" p ON p."id" = a."pedidoId"
ON CONFLICT ("pacienteId", "sha256") DO NOTHING;

DROP TABLE "arquivos_pedido";
