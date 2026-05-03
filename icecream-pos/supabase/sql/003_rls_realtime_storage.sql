BEGIN;

-- Enable RLS on all tables
ALTER TABLE customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock       ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices    ENABLE ROW LEVEL SECURITY;

-- Only authenticated admin can do everything
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'customers' AND policyname = 'admin_all'
  ) THEN
    CREATE POLICY "admin_all" ON customers FOR ALL TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'admin_all'
  ) THEN
    CREATE POLICY "admin_all" ON products FOR ALL TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock' AND policyname = 'admin_all'
  ) THEN
    CREATE POLICY "admin_all" ON stock FOR ALL TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock_logs' AND policyname = 'admin_all'
  ) THEN
    CREATE POLICY "admin_all" ON stock_logs FOR ALL TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'orders' AND policyname = 'admin_all'
  ) THEN
    CREATE POLICY "admin_all" ON orders FOR ALL TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'order_items' AND policyname = 'admin_all'
  ) THEN
    CREATE POLICY "admin_all" ON order_items FOR ALL TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'invoices' AND policyname = 'admin_all'
  ) THEN
    CREATE POLICY "admin_all" ON invoices FOR ALL TO authenticated USING (true);
  END IF;
END
$$;

-- Products and stock readable publicly (for any future kiosk)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'products' AND policyname = 'public_read_products'
  ) THEN
    CREATE POLICY "public_read_products" ON products FOR SELECT TO anon USING (is_active = true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'stock' AND policyname = 'public_read_stock'
  ) THEN
    CREATE POLICY "public_read_stock" ON stock FOR SELECT TO anon USING (true);
  END IF;
END
$$;

COMMIT;

-- Realtime setup
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE products;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'customers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE customers;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'stock'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE stock;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'invoices'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
  END IF;
END
$$;

-- Storage bucket: invoices (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoices', 'invoices', true, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id)
DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage object policies are managed by Supabase's internal storage schema permissions.
-- The backend uploads invoices with the service role key, which bypasses RLS.
-- Keep the bucket public and configure any extra storage access rules from the Supabase dashboard if needed.
