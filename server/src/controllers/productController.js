import pool from '../db/index.js';

export const getProducts = async (req, res) => {
  try {
    const { color, is_printed, size, promo, sort } = req.query;
    
    let query = `
      SELECT p.*, 
        json_agg(DISTINCT ps.*) as sizes,
        json_agg(DISTINCT pi.*) as images
      FROM products p
      LEFT JOIN product_sizes ps ON p.id = ps.product_id
      LEFT JOIN product_images pi ON p.id = pi.product_id
      WHERE p.is_active = true
    `;
    
    const values = [];
    let count = 1;

    if (color) { query += ` AND p.color = $${count++}`; values.push(color); }
    if (is_printed !== undefined) { query += ` AND p.is_printed = $${count++}`; values.push(is_printed === 'true'); }
    if (promo === 'true') { query += ` AND p.promo_price_cents IS NOT NULL`; }
    if (size) { query += ` AND ps.size = $${count++} AND ps.stock > 0`; values.push(size); }

    query += ` GROUP BY p.id`;

    if (sort === 'price_asc') query += ` ORDER BY COALESCE(p.promo_price_cents, p.price_cents) ASC`;
    else if (sort === 'price_desc') query += ` ORDER BY COALESCE(p.promo_price_cents, p.price_cents) DESC`;
    else if (sort === 'newest') query += ` ORDER BY p.created_at DESC`;
    else if (sort === 'oldest') query += ` ORDER BY p.created_at ASC`;
    else query += ` ORDER BY p.name ASC`;

    const { rows } = await pool.query(query, values);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'erro_interno_servidor' });
  }
};