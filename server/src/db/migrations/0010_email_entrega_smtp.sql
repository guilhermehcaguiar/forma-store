-- Entrega transacional de e-mail: confirmação de compra após pagamento
-- aprovado, transporte SMTP configurável e nova tentativa controlada.
--
-- Estados de email_outbox:
--   queued  — aguardando o worker (enfileirado na transação do pedido/pagamento)
--   sending — reivindicada por um worker (next_attempt_at guarda o "lease";
--             vencido, a linha volta a ser elegível para recuperação de crash)
--   sent    — entregue ao servidor SMTP (sent_at preenchido)
--   failed  — tentativa com falha registrada em last_error; nova tentativa
--             apenas quando next_attempt_at vencer. next_attempt_at NULL com
--             status failed = tentativas esgotadas (reenvio apenas manual)
--   mocked  — prévia local do modo mock (não é entrega)
--
-- Linhas legadas em 'queued'/'mocked' continuam válidas.

ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_status_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_status_check
  CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'mocked'));

ALTER TABLE email_outbox DROP CONSTRAINT email_outbox_template_check;
ALTER TABLE email_outbox ADD CONSTRAINT email_outbox_template_check
  CHECK (template IN ('order_confirmation', 'order_status', 'purchase_confirmation'));

ALTER TABLE email_outbox ADD COLUMN next_attempt_at timestamptz;
ALTER TABLE email_outbox ADD COLUMN sent_at timestamptz;
ALTER TABLE email_outbox ADD COLUMN last_error text;

-- Troca o índice parcial de 'queued' pela lista de estados que o worker
-- considera; a elegibilidade por next_attempt_at é filtro residual da query.
DROP INDEX email_outbox_dispatch_idx;
CREATE INDEX email_outbox_dispatch_idx ON email_outbox (created_at)
  WHERE status IN ('queued', 'sending', 'failed');
