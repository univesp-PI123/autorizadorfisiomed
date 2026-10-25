-- AlterTable
ALTER TABLE "guias_tiss" ADD COLUMN     "enviadaEm" TIMESTAMP(3),
ADD COLUMN     "statusOperadora" VARCHAR(1),
ADD COLUMN     "numeroGuiaOperadora" VARCHAR(20),
ADD COLUMN     "senhaOperadora" VARCHAR(20),
ADD COLUMN     "validadeSenha" DATE,
ADD COLUMN     "glosas" TEXT[],
ADD COLUMN     "erroEnvio" TEXT,
ADD COLUMN     "respostaXml" TEXT;
