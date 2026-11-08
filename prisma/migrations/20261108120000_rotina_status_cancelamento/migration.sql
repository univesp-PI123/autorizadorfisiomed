-- Rotina automática: elegibilidade antecipada da carteirinha, consulta do
-- status das guias em análise e cancelamento da guia na operadora.

-- AlterTable
ALTER TABLE "guias_tiss" ADD COLUMN     "consultasStatus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "proximaConsultaEm" TIMESTAMP(3),
ADD COLUMN     "canceladaEm" TIMESTAMP(3),
ADD COLUMN     "motivoCancelamento" TEXT,
ADD COLUMN     "erroCancelamento" TEXT;

-- AlterTable
ALTER TABLE "paciente_convenios" ADD COLUMN     "elegivel" BOOLEAN,
ADD COLUMN     "elegibilidadeEm" TIMESTAMP(3),
ADD COLUMN     "elegibilidadeMotivo" TEXT;

-- Guias em análise já enviadas: a rotina consulta o status na primeira rodada.
UPDATE "guias_tiss" SET "proximaConsultaEm" = CURRENT_TIMESTAMP
WHERE "enviadaEm" IS NOT NULL AND "statusOperadora" IN ('2', '4', '5');
