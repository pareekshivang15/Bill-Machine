import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import StockTable from "../components/stock/StockTable";
import AddStockModal from "../components/stock/AddStockModal";
import EditProductModal from "../components/stock/EditProductModal";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import LoadingSkeleton from "../components/shared/LoadingSkeleton";
import { useProductStore } from "../store/productStore";
import { useStockStore } from "../store/stockStore";
import { supabase } from "../services/supabase";
import { formatDateTime } from "../utils/formatters";

export default function StockManager() {
  const { products, fetchProducts, addProduct, updateProduct } = useProductStore();
  const { stockRows, fetchStock, upsertStockRow } = useStockStore();
  const [selectedStockRow, setSelectedStockRow] = useState(null);
  const [editingStockRow, setEditingStockRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stockLogs, setStockLogs] = useState([]);
  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    price: "",
    image_url: "",
    initial_stock: "50",
    low_threshold: "10",
  });

  const rows = useMemo(() => {
    return products.map((product) => {
      const stock = stockRows.find((item) => item.product_id === product.id);
      return {
        ...product,
        product_id: product.id,
        quantity: stock?.quantity ?? 0,
        low_threshold: stock?.low_threshold ?? 10,
        stock_id: stock?.id ?? null,
      };
    });
  }, [products, stockRows]);

  const loadStockLogs = async () => {
    const { data, error } = await supabase
      .from("stock_logs")
      .select("id, product_id, change_type, quantity_delta, reason, created_at, products(name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Unable to load stock logs");
      return;
    }
    setStockLogs(data || []);
  };

  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([fetchProducts(), fetchStock(), loadStockLogs()]);
      } catch {
        toast.error("Unable to load stock manager");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fetchProducts, fetchStock]);

  const handleAddStock = async ({ quantity, reason }) => {
    if (!selectedStockRow) return;
    try {
      setSaving(true);
      const nextQty = Number(selectedStockRow.quantity) + Number(quantity);
      const { data: updatedStock, error: stockError } = await supabase
        .from("stock")
        .update({
          quantity: nextQty,
          updated_at: new Date().toISOString(),
        })
        .eq("product_id", selectedStockRow.product_id)
        .select("*")
        .single();
      if (stockError) throw stockError;

      const { error: logError } = await supabase.from("stock_logs").insert({
        product_id: selectedStockRow.product_id,
        change_type: "ADD",
        quantity_delta: Number(quantity),
        reason: reason || "Manual stock add",
      });
      if (logError) throw logError;

      upsertStockRow(updatedStock);
      await loadStockLogs();
      toast.success("Stock added");
      setSelectedStockRow(null);
    } catch {
      toast.error("Failed to add stock");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProduct = async (payload) => {
    try {
      setSaving(true);
      await updateProduct(editingStockRow.product_id, payload);
      toast.success("Product updated");
      setEditingStockRow(null);
    } catch {
      toast.error("Unable to update product");
    } finally {
      setSaving(false);
    }
  };

  const handleAddProduct = async (event) => {
    event.preventDefault();
    let insertedProduct = null;
    try {
      setSaving(true);
      insertedProduct = await addProduct({
        name: newProduct.name.trim(),
        category: newProduct.category.trim(),
        price: Number(newProduct.price),
        image_url: newProduct.image_url.trim() || null,
        is_active: true,
      });

      const { data: insertedStock, error: stockError } = await supabase
        .from("stock")
        .insert({
          product_id: insertedProduct.id,
          quantity: Number(newProduct.initial_stock || 0),
          low_threshold: Number(newProduct.low_threshold || 10),
        })
        .select("*")
        .single();
      if (stockError) throw stockError;

      const { error: logError } = await supabase.from("stock_logs").insert({
        product_id: insertedProduct.id,
        change_type: "ADD",
        quantity_delta: Number(newProduct.initial_stock || 0),
        reason: "Initial stock for new product",
      });
      if (logError) throw logError;

      upsertStockRow(insertedStock);
      await loadStockLogs();
      setNewProduct({
        name: "",
        category: "",
        price: "",
        image_url: "",
        initial_stock: "50",
        low_threshold: "10",
      });
      toast.success("New product added");
    } catch {
      if (insertedProduct?.id) {
        await supabase.from("products").delete().eq("id", insertedProduct.id);
        await fetchProducts();
      }
      toast.error("Unable to add product");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <LoadingSpinner label="Loading stock manager..." />
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-bold text-slate-900">Add New Product</h2>
        <form onSubmit={handleAddProduct} className="grid grid-cols-1 gap-2 lg:grid-cols-6">
          <input
            required
            placeholder="Name"
            value={newProduct.name}
            onChange={(event) => setNewProduct((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            required
            placeholder="Category"
            value={newProduct.category}
            onChange={(event) => setNewProduct((prev) => ({ ...prev, category: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            required
            type="number"
            min="0"
            step="0.01"
            placeholder="Price"
            value={newProduct.price}
            onChange={(event) => setNewProduct((prev) => ({ ...prev, price: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            placeholder="Image URL"
            value={newProduct.image_url}
            onChange={(event) => setNewProduct((prev) => ({ ...prev, image_url: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            type="number"
            min="0"
            placeholder="Initial Stock"
            value={newProduct.initial_stock}
            onChange={(event) => setNewProduct((prev) => ({ ...prev, initial_stock: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            type="number"
            min="1"
            placeholder="Low Threshold"
            value={newProduct.low_threshold}
            onChange={(event) => setNewProduct((prev) => ({ ...prev, low_threshold: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 lg:col-span-6"
          >
            {saving ? "Saving..." : "Add New Product"}
          </button>
        </form>
      </section>

      <section>
        <StockTable rows={rows} onAddStock={setSelectedStockRow} onEditProduct={setEditingStockRow} />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-lg font-bold text-slate-900">Stock History (Last 50)</h3>
        {stockLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
            No stock changes yet.
          </div>
        ) : (
          <div className="space-y-2">
            {stockLogs.map((log) => (
              <div key={log.id} className="rounded-lg bg-slate-50 p-2 text-xs">
                <p className="font-semibold text-slate-900">
                  {log.products?.name || "Unknown Product"} - {log.change_type} ({log.quantity_delta})
                </p>
                <p className="text-slate-600">{log.reason || "No reason"}</p>
                <p className="text-slate-500">{formatDateTime(log.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      <AddStockModal
        open={Boolean(selectedStockRow)}
        product={selectedStockRow}
        onClose={() => setSelectedStockRow(null)}
        onSubmit={handleAddStock}
        loading={saving}
      />

      <EditProductModal
        open={Boolean(editingStockRow)}
        product={editingStockRow}
        onClose={() => setEditingStockRow(null)}
        onSubmit={handleSaveProduct}
        loading={saving}
      />
    </div>
  );
}
