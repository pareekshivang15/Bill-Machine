BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CUSTOMERS (stores every customer with their bill history)
CREATE TABLE IF NOT EXISTS customers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  phone           TEXT UNIQUE,
  email           TEXT,
  address         TEXT,
  total_orders    INT DEFAULT 0,
  total_spent     DECIMAL(12,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- PRODUCTS
CREATE TABLE IF NOT EXISTS products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  price           DECIMAL(10,2) NOT NULL,
  image_url       TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- STOCK
CREATE TABLE IF NOT EXISTS stock (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID UNIQUE REFERENCES products(id),
  quantity        INT DEFAULT 0 CHECK (quantity >= 0),
  low_threshold   INT DEFAULT 10,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- STOCK HISTORY LOG
CREATE TABLE IF NOT EXISTS stock_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id),
  change_type     TEXT CHECK (change_type IN ('ADD','DEDUCT','ADJUST')),
  quantity_delta  INT NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number            TEXT UNIQUE NOT NULL,
  customer_id             UUID REFERENCES customers(id),
  customer_name_snapshot  TEXT,
  customer_phone_snapshot TEXT,
  customer_address_snapshot TEXT,
  payment_method          TEXT DEFAULT 'CASH'
                          CHECK (payment_method IN ('CASH','UPI','CARD','ONLINE')),
  status                  TEXT DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING','CONFIRMED','CANCELLED')),
  subtotal                DECIMAL(10,2) NOT NULL,
  discount_type           TEXT CHECK (discount_type IN ('FLAT','PERCENT')),
  discount_value          DECIMAL(10,2) DEFAULT 0,
  discount_amount         DECIMAL(10,2) DEFAULT 0,
  cgst                    DECIMAL(10,2) DEFAULT 0,
  sgst                    DECIMAL(10,2) DEFAULT 0,
  total                   DECIMAL(10,2) NOT NULL,
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ORDER ITEMS (snapshot prices - critical for billing integrity)
CREATE TABLE IF NOT EXISTS order_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id            UUID REFERENCES products(id),
  product_name_snapshot TEXT NOT NULL,
  quantity              INT NOT NULL CHECK (quantity > 0),
  unit_price            DECIMAL(10,2) NOT NULL,
  subtotal              DECIMAL(10,2) NOT NULL
);

-- INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT UNIQUE NOT NULL,
  order_id        UUID UNIQUE REFERENCES orders(id),
  pdf_url         TEXT,
  printed         BOOLEAN DEFAULT FALSE,
  saved           BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- INVOICE SEQUENCE COUNTER (guarantees unique sequential numbers)
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;

-- Updated-at helper trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_set_updated_at ON customers;
CREATE TRIGGER customers_set_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS stock_set_updated_at ON stock;
CREATE TRIGGER stock_set_updated_at
BEFORE UPDATE ON stock
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_stock_product_id ON stock(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_created_at ON stock_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);

COMMIT;
