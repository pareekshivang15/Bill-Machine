import { create } from "zustand";

export const useDashboardStore = create((set, get) => ({
  liveOrders: [],

  addOrder: (order) => {
    const next = [order, ...get().liveOrders.filter((item) => item.id !== order.id)].slice(0, 20);
    set({ liveOrders: next });
  },

  clearLiveOrders: () => set({ liveOrders: [] }),
}));
