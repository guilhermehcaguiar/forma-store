ALTER TABLE shipping_quotes ADD COLUMN transaction_mode text NOT NULL DEFAULT 'gateway'
  CHECK (transaction_mode IN ('gateway', 'demo'));
ALTER TABLE orders ADD COLUMN transaction_mode text NOT NULL DEFAULT 'gateway'
  CHECK (transaction_mode IN ('gateway', 'demo'));

ALTER TABLE payment_attempts DROP CONSTRAINT payment_attempts_provider_check;
ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_provider_check
  CHECK (provider IN ('mercadopago', 'forma_demo'));
ALTER TABLE payment_attempts DROP CONSTRAINT payment_attempts_payment_kind_check;
ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_payment_kind_check
  CHECK (payment_kind IN ('checkout_pro', 'card_saved', 'demo'));
ALTER TABLE payment_attempts DROP CONSTRAINT payment_attempts_payment_kind_url_check;
ALTER TABLE payment_attempts ADD CONSTRAINT payment_attempts_payment_kind_url_check CHECK (
  (provider = 'mercadopago' AND payment_kind = 'checkout_pro' AND sandbox_checkout_url IS NOT NULL)
  OR (provider = 'mercadopago' AND payment_kind = 'card_saved' AND sandbox_checkout_url IS NULL)
  OR (provider = 'forma_demo' AND payment_kind = 'demo' AND sandbox_checkout_url IS NULL
      AND preference_id IS NULL AND provider_payment_id IS NOT NULL
      AND provider_payment_id ~ '^demo:[0-9a-f-]{36}$')
);

-- O vínculo é conferido também no banco: uma tentativa demo não pode se ligar
-- a um pedido de gateway (nem o inverso), mesmo por um caminho novo no código.
CREATE FUNCTION check_payment_order_mode() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = NEW.order_id AND
      transaction_mode = CASE WHEN NEW.provider = 'forma_demo' THEN 'demo' ELSE 'gateway' END) THEN
    RAISE EXCEPTION 'Provedor de pagamento incompatível com o modo do pedido';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER payment_order_mode BEFORE INSERT OR UPDATE ON payment_attempts
  FOR EACH ROW EXECUTE FUNCTION check_payment_order_mode();

CREATE FUNCTION preserve_order_mode() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.transaction_mode <> OLD.transaction_mode THEN
    RAISE EXCEPTION 'O modo de um pedido registrado não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_preserve_mode BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION preserve_order_mode();
