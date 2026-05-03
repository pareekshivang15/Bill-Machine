import { useEffect } from "react";
import { supabase } from "../services/supabase";
import { useProductStore } from "../store/productStore";
import { useCustomerStore } from "../store/customerStore";
import { useStockStore } from "../store/stockStore";
import { useInvoiceStore } from "../store/invoiceStore";
import { useDashboardStore } from "../store/dashboardStore";

export function useRealtime() {
  useEffect(() => {
    const catalogChannel = supabase
      .channel("catalog-and-customers")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            useProductStore.getState().removeProduct(payload.old.id);
            return;
          }
          useProductStore.getState().upsertProduct(payload.new);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "customers",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            useCustomerStore.getState().removeCustomer(payload.old.id);
            return;
          }
          useCustomerStore.getState().upsertCustomer(payload.new);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stock",
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            useStockStore.getState().removeStockRow(payload.old.product_id);
            return;
          }
          useStockStore.getState().upsertStockRow(payload.new);
        },
      )
      .subscribe();

    const salesChannel = supabase
      .channel("sales")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          useDashboardStore.getState().addOrder(payload.new);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "invoices",
        },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            useInvoiceStore.getState().removeInvoice(payload.old.id);
            return;
          }

          // InvoiceHistory renders joined order/item data, so refresh that store on invoice mutations.
          await useInvoiceStore.getState().fetchInvoices();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(catalogChannel);
      supabase.removeChannel(salesChannel);
    };
  }, []);
}
