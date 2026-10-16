CREATE TABLE email_outbox (
  id              uuid        PRIMARY KEY,
  order_id        uuid        NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  event_key       text        NOT NULL UNIQUE,
  recipient_email text        NOT NULL,
  template        text        NOT NULL CHECK (template IN ('order_confirmation', 'order_status')),
  subject         text        NOT NULL,
  payload         jsonb       NOT NULL,
  status          text        NOT NULL DEFAULT 'queued'
                              CHECK (status IN ('queued', 'mocked')),
  mock_message   jsonb,
  attempts        integer     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  processed_at    timestamptz
);

CREATE INDEX email_outbox_dispatch_idx ON email_outbox (created_at)
  WHERE status = 'queued';
CREATE INDEX email_outbox_order_idx ON email_outbox (order_id, created_at);
