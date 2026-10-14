-- FORMA · migração 0001 — bloco de conta
-- Cria as tabelas de usuários, sessões, endereços e listas de compras
-- (RF01–RF05 e RF20). O bloco de catálogo/pedidos virá em migrações futuras
-- (0002_catalogo.sql e seguintes), seguindo o padrão de docs/forma/API_CONTRATOS.md.

CREATE TABLE users (
  id            uuid        PRIMARY KEY,
  name          text        NOT NULL,
  email         text        NOT NULL,
  password_hash text        NOT NULL, -- formato "scrypt:<salt>:<chave>"; nunca senha em texto puro
  promo         boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- E-mail único ignorando maiúsculas/minúsculas.
CREATE UNIQUE INDEX users_email_unique_idx ON users (lower(email));

CREATE TABLE sessions (
  token_hash text        PRIMARY KEY, -- SHA-256 do token; o token em si não é armazenado
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE addresses (
  id         uuid        PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  label      text        NOT NULL,
  recipient  text        NOT NULL,
  street     text        NOT NULL,
  number     text        NOT NULL,
  complement text        NOT NULL DEFAULT '',
  district   text        NOT NULL,
  city       text        NOT NULL,
  state      text        NOT NULL, -- UF com 2 letras
  cep        text        NOT NULL, -- 8 dígitos, sem hífen
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX addresses_user_idx ON addresses (user_id);

CREATE TABLE lists (
  id         uuid        PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Nome de lista único por conta, ignorando maiúsculas/minúsculas.
-- Os itens de cada lista (produtos) serão uma tabela própria na migração do
-- bloco de catálogo; por isso não há coluna de produtos aqui.
CREATE UNIQUE INDEX lists_user_name_unique_idx ON lists (user_id, lower(name));
