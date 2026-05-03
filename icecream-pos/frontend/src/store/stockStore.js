import { create } from "zustand";
import { supabase } from "../services/supabase";

function mapByProductId(rows = []) {
  return rows.reduce((acc, row) => {
    acc[row.product_id] = row.quantity;
    return acc;
  }, {});
}

export const useStockStore = create((set, get) => ({
  stockRows: [],
  stockMap: {},
  loading: false,

  fetchStock: async () => {
    set({ loading: true });
    const { data, error } = await supabase.from("stock").select("*").order("updated_at", { ascending: false });
    set({ loading: false });
    if (error) throw error;
    const rows = data ?? [];
    set({
      stockRows: rows,
      stockMap: mapByProductId(rows),
    });
  },

  updateStock: (productId, quantity) => {
    const map = { ...get().stockMap, [productId]: Number(quantity) };
    const rows = get().stockRows.map((row) =>
      row.product_id === productId ? { ...row, quantity: Number(quantity) } : row,
    );
    set({ stockMap: map, stockRows: rows });
  },

  upsertStockRow: (row) => {
    const current = get().stockRows;
    const exists = current.some((item) => item.product_id === row.product_id);
    const stockRows = exists
      ? current.map((item) => (item.product_id === row.product_id ? row : item))
      : [row, ...current];
    set({
      stockRows,
      stockMap: mapByProductId(stockRows),
    });
  },

  removeStockRow: (productId) => {
    const stockRows = get().stockRows.filter((item) => item.product_id !== productId);
    set({
      stockRows,
      stockMap: mapByProductId(stockRows),
    });
  },
}));
