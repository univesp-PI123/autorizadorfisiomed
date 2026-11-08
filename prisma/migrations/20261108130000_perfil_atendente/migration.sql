-- Perfil Atendente: faz o trabalho do dia (solicitações, autorizações,
-- pacientes, importação da agenda e dos documentos, relatórios) e consulta os
-- cadastros. Editar cadastros, gerenciar usuários e baixar os XMLs trocados
-- com a operadora ficam com o administrador. Quem já existe continua admin.
ALTER TYPE "PerfilUsuario" ADD VALUE 'atendente';
