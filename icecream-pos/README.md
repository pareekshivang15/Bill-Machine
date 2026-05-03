# IceCream POS

This repository currently contains:

- Phase 1: Supabase SQL setup (schema, transactional RPC, RLS, realtime, storage bucket)
- Phase 2: Node.js + Express backend for PDF invoice generation and Supabase Storage upload
- Phase 3 to Phase 8: Full React + Tailwind frontend (auth, POS, customers, stock, invoices, dashboard, responsive/error states)

## Structure

```text
icecream-pos/
  backend/
  frontend/
  supabase/sql/
```

## Phase 1: Supabase setup

Run these SQL files in order in the Supabase SQL Editor:

1. `supabase/sql/001_schema.sql`
2. `supabase/sql/002_confirm_order.sql`
3. `supabase/sql/003_rls_realtime_storage.sql`

Do not run `supabase/sql/seed.sql` if you want a real production setup without sample products or fake stock.

Manual dashboard tasks:

- Create one admin user in Supabase Auth (email/password).
- Confirm bucket `invoices` exists and is public (SQL script already creates/updates it).

## Backend setup

1. Go to backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy env file and fill values:
   ```bash
   cp .env.example .env
   ```
   Required values in `backend/.env`:
   ```env
   SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   SHOP_NAME=Your real shop name
   SHOP_ADDRESS=Your real shop address
   SHOP_PHONE=Your real shop phone
   PORT=4000
   ```
4. Start server:
   ```bash
   npm run dev
   ```

Server starts on `http://localhost:4000` by default.

## Frontend setup

1. Go to frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Fill `frontend/.env.local`:
   ```env
   VITE_SUPABASE_URL=
   VITE_SUPABASE_ANON_KEY=
   VITE_API_URL=http://localhost:4000
   ```
4. Start frontend:
   ```bash
   npm run dev
   ```

Frontend starts on `http://localhost:5173` by default.

## Implemented Screens

- Login (Supabase email/password)
- POS / Billing with multi-tabs, cart, customer lookup, discount/tax, save and print flow
- Customer Manager with search, add/edit, recent bills and full history modal
- Stock Manager with add stock, edit product, add new product, low stock highlight, stock logs
- Invoice History with filters, PDF download, reprint, details modal, retry PDF generation
- Dashboard with cards, bar chart, pie chart, top products, low stock alerts, live transactions

## Endpoint

`POST /api/generate-invoice`

Body:

```json
{
  "order_id": "uuid",
  "invoice_number": "INV-20240315-0042",
  "order_number": "ORD-20240315-0042",
  "shop_name": "Your real shop name",
  "shop_address": "Your real shop address",
  "shop_phone": "Your real shop phone",
  "customer_name": "Customer name",
  "customer_phone": "Customer phone",
  "customer_address": "Customer address",
  "items": [
    {
      "product_name": "Choco Bar",
      "quantity": 2,
      "unit_price": 30,
      "subtotal": 60
    }
  ],
  "subtotal": 60,
  "discount": 0,
  "cgst": 1.5,
  "sgst": 1.5,
  "total": 63,
  "created_at": "2026-03-08T15:30:00.000Z"
}
```

Success response:

```json
{
  "success": true,
  "pdf_url": "https://.../storage/v1/object/public/invoices/invoices/INV-20240315-0042.pdf"
}
```
