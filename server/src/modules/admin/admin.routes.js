import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorize.js';
import { upload } from '../../middleware/upload.js';
import { pool } from '../../db/pool.js';
import { randomUUID } from 'node:crypto';
import { validationError } from '../../utils/httpError.js';

export const adminRouter = Router();

// Protege todas as rotas de admin exigindo autenticação e papel de administrador
adminRouter.use(requireAuth, requireRole('administrador'));

// Rota para cadastrar novo produto com imagens
adminRouter.post('/produtos', upload.array('images', 5), async (req, res) => {
  const { name, description, color, is_printed, price_cents, promo_price_cents,
    weight_g, length_cm, width_cm, height_cm } = req.body;
  const errors = {};
  const text = value => typeof value === 'string' ? value.trim() : '';
  const integer = value => /^\d+$/.test(String(value ?? '')) ? Number(value) : NaN;
  const price = integer(price_cents);
  const promoPrice = promo_price_cents === '' || promo_price_cents == null ? null : integer(promo_price_cents);
  const weight = integer(weight_g);
  const length = integer(length_cm);
  const width = integer(width_cm);
  const height = integer(height_cm);
  let sizes = [];

  if (!text(name) || text(name).length > 255) errors.name = 'Informe um nome com até 255 caracteres.';
  if (!text(color) || text(color).length > 50) errors.color = 'Informe uma cor com até 50 caracteres.';
  if (!Number.isSafeInteger(price) || price < 1) errors.price_cents = 'Informe o preço em centavos.';
  if (promoPrice !== null && (!Number.isSafeInteger(promoPrice) || promoPrice < 0 || promoPrice >= price)) errors.promo_price_cents = 'O preço promocional deve ser menor que o preço normal.';
  if (!Number.isSafeInteger(weight) || weight < 1) errors.weight_g = 'Informe o peso em gramas.';
  for (const [key, value] of [['length_cm', length], ['width_cm', width], ['height_cm', height]]) {
    if (!Number.isSafeInteger(value) || value < 1) errors[key] = 'Informe a dimensão em centímetros.';
  }
  try {
    sizes = JSON.parse(req.body.sizes ?? '[]');
    if (!Array.isArray(sizes) || !sizes.length || sizes.some(item =>
      !['P', 'M', 'G', 'GG'].includes(item?.size) || !Number.isSafeInteger(Number(item.stock)) || Number(item.stock) < 0
    )) errors.sizes = 'Informe o estoque inteiro por tamanho (P, M, G e GG).';
  } catch {
    errors.sizes = 'A grade de tamanhos está inválida.';
  }
  if (Object.keys(errors).length) throw validationError(errors);

  const client = await pool.connect();
  const productId = randomUUID();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO products (id, name, description, color, is_printed, price_cents,
                             promo_price_cents, weight_g, length_cm, width_cm, height_cm)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [productId, text(name), text(description), text(color), is_printed === 'true' || is_printed === true,
        price, promoPrice, weight, length, width, height],
    );
    for (const item of sizes) {
      await client.query(
        'INSERT INTO product_sizes (product_id, size, stock) VALUES ($1, $2, $3)',
        [productId, item.size, Number(item.stock)],
      );
    }
    for (const [index, file] of (req.files ?? []).entries()) {
      await client.query(
        'INSERT INTO product_images (product_id, image_url, is_main) VALUES ($1, $2, $3)',
        [productId, `uploads/${file.filename}`, index === 0],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  res.status(201).json({ product: { id: productId } });
});