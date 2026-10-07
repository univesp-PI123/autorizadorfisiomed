/*
  Warnings:

  - You are about to drop the column `valorFaturamento` on the `agendamentos` table. All the data in the column will be lost.
  - You are about to drop the column `valorCobrado` on the `atendimentos` table. All the data in the column will be lost.
  - You are about to drop the column `valorPago` on the `atendimentos` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "agendamentos" DROP COLUMN "valorFaturamento";

-- AlterTable
ALTER TABLE "atendimentos" DROP COLUMN "valorCobrado",
DROP COLUMN "valorPago";
