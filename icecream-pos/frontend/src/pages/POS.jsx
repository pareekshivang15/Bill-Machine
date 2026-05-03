import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ProductGrid from "../components/pos/ProductGrid";
import OrderTabs from "../components/pos/OrderTabs";
import CustomerSearch from "../components/pos/CustomerSearch";
import OrderCart from "../components/pos/OrderCart";
import DiscountInput from "../components/pos/DiscountInput";
import BillSummary from "../components/pos/BillSummary";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import LoadingSkeleton from "../components/shared/LoadingSkeleton";
import { useProductStore } from "../store/productStore";
import { useStockStore } from "../store/stockStore";
import { useOrderStore } from "../store/orderStore";
import { useCustomerStore } from "../store/customerStore";
import { supabase } from "../services/supabase";
import { generateInvoicePdf, hydrateReceiptPayload, printReceipt } from "../services/invoiceService";

function parseStockError(errorText) {
  if (!errorText?.includes("INSUFFICIENT_STOCK")) return null;
  const match = errorText.match(/INSUFFICIENT_STOCK:(.*) has only (\d+) units available/i);
  if (!match) return null;
  return {
    product: match[1]?.trim() || "this product",
    quantity: Number(match[2] || 0),
  };
}

export default function POS() {
  const { products, loading: productLoading, fetchProducts } = useProductStore();
  const { stockMap, loading: stockLoading, fetchStock } = useStockStore();
  const {
    tabs,
    activeTabId,
    addTab,
    removeTab,
    setActiveTab,
    addToCart,
    removeFromCart,
    updateQty,
    setCustomer,
    setDiscount,
    setNotes,
    setPaymentMethod,
    clearCart,
  } = useOrderStore();
  const { searchByPhone, addCustomer } = useCustomerStore();

  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const [savingMode, setSavingMode] = useState(null);

  useEffect(() => {
    fetchProducts();
    fetchStock();
  }, [fetchProducts, fetchStock]);

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId) || tabs[0], [tabs, activeTabId]);

  const onAddToCart = (product) => {
    const inCart = activeTab.cart.find((item) => item.product_id === product.id)?.quantity || 0;
    const available = stockMap[product.id] ?? 0;
    if (available <= inCart) {
      toast.error(`Only ${available} units of ${product.name} left`);
      return;
    }
    addToCart(activeTab.id, product);
  };

  const onChangeQty = (productId, quantity) => {
    const available = stockMap[productId] ?? 0;
    if (quantity > available) {
      const productName = products.find((product) => product.id === productId)?.name || "item";
      toast.error(`Only ${available} units of ${productName} left`);
      return;
    }
    updateQty(activeTab.id, productId, quantity);
  };

  const checkout = async (mode) => {
    if (savingMode) return;
    if (!activeTab || activeTab.cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    for (const item of activeTab.cart) {
      const available = stockMap[item.product_id] ?? 0;
      if (available <= 0 || item.quantity > available) {
        toast.error(`Only ${available} units of ${item.product_name} left`);
        return;
      }
    }

    const orderId = crypto.randomUUID();
    setSavingMode(mode);

    try {
      const rpcPayload = {
        p_order_id: orderId,
        p_customer_id: activeTab.customerId,
        p_customer_name: activeTab.customerName || null,
        p_customer_phone: activeTab.customerPhone || null,
        p_customer_address: activeTab.customerAddress || null,
        p_payment_method: activeTab.paymentMethod || "CASH",
        p_items: activeTab.cart.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          subtotal: Number((item.unit_price * item.quantity).toFixed(2)),
        })),
        p_subtotal: Number(activeTab.subtotal),
        p_discount_type: activeTab.discountType,
        p_discount_value: Number(activeTab.discountValue || 0),
        p_discount_amount: Number(activeTab.discountAmount || 0),
        p_cgst: 0,
        p_sgst: 0,
        p_total: Number(activeTab.total || 0),
        p_notes: activeTab.notes || null,
      };

      const { data: rpcResult, error: rpcError } = await supabase.rpc("confirm_order", rpcPayload);
      if (rpcError) throw rpcError;

      if (!rpcResult?.success) {
        const parsed = parseStockError(rpcResult?.error);
        if (parsed) {
          toast.error(`Only ${parsed.quantity} units of ${parsed.product} available`);
          await fetchStock();
          return;
        }
        if (rpcResult?.error?.includes("duplicate key")) {
          toast.error("Order already processed, refresh page");
          return;
        }
        throw new Error(rpcResult?.error || "Failed to save order");
      }

      const receiptPayload = {
        order_id: rpcResult.order_id,
        invoice_number: rpcResult.invoice_number,
        order_number: rpcResult.order_number,
        customer_name: activeTab.customerName || "Walk-in Customer",
        customer_phone: activeTab.customerPhone || "",
        customer_address: activeTab.customerAddress || "",
        items: activeTab.cart.map((item) => ({
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          subtotal: Number((item.unit_price * item.quantity).toFixed(2)),
        })),
        subtotal: Number(activeTab.subtotal || 0),
        discount: Number(activeTab.discountAmount || 0),
        total: Number(activeTab.total || 0),
        created_at: new Date().toISOString(),
        payment_method: activeTab.paymentMethod || "CASH",
      };

      try {
        await generateInvoicePdf(receiptPayload);
      } catch (error) {
        toast.error("Bill saved but PDF failed. Retry from Invoice History");
      }

      if (!activeTab.customerId && activeTab.customerName && activeTab.customerPhone) {
        const existing = await searchByPhone(activeTab.customerPhone);
        if (!existing.length) {
          await addCustomer({
            name: activeTab.customerName,
            phone: activeTab.customerPhone,
            address: activeTab.customerAddress || null,
          });
        }
      }

      clearCart(activeTab.id);
      await fetchStock();

      if (mode === "PRINT") {
        try {
          const printableReceipt = await hydrateReceiptPayload(receiptPayload);
          printReceipt(printableReceipt);
          await supabase.from("invoices").update({ printed: true }).eq("invoice_number", rpcResult.invoice_number);
        } catch (error) {
          toast.error(error.message || "Bill saved but receipt print could not start");
        }
      }
      toast.success(`Bill saved - ${rpcResult.invoice_number}`);
    } catch (error) {
      if (error.message?.includes("INSUFFICIENT_STOCK")) {
        const parsed = parseStockError(error.message);
        toast.error(
          parsed
            ? `Only ${parsed.quantity} units of ${parsed.product} left`
            : "Stock changed during billing. Refreshing stock...",
        );
        await fetchStock();
      } else if (error.message?.includes("JWT") || error.message?.includes("Auth")) {
        toast.error("Session expired. Please login again.");
      } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
        toast.error("Check internet connection and retry");
      } else {
        toast.error(error.message || "Unable to save bill");
      }
    } finally {
      setSavingMode(null);
    }
  };

  const handleRemoveTab = (tab) => {
    if (tab.cart.length > 0) {
      const confirmClose = window.confirm("This tab has items. Close and discard this cart?");
      if (!confirmClose) return;
    }
    removeTab(tab.id);
  };

  const handleSearchByPhone = async (phone) => {
    try {
      setSearchingCustomer(true);
      const results = await searchByPhone(phone);
      return results;
    } catch {
      toast.error("Unable to search customer");
      return [];
    } finally {
      setSearchingCustomer(false);
    }
  };

  if (productLoading || stockLoading) {
    return (
      <div className="space-y-3">
        <LoadingSpinner label="Loading POS data..." />
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  if (!activeTab) {
    return <LoadingSpinner label="Preparing order tabs..." />;
  }

  return (
    <div>
      <OrderTabs
        tabs={tabs}
        activeTabId={activeTab.id}
        onSetActive={setActiveTab}
        onAddTab={addTab}
        onRemoveTab={handleRemoveTab}
        maxTabsReached={tabs.length >= 5}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <ProductGrid products={products.filter((product) => product.is_active)} stockMap={stockMap} onAddToCart={onAddToCart} />
        </div>
        <div className="space-y-3 xl:col-span-2">
          <CustomerSearch
            tab={activeTab}
            onApplyCustomer={(customer) => setCustomer(activeTab.id, customer)}
            onSearchByPhone={handleSearchByPhone}
            searching={searchingCustomer}
          />
          <OrderCart
            tab={activeTab}
            onQtyChange={onChangeQty}
            onRemove={(productId) => removeFromCart(activeTab.id, productId)}
            onNotesChange={(notes) => setNotes(activeTab.id, notes)}
          />
          <DiscountInput
            discountType={activeTab.discountType}
            discountValue={activeTab.discountValue}
            onChange={(type, value) => setDiscount(activeTab.id, type, value)}
          />
          <BillSummary
            tab={activeTab}
            busy={Boolean(savingMode)}
            onSave={() => checkout("SAVE")}
            onPrintAndSave={() => checkout("PRINT")}
            onPaymentMethodChange={(paymentMethod) => setPaymentMethod(activeTab.id, paymentMethod)}
          />
        </div>
      </div>
    </div>
  );
}
