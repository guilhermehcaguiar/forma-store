-- FORMA · migração 0002 — papéis de acesso
-- Adiciona o papel de cada conta (RF de administração / RNF08): toda conta nova
-- nasce "cliente"; "administrador" só é concedido pelo comando local
-- `npm run admin` (server/src/scripts/criar-admin.js). Nenhuma rota pública
-- aceita ou altera o papel: privilégios nunca vêm do cliente.

ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'cliente';

ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('cliente', 'administrador'));
