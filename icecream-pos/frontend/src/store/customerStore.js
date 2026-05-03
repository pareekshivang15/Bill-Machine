import { create } from "zustand";
import { supabase } from "../services/supabase";

function sortCustomers(customers = []) {
  return [...customers].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

export const useCustomerStore = create((set, get) => ({
  customers: [],
  searchResults: [],
  loading: false,

  fetchCustomers: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("updated_at", { ascending: false });
    set({ loading: false });
    if (error) throw error;
    set({ customers: sortCustomers(data ?? []) });
  },

  searchByPhone: async (phone) => {
    const cleanPhone = String(phone || "").trim();
    if (!cleanPhone) {
      set({ searchResults: [] });
      return [];
    }
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("phone", cleanPhone)
      .limit(10)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    set({ searchResults: data ?? [] });
    return data ?? [];
  },

  searchByTerm: async (term) => {
    const query = String(term || "").trim();
    if (!query) {
      set({ searchResults: [] });
      return [];
    }

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%`)
      .order("updated_at", { ascending: false })
      .limit(30);

    if (error) throw error;
    set({ searchResults: data ?? [] });
    return data ?? [];
  },

  addCustomer: async (payload) => {
    const { data, error } = await supabase.from("customers").insert(payload).select("*").single();
    if (error) throw error;
    get().upsertCustomer(data);
    return data;
  },

  updateCustomer: async (customerId, payload) => {
    const { data, error } = await supabase
      .from("customers")
      .update(payload)
      .eq("id", customerId)
      .select("*")
      .single();
    if (error) throw error;
    get().upsertCustomer(data);
    return data;
  },

  upsertCustomer: (payload) => {
    const current = get().customers;
    const exists = current.some((customer) => customer.id === payload.id);
    const customers = exists
      ? current.map((customer) => (customer.id === payload.id ? payload : customer))
      : [...current, payload];

    const nextSearchResults = get().searchResults.some((customer) => customer.id === payload.id)
      ? get().searchResults.map((customer) => (customer.id === payload.id ? payload : customer))
      : get().searchResults;

    set({
      customers: sortCustomers(customers),
      searchResults: sortCustomers(nextSearchResults),
    });
  },

  removeCustomer: (customerId) => {
    set({
      customers: get().customers.filter((customer) => customer.id !== customerId),
      searchResults: get().searchResults.filter((customer) => customer.id !== customerId),
    });
  },
}));
