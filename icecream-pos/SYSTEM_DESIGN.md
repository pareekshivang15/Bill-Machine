# IceCream POS — System Design & Implementation Reference

> **Purpose:** This file is the single source of truth for architecture, schema, build plan, and implementation status.  
> Update the checklist as phases are completed.

---

## Table of Contents
1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Folder Structure](#folder-structure)
4. [Database Schema](#database-schema)
5. [Postgres RPC — confirm_order()](#postgres-rpc--confirm_order)
6. [Row Level Security (RLS)](#row-level-security-rls)
7. [Supabase Realtime](#supabase-realtime)
8. [Node.js Backend (PDF only)](#nodejs-backend-pdf-only)
9. [Frontend Architecture](#frontend-architecture)
10. [Zustand Store Structure](#zustand-store-structure)
11. [Billing Flow (Exact Sequence)](#billing-flow-exact-sequence)
12. [Error Handling Rules](#error-handling-rules)
13. [Environment Variables](#environment-variables)
14. [Seed Data](#seed-data)
15. [Build Phases & Checklist](#build-phases--checklist)

---

## Overview

A **production-grade billing and inventory system** for an ice cream vendor shop in India.  
Runs every day in a real business. Zero tolerance for bugs, data loss, or race conditions.

Key design decisions:
- **Supabase** handles Auth, DB, Realtime, and File Storage natively — no Redis, no Socket.io needed
- **Node backend is intentionally thin** — only PDF generation via PDFKit
- **Atomic order confirmation** via a single Postgres RPC function — stock deduction, order insert, invoice creation all happen in one transaction
- **Snapshot prices** in `order_items` — billing integrity is preserved even if product prices change later
- **PDF failure never blocks bill saving** — the DB transaction is always committed first; PDF can be retried from Invoice History

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React.js (Vite) + TailwindCSS       |
| Database   | Supabase (PostgreSQL + Realtime + Auth + Storage) |
| Backend    | Node.js + Express (PDF generation only) |
| PDF        | PDFKit                              |
| State Mgmt | Zustand                             |
| HTTP       | Axios                               |
| Charts     | Recharts                            |
| Toasts     | React Hot Toast                     |

---

## Folder Structure

```
/icecream-pos
  /frontend
    /src
      /pages
        Login.jsx
        POS.jsx
        CustomerManager.jsx
        StockManager.jsx
        InvoiceHistory.jsx
        Dashboard.jsx
      /components
        /pos
          ProductGrid.jsx
          ProductCard.jsx
          OrderCart.jsx
          OrderTabs.jsx
          CustomerSearch.jsx
          DiscountInput.jsx
          BillSummary.jsx
        /stock
          StockTable.jsx
          AddStockModal.jsx
          EditProductModal.jsx
        /customer
          CustomerCard.jsx
          CustomerOrderHistory.jsx
        /shared
          Navbar.jsx
          Sidebar.jsx
          Modal.jsx
          LoadingSpinner.jsx
          Toast.jsx
      /store
        authStore.js
        productStore.js
        stockStore.js
        orderStore.js
        customerStore.js
        invoiceStore.js
      /services
        supabase.js           ← supabase client init
        api.js                ← axios instance for Node backend
        invoiceService.js     ← generate + print logic
      /hooks
        useRealtime.js        ← stock + order realtime subscriptions
        useProducts.js
        useCustomers.js
      /utils
        calculations.js       ← tax, discount, totals
        formatters.js         ← currency, dates, invoice numbers
      App.jsx
      main.jsx
    .env.local
    vite.config.js
    tailwind.config.js
    package.json

  /backend
    /src
      /routes
        invoice.routes.js
      /services
        pdf.service.js        ← PDFKit generation
        storage.service.js    ← Supabase storage upload
      /middleware
        errorHandler.js
    server.js
    package.json
    .env

  /supabase
    /sql
      001_schema.sql          ← all CREATE TABLE statements
      002_rpc.sql             ← confirm_order() function
      003_rls.sql             ← all RLS policies
      004_realtime.sql        ← enable realtime on tables
      005_seed.sql            ← 15 sample products + stock
```

---

## Database Schema

### customers
```sql
CREATE TABLE customers (
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
```

### products
```sql
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  price           DECIMAL(10,2) NOT NULL,
  image_url       TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### stock
```sql
CREATE TABLE stock (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID UNIQUE REFERENCES products(id),
  quantity        INT DEFAULT 0 CHECK (quantity >= 0),
  low_threshold   INT DEFAULT 10,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### stock_logs
```sql
CREATE TABLE stock_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id),
  change_type     TEXT CHECK (change_type IN ('ADD','DEDUCT','ADJUST')),
  quantity_delta  INT NOT NULL,
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### orders
```sql
CREATE TABLE orders (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number            TEXT UNIQUE NOT NULL,
  customer_id             UUID REFERENCES customers(id),
  customer_name_snapshot  TEXT,
  customer_phone_snapshot TEXT,
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
```

### order_items
> Snapshot prices are critical for billing integrity — product price changes won't corrupt historical bills.

```sql
CREATE TABLE order_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id            UUID REFERENCES products(id),
  product_name_snapshot TEXT NOT NULL,
  quantity              INT NOT NULL CHECK (quantity > 0),
  unit_price            DECIMAL(10,2) NOT NULL,
  subtotal              DECIMAL(10,2) NOT NULL
);
```

### invoices
```sql
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT UNIQUE NOT NULL,
  order_id        UUID UNIQUE REFERENCES orders(id),
  pdf_url         TEXT,
  printed         BOOLEAN DEFAULT FALSE,
  saved           BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Invoice Sequence Counter
```sql
-- Guarantees unique sequential invoice numbers across concurrent transactions
CREATE SEQUENCE invoice_seq START 1;
```

---

## Postgres RPC — confirm_order()

> **This is the heart of the system.** One atomic transaction:  
> validate stock → insert order → insert items → deduct stock → log → create invoice → update customer stats

```sql
CREATE OR REPLACE FUNCTION confirm_order(
  p_order_id        UUID,
  p_customer_id     UUID DEFAULT NULL,
  p_customer_name   TEXT DEFAULT NULL,
  p_customer_phone  TEXT DEFAULT NULL,
  p_items           JSONB,
  p_subtotal        DECIMAL,
  p_discount_type   TEXT DEFAULT NULL,
  p_discount_value  DECIMAL DEFAULT 0,
  p_discount_amount DECIMAL DEFAULT 0,
  p_cgst            DECIMAL DEFAULT 0,
  p_sgst            DECIMAL DEFAULT 0,
  p_total           DECIMAL,
  p_notes           TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item            JSONB;
  v_current_stock   INT;
  v_product_name    TEXT;
  v_order_number    TEXT;
  v_invoice_number  TEXT;
  v_seq             INT;
BEGIN
  -- Generate order number: ORD-YYYYMMDD-XXXX
  v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-'
                    || LPAD(nextval('invoice_seq')::TEXT, 4, '0');
  v_seq := nextval('invoice_seq');
  v_invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-'
                      || LPAD(v_seq::TEXT, 4, '0');

  -- STEP 1: Validate and lock stock for all items (FOR UPDATE prevents race conditions)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT s.quantity, p.name
    INTO v_current_stock, v_product_name
    FROM stock s
    JOIN products p ON p.id = s.product_id
    WHERE s.product_id = (v_item->>'product_id')::UUID
    FOR UPDATE;

    IF v_current_stock < (v_item->>'quantity')::INT THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:% has only % units available',
        v_product_name, v_current_stock;
    END IF;
  END LOOP;

  -- STEP 2: Insert order
  INSERT INTO orders (
    id, order_number, customer_id, customer_name_snapshot,
    customer_phone_snapshot, status, subtotal, discount_type,
    discount_value, discount_amount, cgst, sgst, total, notes
  ) VALUES (
    p_order_id, v_order_number, p_customer_id, p_customer_name,
    p_customer_phone, 'CONFIRMED', p_subtotal, p_discount_type,
    p_discount_value, p_discount_amount, p_cgst, p_sgst, p_total, p_notes
  );

  -- STEP 3: Insert order items + deduct stock + log
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

    UPDATE stock
    SET quantity = quantity - (v_item->>'quantity')::INT,
        updated_at = NOW()
    WHERE product_id = (v_item->>'product_id')::UUID;

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
  -- Everything above rolls back automatically
  RETURN jsonb_build_object(
    'success', FALSE,
    'error', SQLERRM
  );
END;
$$;
```

---

## Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE customers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock       ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices    ENABLE ROW LEVEL SECURITY;

-- Authenticated users (shop staff/admin) can do everything
CREATE POLICY "admin_all" ON customers    FOR ALL TO authenticated USING (true);
CREATE POLICY "admin_all" ON products     FOR ALL TO authenticated USING (true);
CREATE POLICY "admin_all" ON stock        FOR ALL TO authenticated USING (true);
CREATE POLICY "admin_all" ON orders       FOR ALL TO authenticated USING (true);
CREATE POLICY "admin_all" ON order_items  FOR ALL TO authenticated USING (true);
CREATE POLICY "admin_all" ON invoices     FOR ALL TO authenticated USING (true);

-- Public can read active products and stock (for future kiosk / menu display)
CREATE POLICY "public_read_products" ON products
  FOR SELECT TO anon USING (is_active = true);
CREATE POLICY "public_read_stock" ON stock
  FOR SELECT TO anon USING (true);
```

---

## Supabase Realtime

Set up once in `useRealtime.js` on app load. Replaces Socket.io entirely.

```js
// 1. Stock changes — updates all POS screens instantly across devices
supabase.channel('stock')
  .on('postgres_changes', {
    event: 'UPDATE', schema: 'public', table: 'stock'
  }, (payload) => {
    stockStore.updateStock(payload.new.product_id, payload.new.quantity)
  }).subscribe()

// 2. New orders — updates dashboard live
supabase.channel('orders')
  .on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'orders'
  }, (payload) => {
    dashboardStore.addOrder(payload.new)
  }).subscribe()
```

> Enable realtime on `stock` and `orders` tables in Supabase Dashboard → Database → Replication.

---

## Node.js Backend (PDF only)

### Single Endpoint
```
POST /api/generate-invoice
```

### Request Body
```json
{
  "order_id": "uuid",
  "invoice_number": "INV-20240315-0042",
  "order_number": "ORD-20240315-0042",
  "shop_name": "Shivang Ice Cream",
  "shop_address": "123 MG Road, Indore",
  "shop_phone": "+91-9876543210",
  "customer_name": "Rahul Sharma",
  "customer_phone": "9876543210",
  "customer_address": "456 Main Street",
  "items": [
    { "name": "Choco Bar", "quantity": 2, "unit_price": 30, "subtotal": 60 }
  ],
  "subtotal": 85,
  "discount": 5,
  "cgst": 2,
  "sgst": 2,
  "total": 84,
  "created_at": "2024-03-15T15:45:00Z"
}
```

### What it does
1. Generates PDF using PDFKit with full invoice layout
2. Uploads PDF buffer to Supabase Storage bucket `invoices`  
   Path: `invoices/{invoice_number}.pdf`
3. Updates `invoices` table: `pdf_url = public URL`
4. Returns: `{ pdf_url, success }`

### PDF Layout
```
┌─────────────────────────────────────┐
│  [SHOP LOGO]    SHOP NAME           │
│                 Address | Phone     │
├─────────────────────────────────────┤
│  INVOICE: INV-20240315-0042         │
│  Date: 15 March 2024, 3:45 PM       │
│  Order: ORD-20240315-0042           │
├─────────────────────────────────────┤
│  Bill To:                           │
│  Customer Name                      │
│  Phone | Address                    │
├────────────┬──────┬────────┬────────┤
│ Item       │ Qty  │ Rate   │ Amount │
├────────────┼──────┼────────┼────────┤
│ Choco Bar  │  2   │ ₹30    │ ₹60   │
│ Vanilla    │  1   │ ₹25    │ ₹25   │
├────────────┴──────┴────────┼────────┤
│                   Subtotal │ ₹85   │
│                   Discount │ -₹5   │
│                 CGST 2.5%  │ ₹2    │
│                 SGST 2.5%  │ ₹2    │
│               GRAND TOTAL  │ ₹84   │
└────────────────────────────┴────────┘
│  Thank you for your visit!          │
│  Powered by IceCreamPOS             │
└─────────────────────────────────────┘
```

---

## Frontend Architecture

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Supabase Auth email/password, redirects to POS on success |
| POS | `/` | Main billing screen with multi-tab order management |
| CustomerManager | `/customers` | Search, view, add, edit customers |
| StockManager | `/stock` | Products table, add stock, edit product, new product, stock logs |
| InvoiceHistory | `/invoices` | All invoices with filters, PDF download, reprint |
| Dashboard | `/dashboard` | Revenue cards, 7-day bar chart, category pie chart, low stock alerts |

### POS Screen Layout
```
[Tab Bar: Order 1 ₹150 | Order 2 ₹80 | + New Order]
┌──────────────────────┬──────────────────────┐
│  Product Grid (60%)  │   Cart / Order (40%) │
│                      │                      │
│  [Search bar]        │  Customer Section:   │
│  [Category tabs]     │  - Search by phone   │
│                      │  - Or type name      │
│  Product cards:      │  - Optional          │
│  Image | Name        │                      │
│  Price | Stock       │  Cart Items:         │
│  [Add] button        │  Item | Qty | Price  │
│                      │  [+] [-] buttons     │
│                      │                      │
│                      │  Discount field      │
│                      │  Tax breakdown       │
│                      │  Total               │
│                      │                      │
│                      │  [Save Bill]         │
│                      │  [Print & Save]      │
└──────────────────────┴──────────────────────┘
```

**Multi-tab rules:**
- Max 5 simultaneous order tabs
- Each tab has isolated cart state in Zustand
- Tab label: `"Order 1 — ₹150"` (running total shown)
- Closing a tab clears that cart (with confirmation if cart not empty)

**Customer Section behavior:**
- Type phone → auto-search existing customers via Supabase
- Found: show name, address, past order count
- Not found: show inline "New Customer" form (name + phone)
- Customer is always **optional** — can bill walk-in without it

---

## Zustand Store Structure

```js
// authStore.js
{
  user: null,
  session: null,
  login(email, password): Promise,
  logout(): Promise
}

// productStore.js
{
  products: [],
  fetchProducts(): Promise,
  updateProduct(id, data): Promise,
  addProduct(data): Promise
}

// stockStore.js
{
  stockMap: { [productId]: quantity },
  fetchStock(): Promise,
  updateStock(productId, quantity): void   // called by realtime hook
}

// orderStore.js
{
  tabs: [
    {
      id: string,
      label: string,
      cart: [{ product, quantity, unit_price, subtotal }],
      customerId: string | null,
      customerName: string,
      customerPhone: string,
      discountType: 'FLAT' | 'PERCENT' | null,
      discountValue: number,
      discountAmount: number,
      total: number
    }
  ],
  activeTabId: string,
  addTab(): void,
  removeTab(tabId): void,
  setActiveTab(tabId): void,
  addToCart(tabId, product): void,
  removeFromCart(tabId, productId): void,
  updateQty(tabId, productId, qty): void,
  setCustomer(tabId, customer): void,
  setDiscount(tabId, type, value): void,
  clearCart(tabId): void
}

// customerStore.js
{
  customers: [],
  searchResults: [],
  fetchCustomers(): Promise,
  searchByPhone(phone): Promise,
  addCustomer(data): Promise,
  updateCustomer(id, data): Promise
}

// invoiceStore.js
{
  invoices: [],
  fetchInvoices(filters): Promise,
  generateAndSave(orderData): Promise,   // calls Node backend
  printInvoice(invoiceId): Promise
}
```

---

## Billing Flow (Exact Sequence)

User clicks **[Print & Save]** or **[Save Bill]**:

```
1. Frontend validates: cart not empty, quantities > 0

2. Generate order UUID: crypto.randomUUID()

3. Show loading spinner on button (disable button to prevent double-submit)

4. Call Supabase RPC: confirm_order({ ...all params })
   ↓
   ├── ERROR: message contains "INSUFFICIENT_STOCK"
   │     → Parse product name and available qty from error
   │     → Toast: "Only X units of [Product] left"
   │     → Re-fetch stock from DB to update display
   │     → Keep cart intact
   │
   └── SUCCESS: { order_number, invoice_number, order_id }
         ↓
         5. Call Node backend: POST /api/generate-invoice
            (pass all order data for PDF generation)
            ↓
            ├── PDF FAILED:
            │     → Toast (warning, not error):
            │       "Bill saved. PDF failed — retry from Invoice History"
            │     → Still proceed to step 6
            │
            └── PDF SUCCESS: { pdf_url }
                  → If "Print & Save": window.open(pdf_url) → browser print dialog
                  → If "Save Bill": toast with invoice number

         6. Clear that tab's cart

         7. If new customer was entered (no customerId):
               → Check if phone exists via customerStore.searchByPhone()
               → If not found: create new customer record
               → Link customerId to nothing (already snapshotted in order)

         8. Toast: "Bill saved — INV-20240315-0042"
```

**Critical rule:** PDF and DB are decoupled. RPC always runs first. PDF failure is non-fatal.

---

## Error Handling Rules

| Error Code | User-facing Toast |
|------------|-------------------|
| `INSUFFICIENT_STOCK` | "Only {X} units of {Product} left" |
| `NETWORK_ERROR` | "Check internet connection and retry" |
| `AUTH_ERROR` | Redirect to `/login` |
| `STOCK_NEGATIVE` | "Cannot deduct — stock would go below 0" |
| `DUPLICATE_ORDER` | "Order already processed, refresh page" |
| `PDF_FAILED` | "Bill saved but PDF failed. Retry from Invoice History" |

---

## Environment Variables

### Frontend — `.env.local`
```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5c...
VITE_API_URL=http://localhost:4000
```

### Backend — `.env`
```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5c...   # NOT anon key
PORT=4000
SHOP_NAME=Shivang Ice Cream
SHOP_ADDRESS=123 MG Road, Indore, MP - 452001
SHOP_PHONE=+91-9876543210
```

> **Security note:** `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — never expose it to the frontend. It is only used in the Node.js backend to upload PDFs to storage and update invoice records.

---

## Seed Data

15 sample ice cream products across 5 categories with Indian pricing and 50 units initial stock each:

| # | Name | Category | Price (₹) |
|---|------|----------|-----------|
| 1 | Plain Cone | Cones | 15 |
| 2 | Choco Cone | Cones | 25 |
| 3 | Waffle Cone | Cones | 35 |
| 4 | Mango Dolly | Bars | 20 |
| 5 | Chocobar | Bars | 30 |
| 6 | Kulfi Stick | Bars | 40 |
| 7 | Vanilla Cup | Cups | 30 |
| 8 | Mix Fruit Cup | Cups | 35 |
| 9 | Single Scoop | Scoops | 40 |
| 10 | Double Scoop | Scoops | 70 |
| 11 | Triple Scoop | Scoops | 100 |
| 12 | Chocolate Sundae | Specials | 120 |
| 13 | Falooda | Specials | 90 |
| 14 | Strawberry Shake | Specials | 80 |
| 15 | Butterscotch Shake | Specials | 80 |

---

## Build Phases & Checklist

### Phase 1 — Supabase Setup
- [ ] Create all tables (`001_schema.sql`)
- [ ] Create `confirm_order()` RPC function (`002_rpc.sql`)
- [ ] Enable Realtime on `stock` and `orders` tables (`004_realtime.sql`)
- [ ] Set up all RLS policies (`003_rls.sql`)
- [ ] Create Storage bucket `invoices` (set to public)
- [ ] Create admin user via Supabase Auth dashboard
- [ ] Insert seed data (`005_seed.sql`)

### Phase 2 — Node.js Backend
- [ ] `package.json` with express, pdfkit, @supabase/supabase-js, dotenv, cors
- [ ] `server.js` — Express setup with CORS, JSON middleware, routes
- [ ] `middleware/errorHandler.js`
- [ ] `services/pdf.service.js` — full PDFKit invoice layout with ₹ symbol
- [ ] `services/storage.service.js` — upload PDF buffer to Supabase Storage
- [ ] `routes/invoice.routes.js` — POST /api/generate-invoice
- [ ] `.env` file template

### Phase 3 — Frontend Foundation
- [ ] Vite + React + Tailwind setup
- [ ] `services/supabase.js` — Supabase client init
- [ ] `services/api.js` — Axios instance pointing to Node backend
- [ ] Login page with Supabase Auth
- [ ] Protected route wrapper
- [ ] All 6 Zustand stores
- [ ] `hooks/useRealtime.js`
- [ ] `App.jsx` with React Router + protected routes
- [ ] `components/shared/Navbar.jsx` and `Sidebar.jsx`

### Phase 4 — POS Screen
- [ ] `ProductGrid.jsx` — product cards with search + category filter
- [ ] `ProductCard.jsx` — image, name, price, stock badge, Add button
- [ ] `OrderTabs.jsx` — multi-tab with max 5, running totals
- [ ] `OrderCart.jsx` — items list with +/- quantity controls
- [ ] `CustomerSearch.jsx` — phone lookup, new customer inline form
- [ ] `DiscountInput.jsx` — flat vs percent toggle
- [ ] `BillSummary.jsx` — subtotal, discount, CGST, SGST, total
- [ ] Save Bill flow (full end-to-end)
- [ ] Print & Save flow (full end-to-end)

### Phase 5 — Customer Manager
- [ ] Customer list with search by name/phone
- [ ] `CustomerCard.jsx` — stats + last 5 bills
- [ ] `CustomerOrderHistory.jsx` — full order history modal
- [ ] Add new customer form
- [ ] Edit customer details

### Phase 6 — Stock Manager
- [ ] `StockTable.jsx` — product | category | price | stock | status
- [ ] `AddStockModal.jsx` — select product, quantity, note
- [ ] `EditProductModal.jsx` — name, price, category, image upload
- [ ] Add New Product form
- [ ] Low stock highlight (red when below threshold)
- [ ] Stock history log (last 50 changes)

### Phase 7 — Invoice History + Dashboard
- [ ] Invoice list table with date, invoice#, customer, total
- [ ] Date range + customer + amount filters
- [ ] Download PDF + Reprint buttons
- [ ] View Details modal (full order breakdown)
- [ ] Dashboard: Today's revenue, orders, items sold, customers served cards
- [ ] Bar chart: Revenue last 7 days (Recharts)
- [ ] Pie chart: Sales by category today (Recharts)
- [ ] Top 5 selling products today panel
- [ ] Low stock alerts panel
- [ ] Last 5 transactions (live via Realtime)

### Phase 8 — Production Polish
- [ ] Error boundaries on all pages
- [ ] Loading skeletons
- [ ] Empty states (no products, no orders, etc.)
- [ ] Mobile/tablet responsive layout
- [ ] Favicon and `<title>IceCream POS</title>`
- [ ] Double-submit prevention on all forms
- [ ] Confirm dialog before closing a non-empty order tab

---

## Implementation Status

| Phase | Status |
|-------|--------|
| Phase 1 — Supabase Setup | ⏳ Pending |
| Phase 2 — Node.js Backend | ⏳ Pending |
| Phase 3 — Frontend Foundation | ⏳ Pending |
| Phase 4 — POS Screen | ⏳ Pending |
| Phase 5 — Customer Manager | ⏳ Pending |
| Phase 6 — Stock Manager | ⏳ Pending |
| Phase 7 — Invoice History + Dashboard | ⏳ Pending |
| Phase 8 — Production Polish | ⏳ Pending |

---

*Last updated: March 8, 2026*
