-- Unidade de atendimento escolhida no sistema (a importação do AnClinic não troca).
ALTER TABLE "agendamentos" ADD COLUMN "unidadeManual" BOOLEAN NOT NULL DEFAULT false;
