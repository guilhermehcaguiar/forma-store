import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/authorize.js';
import { upload } from '../../middleware/upload.js';
import { pool } from '../../db/pool.js';

export const adminRouter = Router();

// Protege todas as rotas de admin exigindo autenticação e papel de administrador
adminRouter.use(requireAuth, requireRole('administrador'));

// Rota para cadastrar novo produto com imagens
adminRouter.post('/produtos', upload.array('images', 5), async (req, res) => {
  const { 
    name, description, color, is_printed, 
    price_cents, promo_price_cents, weight_g, 
    length_cm, width_cm, height_cm 
  } = req.body;
  
  try {
    const query = `
      INSERT INTO products (name, description, color, is_printed, price_cents, promo_price_cents, weight_g, length_cm, width_cm, height_cm) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
      RETURNING id
    `;
    const values = [
      name, 
      description || '', 
      color, 
      is_printed === 'true' || is_printed === true, 
      parseInt(price_cents), 
      promo_price_cents ? parseInt(promo_price_cents) : null, 
      parseInt(weight_g), 
      parseInt(length_cm), 
      parseInt(width_cm), 
      parseInt(height_cm)
    ];

    const { rows } = await pool.query(query, values);
    const productId = rows[0].id;

    // Se houver imagens enviadas, salva na tabela product_images
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const imageUrl = `uploads/${req.files[i].filename}`;
        const isMain = i === 0; // Define a primeira imagem como principal
        await pool.query(
          `INSERT INTO product_images (product_id, image_url, is_main) VALUES ($1, $2, $3)`,
          [productId, imageUrl, isMain]
        );
      }
    }

    res.status(201).json({ message: 'Produto cadastrado com sucesso', id: productId });
  } catch (error) {
    console.error('Erro ao cadastrar produto:', error);
    res.status(500).json({ error: 'erro_ao_cadastrar_produto' });
  }
});