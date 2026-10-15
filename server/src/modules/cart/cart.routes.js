import { Router } from 'express';
import pool from '../../db/index.js';

export const cartRouter = Router();

// Rota para validar cupons de desconto
cartRouter.post('/cupom', async (req, res) => {
  const { code } = req.body;

  try {
    const { rows } = await pool.query(
      'SELECT * FROM coupons WHERE code = $1 AND is_active = true',
      [code ? code.trim().toUpperCase() : '']
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cupom inválido ou expirado' });
    }

    const coupon = rows[0];
    res.json({
      code: coupon.code,
      discountPercentage: coupon.discount_percentage
    });
  } catch (error) {
    console.error('Erro ao validar cupom:', error);
    res.status(500).json({ error: 'Erro interno ao validar cupom' });
  }
});