-- Frete demonstrativo e provedor de pagamento são escolhas independentes.
-- Pedidos legados preservam seu provedor; nenhuma tentativa existente muda.
ALTER TABLE orders ADD COLUMN payment_provider text;
UPDATE orders SET payment_provider = CASE WHEN transaction_mode = 'demo' THEN 'forma_demo' ELSE 'mercadopago' END;
ALTER TABLE orders ALTER COLUMN payment_provider SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_payment_provider_check CHECK (
  payment_provider IN ('forma_demo', 'mercadopago') AND
  (transaction_mode = 'demo' OR payment_provider = 'mercadopago')
);

ALTER TABLE shipping_quotes ADD COLUMN payment_provider text;
UPDATE shipping_quotes SET payment_provider = CASE WHEN transaction_mode = 'demo' THEN 'forma_demo' ELSE 'mercadopago' END;
ALTER TABLE shipping_quotes ALTER COLUMN payment_provider SET NOT NULL;
ALTER TABLE shipping_quotes ADD CONSTRAINT shipping_quotes_payment_provider_check CHECK (
  payment_provider IN ('forma_demo', 'mercadopago') AND
  (transaction_mode = 'demo' OR payment_provider = 'mercadopago')
);

-- Inserções legadas sem o novo campo conservam a semântica anterior.
CREATE FUNCTION default_payment_provider() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_provider IS NULL THEN
    NEW.payment_provider := CASE WHEN NEW.transaction_mode = 'demo' THEN 'forma_demo' ELSE 'mercadopago' END;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER orders_default_payment_provider BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION default_payment_provider();
CREATE TRIGGER quotes_default_payment_provider BEFORE INSERT ON shipping_quotes
  FOR EACH ROW EXECUTE FUNCTION default_payment_provider();

CREATE OR REPLACE FUNCTION check_payment_order_mode() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Provedores desconhecidos continuam sendo rejeitados pelo CHECK original.
  IF NEW.provider NOT IN ('forma_demo', 'mercadopago') THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM orders WHERE id = NEW.order_id AND payment_provider = NEW.provider) THEN
    RAISE EXCEPTION 'Provedor de pagamento incompatível com o modo do pedido';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION preserve_order_mode() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.transaction_mode <> OLD.transaction_mode OR NEW.payment_provider <> OLD.payment_provider THEN
    RAISE EXCEPTION 'O modo ou provedor de um pedido registrado não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$;
