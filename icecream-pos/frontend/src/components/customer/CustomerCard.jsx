import { formatCurrency, formatDate } from "../../utils/formatters";

export default function CustomerCard({ customer, recentOrders, onEdit, onReprint, onViewHistory }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{customer.name}</h3>
          <p className="text-sm text-slate-600">{customer.phone || "-"}</p>
          <p className="text-xs text-slate-500">{customer.address || "No address"}</p>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Edit
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-slate-600 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-xs text-slate-500">Total Orders</p>
          <p className="text-base font-bold text-slate-900">{customer.total_orders || 0}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-xs text-slate-500">Total Spent</p>
          <p className="text-base font-bold text-slate-900">{formatCurrency(customer.total_spent || 0)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-xs text-slate-500">Member Since</p>
          <p className="text-base font-bold text-slate-900">{formatDate(customer.created_at)}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-900">Last 5 Bills</p>
          <button
            type="button"
            onClick={onViewHistory}
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            View Full History
          </button>
        </div>
        {recentOrders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 py-5 text-center text-xs text-slate-500">
            No bills yet
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs">
                <div>
                  <p className="font-semibold text-slate-800">{order.order_number}</p>
                  <p className="text-slate-500">{formatDate(order.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{formatCurrency(order.total)}</span>
                  <button
                    type="button"
                    onClick={() => onReprint(order)}
                    className="rounded-md bg-brand-600 px-2 py-1 font-semibold text-white"
                  >
                    Reprint
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
