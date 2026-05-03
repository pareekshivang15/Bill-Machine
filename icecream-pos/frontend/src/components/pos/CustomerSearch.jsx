import { useEffect, useState } from "react";

export default function CustomerSearch({ tab, onApplyCustomer, onSearchByPhone, searching }) {
  const [phone, setPhone] = useState(tab.customerPhone || "");
  const [name, setName] = useState(tab.customerName || "");
  const [address, setAddress] = useState(tab.customerAddress || "");
  const [match, setMatch] = useState(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    setPhone(tab.customerPhone || "");
    setName(tab.customerName || "");
    setAddress(tab.customerAddress || "");
    setMatch(null);
    setSearched(false);
  }, [tab.id, tab.customerName, tab.customerPhone, tab.customerAddress]);

  const runSearch = async () => {
    setSearched(true);
    if (!phone.trim()) {
      setMatch(null);
      return;
    }
    const results = await onSearchByPhone(phone.trim());
    const customer = results?.[0] ?? null;
    setMatch(customer);
    if (customer) {
      setName(customer.name || "");
      setAddress(customer.address || "");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">Customer (Optional)</p>
        <button
          type="button"
          onClick={() => onApplyCustomer({ id: null, name: "", phone: "", address: "" })}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          Clear
        </button>
      </div>

      <div className="mb-2 flex gap-2">
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Search by phone"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={searching}
          className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {searching ? "..." : "Find"}
        </button>
      </div>

      {match && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
          <p className="font-bold">{match.name}</p>
          <p>{match.phone}</p>
          <p>{match.address || "No address"}</p>
          <p>Total orders: {match.total_orders || 0}</p>
        </div>
      )}

      {!match && searched && (
        <p className="mb-2 text-xs text-amber-700">No existing customer found. Create new snapshot details.</p>
      )}

      <div className="grid grid-cols-1 gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Customer name"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
        />
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Address (optional)"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
        />
      </div>

      <button
        type="button"
        onClick={() =>
          onApplyCustomer({
            id: match?.id ?? null,
            name: name.trim(),
            phone: phone.trim(),
            address: address.trim(),
          })
        }
        className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Apply Customer
      </button>
    </div>
  );
}
