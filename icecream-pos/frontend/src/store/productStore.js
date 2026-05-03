import { create } from "zustand";
import { supabase } from "../services/supabase";

function sortProducts(products = []) {
  return [...products]
    .sort((a, b) => a.name.localeCompare(b.name))
    .sort((a, b) => Number(b.is_active) - Number(a.is_active));
}

export const useProductStore = create((set, get) => ({
  products: [],
  loading: false,

  fetchProducts: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("is_active", { ascending: false })
      .order("name", { ascending: true });
    set({ loading: false });
    if (error) throw error;
    set({ products: sortProducts(data ?? []) });
  },

  updateProduct: async (productId, updates) => {
    const { data, error } = await supabase
      .from("products")
      .update(updates)
      .eq("id", productId)
      .select("*")
      .single();
    if (error) throw error;

    const products = get().products.map((product) => (product.id === data.id ? data : product));
    set({ products: sortProducts(products) });
    return data;
  },

  upsertProduct: (payload) => {
    const current = get().products;
    const exists = current.some((product) => product.id === payload.id);
    const products = exists
      ? current.map((product) => (product.id === payload.id ? payload : product))
      : [...current, payload];

    set({ products: sortProducts(products) });
    return payload;
  },

  removeProduct: (productId) => {
    set({
      products: get().products.filter((product) => product.id !== productId),
    });
  },

  addProduct: async (payload) => {
    const { data, error } = await supabase.from("products").insert(payload).select("*").single();
    if (error) throw error;

    get().upsertProduct(data);
    return data;
  },
}));
