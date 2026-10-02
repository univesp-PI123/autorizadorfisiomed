-- Lista "A solicitar": cada sessão aponta para o pedido gerado para ela, e o
-- pedido guarda a unidade (CNES) para a qual foi feito.
-- Valores em R$ saem do sistema: a análise da clínica é por número de
-- atendimentos, e os valores mudam caso a caso (liminares).

-- AlterTable
ALTER TABLE "agendamentos" DROP COLUMN "valorFaturamento",
ADD COLUMN     "autorizacaoId" UUID;

-- AlterTable
ALTER TABLE "atendimentos" DROP COLUMN "valorCobrado",
DROP COLUMN "valorPago";

-- AlterTable
ALTER TABLE "autorizacoes" ADD COLUMN     "unidadeId" UUID;

-- AlterTable
ALTER TABLE "procedimentos_operadora" DROP COLUMN "valor";

-- CreateIndex
CREATE INDEX "agendamentos_autorizacaoId_idx" ON "agendamentos"("autorizacaoId");

-- AddForeignKey
ALTER TABLE "autorizacoes" ADD CONSTRAINT "autorizacoes_unidadeId_fkey" FOREIGN KEY ("unidadeId") REFERENCES "unidades"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agendamentos" ADD CONSTRAINT "agendamentos_autorizacaoId_fkey" FOREIGN KEY ("autorizacaoId") REFERENCES "autorizacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

