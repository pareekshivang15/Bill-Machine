-- CRITICAL: ATOMIC ORDER CONFIRMATION (Postgres RPC Function)
CREATE OR REPLACE FUNCTION confirm_order(
  p_order_id        UUID,
  p_items           JSONB,
  p_subtotal        DECIMAL,
  p_total           DECIMAL,
  p_customer_id     UUID DEFAULT NULL,
  p_customer_name   TEXT DEFAULT NULL,
  p_customer_phone  TEXT DEFAULT NULL,
  p_customer_address TEXT DEFAULT NULL,
  p_payment_method  TEXT DEFAULT 'CASH',
  p_discount_type   TEXT DEFAULT NULL,
  p_discount_value  DECIMAL DEFAULT 0,
  p_discount_amount DECIMAL DEFAULT 0,
  p_cgst            DECIMAL DEFAULT 0,
  p_sgst            DECIMAL DEFAULT 0,
  p_notes           TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item            JSONB;
  v_current_stock   INT;
  v_product_name    TEXT;
  v_order_number    TEXT;
  v_invoice_number  TEXT;
  v_payment_method  TEXT;
  v_seq             INT;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART';
  END IF;

  -- Generate order + invoice number from one sequence value:
  -- ORD-YYYYMMDD-XXXX and INV-YYYYMMDD-XXXX
  v_seq := nextval('invoice_seq');
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-'
                    || LPAD(v_seq::TEXT, 4, '0');
  v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-'
                      || LPAD(v_seq::TEXT, 4, '0');
  v_payment_method := UPPER(COALESCE(NULLIF(TRIM(p_payment_method), ''), 'CASH'));

  IF v_payment_method NOT IN ('CASH', 'UPI', 'CARD', 'ONLINE') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;

  -- STEP 1: Validate and lock stock for all items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT s.quantity, p.name
    INTO v_current_stock, v_product_name
    FROM stock s
    JOIN products p ON p.id = s.product_id
    WHERE s.product_id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'STOCK_NOT_FOUND:Product % has no stock record',
        (v_item->>'product_name');
    END IF;

    IF v_current_stock < (v_item->>'quantity')::INT THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:% has only % units available',
        v_product_name, v_current_stock;
    END IF;
  END LOOP;

  -- STEP 2: Insert order
  INSERT INTO orders (
    id, order_number, customer_id, customer_name_snapshot,
    customer_phone_snapshot, customer_address_snapshot, payment_method,
    status, subtotal, discount_type,
    discount_value, discount_amount, cgst, sgst, total, notes
  ) VALUES (
    p_order_id, v_order_number, p_customer_id, p_customer_name,
    p_customer_phone, p_customer_address, v_payment_method,
    'CONFIRMED', p_subtotal, p_discount_type,
    p_discount_value, p_discount_amount, p_cgst, p_sgst, p_total, p_notes
  );

  -- STEP 3: Insert order items + deduct stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO order_items (
      order_id, product_id, product_name_snapshot,
      quantity, unit_price, subtotal
    ) VALUES (
      p_order_id,
      (v_item->>'product_id')::UUID,
      v_item->>'product_name',
      (v_item->>'quantity')::INT,
      (v_item->>'unit_price')::DECIMAL,
      (v_item->>'subtotal')::DECIMAL
    );

    -- Deduct stock
    UPDATE stock
    SET quantity = quantity - (v_item->>'quantity')::INT,
        updated_at = NOW()
    WHERE product_id = (v_item->>'product_id')::UUID;

    -- Log the deduction
    INSERT INTO stock_logs (product_id, change_type, quantity_delta, reason)
    VALUES (
      (v_item->>'product_id')::UUID, 'DEDUCT',
      -(v_item->>'quantity')::INT,
      'Order: ' || v_order_number
    );
  END LOOP;

  -- STEP 4: Create invoice record
  INSERT INTO invoices (invoice_number, order_id)
  VALUES (v_invoice_number, p_order_id);

  -- STEP 5: Update customer stats
  IF p_customer_id IS NOT NULL THEN
    UPDATE customers
    SET total_orders = total_orders + 1,
        total_spent  = total_spent + p_total,
        updated_at   = NOW()
    WHERE id = p_customer_id;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'order_number', v_order_number,
    'invoice_number', v_invoice_number,
    'order_id', p_order_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Everything rolls back automatically
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM
  );
END;
$$;

REVOKE ALL ON FUNCTION confirm_order(
  UUID, JSONB, DECIMAL, DECIMAL, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_order(
  UUID, JSONB, DECIMAL, DECIMAL, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, TEXT
) TO authenticated;
