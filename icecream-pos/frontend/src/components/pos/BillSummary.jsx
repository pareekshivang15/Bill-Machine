import { formatCurrency } from "../../utils/formatters";

const PAYMENT_OPTIONS = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "ONLINE", label: "Online" },
];

export default function BillSummary({ tab, busy, onSave, onPrintAndSave, onPaymentMethodChange }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h3 className="mb-3 text-sm font-bold text-slate-900">Bill Summary</h3>
      <div className="mb-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Payment Mode</p>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onPaymentMethodChange(option.value)}
              className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                tab.paymentMethod === option.value
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between text-slate-600">
          <span>Subtotal</span>
          <span>{formatCurrency(tab.subtotal || 0)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span>Discount</span>
          <span>- {formatCurrency(tab.discountAmount || 0)}</span>
        </div>
        <div className="flex items-center justify-between text-slate-600">
          <span>Total Qty</span>
          <span>{tab.cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</span>
        </div>
      </div>
      <div className="mt-3 border-t border-slate-200 pt-3">
        <div className="flex items-center justify-between text-base font-bold text-slate-900">
          <span>Total</span>
          <span>{formatCurrency(tab.total || 0)}</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Save Bill"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onPrintAndSave}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {busy ? "Saving..." : "Print Receipt"}
        </button>
      </div>
    </div>
  );
}
