CREATE TABLE shipping_quotes (
  id                   uuid        PRIMARY KEY,
  user_id              uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  address_id           uuid        NOT NULL REFERENCES addresses (id) ON DELETE CASCADE,
  address_fingerprint  text        NOT NULL,
  cart_fingerprint     text        NOT NULL,
  services             jsonb       NOT NULL,
  expires_at           timestamptz NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shipping_quotes_user_expiry_idx ON shipping_quotes (user_id, expires_at);

CREATE TABLE orders (
  id                       uuid        PRIMARY KEY,
  user_id                  uuid        NOT NULL REFERENCES users (id),
  address_id               uuid        REFERENCES addresses (id) ON DELETE SET NULL,
  address_snapshot         jsonb       NOT NULL,
  status                   text        NOT NULL DEFAULT 'aguardando_pagamento'
                                       CHECK (status IN ('aguardando_pagamento', 'cancelado', 'pago')),
  subtotal_centavos        bigint      NOT NULL CHECK (subtotal_centavos >= 0),
  discount_centavos        bigint      NOT NULL DEFAULT 0 CHECK (discount_centavos >= 0),
  shipping_centavos        bigint      NOT NULL CHECK (shipping_centavos >= 0),
  total_centavos           bigint      NOT NULL CHECK (total_centavos >= 0),
  coupon_code              text,
  shipping_service_id      text        NOT NULL,
  shipping_service_name    text        NOT NULL,
  shipping_delivery_days   integer,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC);

CREATE TABLE order_items (
  id                    uuid    PRIMARY KEY,
  order_id              uuid    NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id            uuid    NOT NULL,
  product_name          text    NOT NULL,
  color                 text    NOT NULL,
  size                  text    NOT NULL DEFAULT '',
  quantity              integer NOT NULL CHECK (quantity > 0),
  unit_price_centavos   integer NOT NULL CHECK (unit_price_centavos >= 0),
  line_total_centavos   bigint  NOT NULL CHECK (line_total_centavos >= 0)
);

CREATE INDEX order_items_order_idx ON order_items (order_id);
