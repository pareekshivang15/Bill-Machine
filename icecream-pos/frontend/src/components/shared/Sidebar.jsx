import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "POS" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/customers", label: "Customers" },
  { to: "/stock", label: "Stock" },
  { to: "/invoices", label: "Invoices" },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-white/20 bg-slate-950/85 p-5 text-slate-100 lg:block">
      <div className="mb-7 rounded-2xl bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-3 text-slate-50">
        <p className="text-xs uppercase tracking-[0.16em] opacity-90">IceCream POS</p>
        <p className="text-xl font-extrabold">Billing Suite</p>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `block rounded-xl px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-brand-600/90 text-white"
                  : "text-slate-200 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
