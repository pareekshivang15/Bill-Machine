import { formatCurrency } from "../../utils/formatters";

export default function OrderTabs({
  tabs,
  activeTabId,
  onSetActive,
  onAddTab,
  onRemoveTab,
  maxTabsReached,
}) {
  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
              tab.id === activeTabId
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-slate-50 text-slate-600"
            }`}
          >
            <button type="button" className="text-sm font-semibold" onClick={() => onSetActive(tab.id)}>
              {tab.label} - {formatCurrency(tab.total || 0)}
            </button>
            {tabs.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveTab(tab)}
                className="rounded-md px-1 text-xs hover:bg-slate-200"
              >
                x
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          disabled={maxTabsReached}
          onClick={onAddTab}
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:bg-slate-300"
        >
          + New Order
        </button>
      </div>
    </div>
  );
}
