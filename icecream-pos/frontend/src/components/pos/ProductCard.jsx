import { formatCurrency } from "../../utils/formatters";

export default function ProductCard({ product, stockQty, onAdd }) {
  const isOutOfStock = stockQty <= 0 || !product.is_active;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="mb-3 h-24 rounded-xl bg-gradient-to-br from-brand-100 to-accent-100 p-2">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full rounded-lg object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg bg-white/70 text-xs font-bold text-slate-500">
            {product.category}
          </div>
        )}
      </div>
      <p className="truncate text-sm font-bold text-slate-900">{product.name}</p>
      <p className="text-xs text-slate-500">{product.category}</p>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm font-bold text-brand-700">{formatCurrency(product.price)}</p>
        <span
          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
            stockQty <= 5
              ? "bg-red-100 text-red-700"
              : stockQty <= 12
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
          }`}
        >
          Stock: {stockQty}
        </span>
      </div>
      <button
        type="button"
        disabled={isOutOfStock}
        onClick={() => onAdd(product)}
        className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
      >
        {isOutOfStock ? "Unavailable" : "Add"}
      </button>
    </div>
  );
}
