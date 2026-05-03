import { create } from "zustand";
import { supabase } from "../services/supabase";
import {
  generateInvoicePdf,
  hydrateReceiptPayload,
  printReceipt,
  toReceiptPayloadFromInvoice,
} from "../services/invoiceService";

function sortInvoices(invoices = []) {
  return [...invoices].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function normalizeInvoices(invoices = []) {
  return invoices.map((invoice) => ({
    ...invoice,
    orders: invoice.orders
      ? {
          customer_address_snapshot: "",
          payment_method: "CASH",
          ...invoice.orders,
        }
      : invoice.orders,
  }));
}

export const useInvoiceStore = create((set, get) => ({
  invoices: [],
  loading: false,

  fetchInvoices: async () => {
    set({ loading: true });
    const fullQuery = await supabase
      .from("invoices")
      .select(
        `
          *,
          orders (
            id,
            order_number,
            customer_name_snapshot,
            customer_phone_snapshot,
            customer_address_snapshot,
            payment_method,
            subtotal,
            discount_amount,
            cgst,
            sgst,
            total,
            created_at,
            order_items (
              product_name_snapshot,
              quantity,
              unit_price,
              subtotal
            )
          )
        `,
      )
      .order("created_at", { ascending: false });

    let data = fullQuery.data;
    let error = fullQuery.error;

    if (error) {
      const fallbackQuery = await supabase
        .from("invoices")
        .select(
          `
            *,
            orders (
              id,
              order_number,
              customer_name_snapshot,
              customer_phone_snapshot,
              subtotal,
              discount_amount,
              cgst,
              sgst,
              total,
              created_at,
              order_items (
                product_name_snapshot,
                quantity,
                unit_price,
                subtotal
              )
            )
          `,
        )
        .order("created_at", { ascending: false });

      data = fallbackQuery.data;
      error = fallbackQuery.error;
    }

    set({ loading: false });
    if (error) throw error;
    set({ invoices: sortInvoices(normalizeInvoices(data ?? [])) });
  },

  generateAndSave: async (payload) => {
    const data = await generateInvoicePdf(payload);
    return data;
  },

  printInvoice: async (invoice) => {
    const printableReceipt = await hydrateReceiptPayload(toReceiptPayloadFromInvoice(invoice));
    printReceipt(printableReceipt);
    await supabase.from("invoices").update({ printed: true }).eq("id", invoice.id);
  },

  upsertInvoice: (payload) => {
    const current = get().invoices;
    const exists = current.some((invoice) => invoice.id === payload.id);
    const invoices = exists
      ? current.map((invoice) => (invoice.id === payload.id ? { ...invoice, ...payload } : invoice))
      : [...current, payload];

    set({ invoices: sortInvoices(invoices) });
  },

  removeInvoice: (invoiceId) => {
    set({
      invoices: get().invoices.filter((invoice) => invoice.id !== invoiceId),
    });
  },
}));
