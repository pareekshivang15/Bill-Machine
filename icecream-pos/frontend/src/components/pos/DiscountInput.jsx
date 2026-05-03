export default function DiscountInput({ discountType, discountValue, onChange }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-sm font-bold text-slate-900">Discount</p>
      <div className="mb-2 flex gap-2">
        <button
          type="button"
          onClick={() => onChange("FLAT", discountValue)}
          className={`rounded-lg px-3 py-2 text-xs font-semibold ${
            discountType === "FLAT" ? "bg-brand-600 text-white" : "bg-white text-slate-700"
          }`}
        >
          Flat
        </button>
        <button
          type="button"
          onClick={() => onChange("PERCENT", discountValue)}
          className={`rounded-lg px-3 py-2 text-xs font-semibold ${
            discountType === "PERCENT" ? "bg-brand-600 text-white" : "bg-white text-slate-700"
          }`}
        >
          Percent
        </button>
      </div>
      <input
        value={discountValue}
        onChange={(event) => onChange(discountType, event.target.value)}
        type="number"
        min="0"
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
        placeholder={discountType === "PERCENT" ? "e.g. 10" : "e.g. 50"}
      />
    </div>
  );
}
