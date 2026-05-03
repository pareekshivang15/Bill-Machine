import { formatCurrency } from "../../utils/formatters";

export default function OrderCart({ tab, onQtyChange, onRemove, onNotesChange }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">Cart Items</h3>
        <p className="text-xs text-slate-500">{tab.cart.length} items</p>
      </div>

      {tab.cart.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
          Cart is empty.
        </div>
      ) : (
        <div className="space-y-2">
          {tab.cart.map((item) => (
            <div key={item.product_id} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.product_name}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(item.unit_price)} each</p>
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {formatCurrency(item.quantity * item.unit_price)}
                </p>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onQtyChange(item.product_id, item.quantity - 1)}
                    className="rounded-md bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700"
                  >
                    -
                  </button>
                  <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onQtyChange(item.product_id, item.quantity + 1)}
                    className="rounded-md bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700"
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(item.product_id)}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <textarea
        value={tab.notes || ""}
        onChange={(event) => onNotesChange(event.target.value)}
        rows={2}
        placeholder="Notes (optional)"
        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
      />
    </div>
  );
}
