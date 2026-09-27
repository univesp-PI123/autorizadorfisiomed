import { PrismaClient } from "@prisma/client";

// Em desenvolvimento, o Next.js recarrega módulos a cada mudança de arquivo.
// Sem isso, cada reload criaria uma nova conexão com o banco até esgotar o limite.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
