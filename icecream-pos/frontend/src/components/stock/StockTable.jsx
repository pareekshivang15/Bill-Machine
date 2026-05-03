import { formatCurrency } from "../../utils/formatters";

export default function StockTable({ rows, onEditProduct, onAddStock }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-500">
        No products found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-semibold">Product</th>
            <th className="px-4 py-3 font-semibold">Category</th>
            <th className="px-4 py-3 font-semibold">Price</th>
            <th className="px-4 py-3 font-semibold">Stock</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isLow = row.quantity <= row.low_threshold;
            return (
              <tr key={row.product_id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                <td className="px-4 py-3 text-slate-600">{row.category}</td>
                <td className="px-4 py-3 text-slate-600">{formatCurrency(row.price)}</td>
                <td className={`px-4 py-3 font-bold ${isLow ? "text-red-600" : "text-slate-700"}`}>
                  {row.quantity}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      row.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {row.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onAddStock(row)}
                      className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      Add Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditProduct(row)}
                      className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Edit
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
