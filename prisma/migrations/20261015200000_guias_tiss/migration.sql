-- CreateTable
CREATE TABLE "guias_tiss" (
    "id" UUID NOT NULL,
    "numero" SERIAL NOT NULL,
    "convenioId" UUID NOT NULL,
    "pacienteId" UUID NOT NULL,
    "pedidoId" UUID,
    "agendamentoIds" UUID[],
    "codigoProcedimento" VARCHAR(10) NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "versaoTiss" VARCHAR(8) NOT NULL,
    "xml" TEXT NOT NULL,
    "hash" VARCHAR(32) NOT NULL,
    "usuarioId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guias_tiss_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guias_tiss_numero_key" ON "guias_tiss"("numero");

-- CreateIndex
CREATE INDEX "guias_tiss_pacienteId_idx" ON "guias_tiss"("pacienteId");

-- CreateIndex
CREATE INDEX "guias_tiss_createdAt_idx" ON "guias_tiss"("createdAt");

-- AddForeignKey
ALTER TABLE "guias_tiss" ADD CONSTRAINT "guias_tiss_convenioId_fkey" FOREIGN KEY ("convenioId") REFERENCES "convenios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_tiss" ADD CONSTRAINT "guias_tiss_pacienteId_fkey" FOREIGN KEY ("pacienteId") REFERENCES "pacientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_tiss" ADD CONSTRAINT "guias_tiss_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "pedidos_medicos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guias_tiss" ADD CONSTRAINT "guias_tiss_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

