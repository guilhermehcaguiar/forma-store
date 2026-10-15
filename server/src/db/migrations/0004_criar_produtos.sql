CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(50) NOT NULL,
  is_printed BOOLEAN DEFAULT false,
  price_cents INTEGER NOT NULL,
  promo_price_cents INTEGER,
  weight_g INTEGER NOT NULL,
  length_cm INTEGER NOT NULL,
  width_cm INTEGER NOT NULL,
  height_cm INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  size VARCHAR(10) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  UNIQUE(product_id, size)
);

CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_main BOOLEAN DEFAULT false
);