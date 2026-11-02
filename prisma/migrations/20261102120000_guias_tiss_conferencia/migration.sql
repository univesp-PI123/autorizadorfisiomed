-- AlterTable
ALTER TABLE "guias_tiss" ADD COLUMN     "dataSessao" DATE,
ADD COLUMN     "conferir" TEXT;

-- Guias já geradas: o dia da sessão é o do agendamento hoje (uma sessão por guia).
UPDATE "guias_tiss" g SET "dataSessao" = a."data"
FROM "agendamentos" a
WHERE a."id" = g."agendamentoIds"[1];
