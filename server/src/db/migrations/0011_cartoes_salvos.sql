-- RF06 (etapa 1 — opção B aprovada): modelo de dados de cartões salvos.
--
-- A FORMA NUNCA armazena número completo (PAN), CVV ou token temporário.
-- O cartão vive no Mercado Pago (Customers & Cards); aqui ficam apenas o
-- identificador do cliente do provedor, o identificador de cada cartão e os
-- metadados seguros devolvidos pela própria API do provedor, necessários à
-- exibição (marca, quatro últimos dígitos, titular, validade).
--
-- Fluxo compatível comprovado com o SDK mercadopago 3.6.1 (Customers &
-- Cards + Payment.create) e com a documentação oficial: o token de pagamento
-- é one-shot, gerado no client (Payment Brick com customerId/cardsIds), e
-- nunca é persistido.

-- Cliente do Mercado Pago: 1:1 com o usuário da FORMA. O mp_customer_id é
-- criado uma única vez por conta e reaproveitado por todos os cartões.
CREATE TABLE payment_customers (
  id             uuid        PRIMARY KEY,
  user_id        uuid        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  mp_customer_id text        NOT NULL UNIQUE,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Cartões salvos: múltiplos por cliente; isolamento por usuário sempre via
-- payment_customers (não há user_id redundante aqui, para não existir a
-- possibilidade de um cartão "apontar" para cliente de outra conta).
CREATE TABLE payment_cards (
  id                  uuid        PRIMARY KEY,
  payment_customer_id uuid        NOT NULL REFERENCES payment_customers (id) ON DELETE CASCADE,
  mp_card_id          text        NOT NULL,
  payment_method_id   text        NOT NULL,
  last_four_digits    text        NOT NULL CHECK (last_four_digits ~ '^[0-9]{4}$'),
  cardholder_name     text        NOT NULL DEFAULT '',
  expiration_month    integer     NOT NULL CHECK (expiration_month BETWEEN 1 AND 12),
  expiration_year     integer     NOT NULL CHECK (expiration_year BETWEEN 2000 AND 2100),
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_customer_id, mp_card_id)
);

CREATE INDEX payment_cards_customer_idx
  ON payment_cards (payment_customer_id, created_at DESC);

-- Dois tipos de tentativa de pagamento coexistem:
--   checkout_pro — preferência com URL de checkout (modelo atual, intacto);
--   card_saved   — pagamento direto com cartão salvo (sem URL/preferência).
-- Linhas antigas ganham 'checkout_pro' por padrão e continuam válidas: elas
-- sempre tiveram sandbox_checkout_url preenchida, e a restrição composta só
-- exige URL para 'checkout_pro' e URL nula para 'card_saved'. O CHECK do
-- provider ('mercadopago') e todo o restante de payment_attempts ficam
-- inalterados, preservando pedidos, preferências e a reconciliação atual.
ALTER TABLE payment_attempts
  ADD COLUMN payment_kind text NOT NULL DEFAULT 'checkout_pro'
    CHECK (payment_kind IN ('checkout_pro', 'card_saved'));

ALTER TABLE payment_attempts
  ALTER COLUMN sandbox_checkout_url DROP NOT NULL;

ALTER TABLE payment_attempts
  ADD CONSTRAINT payment_attempts_payment_kind_url_check
  CHECK (
    (payment_kind = 'checkout_pro' AND sandbox_checkout_url IS NOT NULL)
    OR (payment_kind = 'card_saved' AND sandbox_checkout_url IS NULL)
  );
