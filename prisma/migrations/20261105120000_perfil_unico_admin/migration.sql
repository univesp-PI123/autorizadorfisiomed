-- O sistema passa a ter um perfil só: administrador. O foco é solicitar
-- autorizações, e os perfis Recepção, Terapeuta e Financeiro não fazem
-- mais sentido (pedido do grupo em 03/11/2026). Quem tinha esses perfis vira
-- administrador; ninguém perde o acesso.
UPDATE "usuarios" SET "perfil" = 'admin' WHERE "perfil" <> 'admin';

ALTER TABLE "usuarios" ALTER COLUMN "perfil" DROP DEFAULT;
ALTER TYPE "PerfilUsuario" RENAME TO "PerfilUsuario_antigo";
CREATE TYPE "PerfilUsuario" AS ENUM ('admin');
ALTER TABLE "usuarios"
  ALTER COLUMN "perfil" TYPE "PerfilUsuario" USING "perfil"::text::"PerfilUsuario";
ALTER TABLE "usuarios" ALTER COLUMN "perfil" SET DEFAULT 'admin';
DROP TYPE "PerfilUsuario_antigo";
