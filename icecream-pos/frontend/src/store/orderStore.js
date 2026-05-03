import { create } from "zustand";
import { getBillTotals } from "../utils/calculations";

const MAX_TABS = 5;

function newTab(index) {
  return {
    id: crypto.randomUUID(),
    label: `Order ${index}`,
    cart: [],
    customerId: null,
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    notes: "",
    paymentMethod: "CASH",
    discountType: "FLAT",
    discountValue: 0,
  };
}

function withTotals(tab) {
  const totals = getBillTotals(tab.cart, tab.discountType, tab.discountValue);
  return {
    ...tab,
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    cgst: totals.cgst,
    sgst: totals.sgst,
    total: totals.total,
  };
}

function mutateTab(tabs, tabId, mutator) {
  return tabs.map((tab) => (tab.id === tabId ? withTotals(mutator(tab)) : withTotals(tab)));
}

export const useOrderStore = create((set, get) => {
  const initialTab = withTotals(newTab(1));
  return {
    tabs: [initialTab],
    activeTabId: initialTab.id,

    addTab: () => {
      const tabs = get().tabs;
      if (tabs.length >= MAX_TABS) {
        throw new Error("Maximum 5 order tabs allowed");
      }
      const next = withTotals(newTab(tabs.length + 1));
      set({
        tabs: [...tabs, next],
        activeTabId: next.id,
      });
    },

    removeTab: (tabId) => {
      const tabs = get().tabs;
      const filtered = tabs.filter((tab) => tab.id !== tabId);
      if (filtered.length === 0) {
        const replacement = withTotals(newTab(1));
        set({ tabs: [replacement], activeTabId: replacement.id });
        return;
      }
      set({
        tabs: filtered.map(withTotals),
        activeTabId: get().activeTabId === tabId ? filtered[0].id : get().activeTabId,
      });
    },

    setActiveTab: (tabId) => set({ activeTabId: tabId }),

    addToCart: (tabId, product) => {
      set({
        tabs: mutateTab(get().tabs, tabId, (tab) => {
          const index = tab.cart.findIndex((item) => item.product_id === product.id);
          if (index >= 0) {
            const cart = tab.cart.map((item, itemIndex) =>
              itemIndex === index ? { ...item, quantity: item.quantity + 1 } : item,
            );
            return { ...tab, cart };
          }
          return {
            ...tab,
            cart: [
              ...tab.cart,
              {
                product_id: product.id,
                product_name: product.name,
                unit_price: Number(product.price),
                quantity: 1,
                category: product.category,
                image_url: product.image_url,
              },
            ],
          };
        }),
      });
    },

    removeFromCart: (tabId, productId) => {
      set({
        tabs: mutateTab(get().tabs, tabId, (tab) => ({
          ...tab,
          cart: tab.cart.filter((item) => item.product_id !== productId),
        })),
      });
    },

    updateQty: (tabId, productId, quantity) => {
      const safeQty = Math.max(Number(quantity), 0);
      set({
        tabs: mutateTab(get().tabs, tabId, (tab) => {
          if (safeQty === 0) {
            return {
              ...tab,
              cart: tab.cart.filter((item) => item.product_id !== productId),
            };
          }
          return {
            ...tab,
            cart: tab.cart.map((item) =>
              item.product_id === productId ? { ...item, quantity: safeQty } : item,
            ),
          };
        }),
      });
    },

    setCustomer: (tabId, customer) => {
      set({
        tabs: mutateTab(get().tabs, tabId, (tab) => ({
          ...tab,
          customerId: customer?.id ?? null,
          customerName: customer?.name ?? "",
          customerPhone: customer?.phone ?? "",
          customerAddress: customer?.address ?? "",
        })),
      });
    },

    setNotes: (tabId, notes) => {
      set({
        tabs: mutateTab(get().tabs, tabId, (tab) => ({
          ...tab,
          notes,
        })),
      });
    },

    setPaymentMethod: (tabId, paymentMethod) => {
      const safePaymentMethod = ["CASH", "UPI", "CARD", "ONLINE"].includes(paymentMethod)
        ? paymentMethod
        : "CASH";

      set({
        tabs: mutateTab(get().tabs, tabId, (tab) => ({
          ...tab,
          paymentMethod: safePaymentMethod,
        })),
      });
    },

    setDiscount: (tabId, discountType, discountValue) => {
      const safeType = discountType === "PERCENT" ? "PERCENT" : "FLAT";
      const safeValue = Math.max(Number(discountValue || 0), 0);

      set({
        tabs: mutateTab(get().tabs, tabId, (tab) => ({
          ...tab,
          discountType: safeType,
          discountValue: safeValue,
        })),
      });
    },

    clearCart: (tabId) => {
      set({
        tabs: mutateTab(get().tabs, tabId, (tab) => ({
          ...tab,
          cart: [],
          notes: "",
          customerId: null,
          customerName: "",
          customerPhone: "",
          customerAddress: "",
          discountType: "FLAT",
          discountValue: 0,
          paymentMethod: "CASH",
        })),
      });
    },
  };
});
