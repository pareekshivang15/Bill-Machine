import Modal from "../shared/Modal";
import { formatCurrency, formatDateTime } from "../../utils/formatters";

export default function CustomerOrderHistory({ open, customer, orders, onClose, onReprint }) {
  return (
    <Modal open={open} onClose={onClose} title={`Order History - ${customer?.name || ""}`} width="max-w-3xl">
      {orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">
          No orders found for this customer.
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <div key={order.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{order.order_number}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(order.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{formatCurrency(order.total)}</span>
                  <button
                    type="button"
                    onClick={() => onReprint(order)}
                    className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Reprint
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
