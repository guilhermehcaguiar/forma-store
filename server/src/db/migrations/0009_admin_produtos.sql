ALTER TABLE products ADD COLUMN admin_version integer NOT NULL DEFAULT 1 CHECK (admin_version > 0);
ALTER TABLE product_sizes ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE product_sizes ADD COLUMN revision integer NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE product_sizes ADD CONSTRAINT product_sizes_stock_nonnegative CHECK (stock >= 0);

-- Detecta também alterações de estoque feitas pelo checkout/liberação de reserva,
-- sem bloquear a linha de products (evita inverter a ordem dos locks do checkout).
CREATE FUNCTION bump_product_size_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stock IS DISTINCT FROM OLD.stock OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.revision := OLD.revision + 1;
  ELSE
    NEW.revision := OLD.revision;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER product_size_revision BEFORE UPDATE ON product_sizes
FOR EACH ROW EXECUTE FUNCTION bump_product_size_revision();
