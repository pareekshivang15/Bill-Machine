import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuthStore } from "../../store/authStore";

const mobileNav = [
  { to: "/", label: "POS" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/customers", label: "Customers" },
  { to: "/stock", label: "Stock" },
  { to: "/invoices", label: "Invoices" },
];

export default function Navbar() {
  const [loggingOut, setLoggingOut] = useState(false);
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Daily Operations</p>
          <h1 className="text-lg font-bold text-slate-900">IceCream POS</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs sm:block">
            <p className="font-semibold text-slate-900">{user?.email || "Unknown user"}</p>
            <p className="text-slate-500">Authenticated</p>
          </div>
          <button
            type="button"
            disabled={loggingOut}
            onClick={handleLogout}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loggingOut ? "Signing out..." : "Sign Out"}
          </button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto border-t border-slate-200 px-3 py-2 lg:hidden">
        {mobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold ${
                isActive ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </header>
  );
}
