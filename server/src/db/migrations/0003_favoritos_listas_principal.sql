-- FORMA · migração 0003 — recursos de conta: favoritos, itens de lista e
-- endereço principal.
--
-- Favoritos e itens de lista guardam o produto pelo contrato combinado para o
-- bloco de catálogo (docs/forma/API_CONTRATOS.md): identificador UUID. A tabela
-- `products` pertence à migração do próprio catálogo (responsabilidade de outro
-- bloco), por isso aqui NÃO há chave estrangeira para produtos — apenas o
-- vínculo por id, com exclusão em cascata pelas tabelas de conta.

-- Endereço principal: exatamente um por conta quando houver endereços.
ALTER TABLE addresses ADD COLUMN principal boolean NOT NULL DEFAULT false;

-- Contas que já tinham endereços passam a ter o mais antigo como principal.
UPDATE addresses a
   SET principal = true
 WHERE a.created_at = (
   SELECT min(b.created_at) FROM addresses b WHERE b.user_id = a.user_id
 );

-- Favoritos por conta (RF19). Um produto aparece uma única vez na lista.
CREATE TABLE favorites (
  user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  product_id uuid        NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX favorites_user_idx ON favorites (user_id);

-- Itens de cada lista de compras (RF20). Um produto aparece uma única vez
-- por lista; a lista inteira é removida junto com a lista (CASCADE).
CREATE TABLE list_items (
  list_id    uuid        NOT NULL REFERENCES lists (id) ON DELETE CASCADE,
  product_id uuid        NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, product_id)
);

CREATE INDEX list_items_list_idx ON list_items (list_id);
