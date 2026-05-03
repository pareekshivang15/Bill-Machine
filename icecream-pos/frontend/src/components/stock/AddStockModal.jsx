import { useState } from "react";
import Modal from "../shared/Modal";

export default function AddStockModal({ open, product, onClose, onSubmit, loading }) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const qty = Number(quantity);
    if (!product || !qty || qty <= 0) return;
    await onSubmit({ quantity: qty, reason });
    setQuantity("");
    setReason("");
  };

  return (
    <Modal open={open} onClose={onClose} title={`Add Stock - ${product?.name || ""}`} width="max-w-md">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Quantity</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Note</label>
          <textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="Restock note"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Add Stock"}
        </button>
      </form>
    </Modal>
  );
}
