import { useEffect, useState } from "react";
import Modal from "../shared/Modal";

export default function EditProductModal({ open, product, onClose, onSubmit, loading }) {
  const [form, setForm] = useState({
    name: "",
    category: "",
    price: "",
    image_url: "",
    is_active: true,
  });

  useEffect(() => {
    setForm({
      name: product?.name || "",
      category: product?.category || "",
      price: product?.price || "",
      image_url: product?.image_url || "",
      is_active: Boolean(product?.is_active),
    });
  }, [product]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      price: Number(form.price),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={`Edit Product - ${product?.name || ""}`} width="max-w-md">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
        />
        <input
          placeholder="Category"
          value={form.category}
          onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
        />
        <input
          type="number"
          min="0"
          placeholder="Price"
          value={form.price}
          onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
        />
        <input
          placeholder="Image URL"
          value={form.image_url}
          onChange={(event) => setForm((prev) => ({ ...prev, image_url: event.target.value }))}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
          />
          Active Product
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </Modal>
  );
}
