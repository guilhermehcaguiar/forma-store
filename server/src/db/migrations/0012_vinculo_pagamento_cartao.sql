-- Vínculo seguro para reconciliar após timeout, sem persistir token temporário.
ALTER TABLE payment_attempts ADD COLUMN expected_customer_id text;
ALTER TABLE payment_attempts ADD COLUMN expected_card_id text;
ALTER TABLE payment_attempts ADD CONSTRAINT saved_card_binding_check CHECK (
  payment_kind <> 'card_saved' OR (expected_customer_id IS NOT NULL AND expected_card_id IS NOT NULL)
) NOT VALID;
-- NOT VALID preserva tentativas card_saved históricas; novas precisam de vínculo.
