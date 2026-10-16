ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('aguardando_pagamento', 'pago', 'cancelado', 'revisao_manual'));

ALTER TABLE orders ADD COLUMN checkout_key uuid;
ALTER TABLE orders ADD COLUMN checkout_fingerprint text;
ALTER TABLE orders ADD COLUMN checkout_payload_fingerprint text;
ALTER TABLE orders ADD COLUMN payment_deadline_at timestamptz;
ALTER TABLE orders ADD COLUMN shipping_company_name text NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN shipping_quote_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE orders
   SET checkout_key = gen_random_uuid(),
       checkout_fingerprint = id::text,
      checkout_payload_fingerprint = id::text,
       payment_deadline_at = created_at + interval '30 minutes';

ALTER TABLE orders ALTER COLUMN checkout_key SET NOT NULL;
ALTER TABLE orders ALTER COLUMN checkout_fingerprint SET NOT NULL;
ALTER TABLE orders ALTER COLUMN checkout_payload_fingerprint SET NOT NULL;
ALTER TABLE orders ALTER COLUMN payment_deadline_at SET DEFAULT now() + interval '30 minutes';
ALTER TABLE orders ALTER COLUMN payment_deadline_at SET NOT NULL;

ALTER TABLE order_items ADD COLUMN product_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX orders_user_checkout_key_unique_idx
  ON orders (user_id, checkout_key);
CREATE UNIQUE INDEX orders_active_checkout_unique_idx
  ON orders (user_id, checkout_fingerprint)
  WHERE status = 'aguardando_pagamento';
CREATE INDEX orders_payment_deadline_idx
  ON orders (payment_deadline_at)
  WHERE status = 'aguardando_pagamento';

CREATE TABLE stock_reservations (
  id               uuid        PRIMARY KEY,
  order_id         uuid        NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_size_id  uuid        NOT NULL REFERENCES product_sizes (id) ON DELETE RESTRICT,
  quantity         integer     NOT NULL CHECK (quantity > 0),
  status           text        NOT NULL DEFAULT 'reservado'
                               CHECK (status IN ('reservado', 'consumido', 'liberado')),
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_size_id)
);

CREATE INDEX stock_reservations_expiry_idx
  ON stock_reservations (expires_at)
  WHERE status = 'reservado';

CREATE TABLE payment_attempts (
  id                       uuid        PRIMARY KEY,
  order_id                 uuid        NOT NULL UNIQUE REFERENCES orders (id) ON DELETE CASCADE,
  provider                 text        NOT NULL DEFAULT 'mercadopago'
                                       CHECK (provider = 'mercadopago'),
  preference_id            text        UNIQUE,
  provider_payment_id      text        UNIQUE,
  status                   text        NOT NULL DEFAULT 'criada'
                                       CHECK (status IN ('criada', 'pendente', 'em_processamento', 'aprovada', 'recusada', 'cancelada', 'reembolsada', 'revisao_manual')),
  provider_status          text,
  status_detail            text,
  amount_centavos          bigint      NOT NULL CHECK (amount_centavos >= 0),
  sandbox_checkout_url     text        NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  paid_at                  timestamptz
);

CREATE TABLE payment_webhook_events (
  event_id       text        PRIMARY KEY,
  payment_id     text        NOT NULL,
  action         text,
  result         text        NOT NULL CHECK (result IN ('processado', 'ignorado', 'divergente')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX payment_webhook_events_payment_idx
  ON payment_webhook_events (payment_id);

CREATE TABLE coupon_redemptions (
  id          uuid        PRIMARY KEY,
  coupon_id   uuid        NOT NULL REFERENCES coupons (id),
  order_id    uuid        NOT NULL UNIQUE REFERENCES orders (id),
  user_id     uuid        NOT NULL REFERENCES users (id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coupon_redemptions_coupon_idx ON coupon_redemptions (coupon_id);
