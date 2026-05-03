import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import LoadingSkeleton from "../components/shared/LoadingSkeleton";
import { useDashboardStore } from "../store/dashboardStore";
import { supabase } from "../services/supabase";
import { formatCurrency, formatDateTime } from "../utils/formatters";

const PIE_COLORS = ["#1ca57d", "#f97316", "#0ea5e9", "#14b8a6", "#64748b", "#84cc16"];

function getDateStart(date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

export default function Dashboard() {
  const { liveOrders } = useDashboardStore();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    revenueToday: 0,
    ordersToday: 0,
    itemsSoldToday: 0,
    customersServedToday: 0,
  });
  const [revenue7Days, setRevenue7Days] = useState([]);
  const [salesByCategory, setSalesByCategory] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [latestOrders, setLatestOrders] = useState([]);

  const loadData = async () => {
    try {
      setLoading(true);

      const now = new Date();
      const todayStart = getDateStart(now).toISOString();
      const weekStart = getDateStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)).toISOString();

      const { data: ordersToday, error: todayError } = await supabase
        .from("orders")
        .select("id, total, customer_id, created_at, order_number, customer_name_snapshot, status")
        .eq("status", "CONFIRMED")
        .gte("created_at", todayStart)
        .order("created_at", { ascending: false });
      if (todayError) throw todayError;

      const { data: ordersWeek, error: weekError } = await supabase
        .from("orders")
        .select("id, total, created_at, status")
        .eq("status", "CONFIRMED")
        .gte("created_at", weekStart);
      if (weekError) throw weekError;

      const todayOrderIds = (ordersToday || []).map((order) => order.id);
      let orderItemsToday = [];

      if (todayOrderIds.length > 0) {
        const { data: itemData, error: itemError } = await supabase
          .from("order_items")
          .select("order_id, product_id, product_name_snapshot, quantity, subtotal, products(category)")
          .in("order_id", todayOrderIds);
        if (itemError) throw itemError;
        orderItemsToday = itemData || [];
      }

      const revenueToday = (ordersToday || []).reduce((sum, order) => sum + Number(order.total || 0), 0);
      const itemsSoldToday = orderItemsToday.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const customersServedToday = new Set(
        (ordersToday || []).map((order) => order.customer_id || `walkin-${order.id}`),
      ).size;

      setSummary({
        revenueToday,
        ordersToday: ordersToday?.length || 0,
        itemsSoldToday,
        customersServedToday,
      });

      const revenueMap = {};
      for (let i = 0; i < 7; i += 1) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const label = day.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        revenueMap[label] = 0;
      }
      (ordersWeek || []).forEach((order) => {
        const key = new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        if (revenueMap[key] === undefined) revenueMap[key] = 0;
        revenueMap[key] += Number(order.total || 0);
      });
      setRevenue7Days(
        Object.entries(revenueMap)
          .map(([date, revenue]) => ({ date, revenue: Number(revenue.toFixed(2)) }))
          .reverse(),
      );

      const categoryMap = orderItemsToday.reduce((acc, item) => {
        const category = item.products?.category || "Uncategorized";
        acc[category] = (acc[category] || 0) + Number(item.subtotal || 0);
        return acc;
      }, {});
      setSalesByCategory(
        Object.entries(categoryMap)
          .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
          .sort((a, b) => b.value - a.value),
      );

      const productMap = orderItemsToday.reduce((acc, item) => {
        const key = item.product_name_snapshot;
        if (!acc[key]) acc[key] = { name: key, quantity: 0, amount: 0 };
        acc[key].quantity += Number(item.quantity || 0);
        acc[key].amount += Number(item.subtotal || 0);
        return acc;
      }, {});
      setTopProducts(
        Object.values(productMap)
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5),
      );

      const { data: stockRows, error: lowStockError } = await supabase
        .from("stock")
        .select("id, quantity, low_threshold, products(name)")
        .order("quantity", { ascending: true });
      if (lowStockError) throw lowStockError;
      setLowStock((stockRows || []).filter((item) => item.quantity < item.low_threshold).slice(0, 10));

      setLatestOrders((ordersToday || []).slice(0, 5));
    } catch {
      toast.error("Unable to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (liveOrders.length > 0) {
      loadData();
    }
  }, [liveOrders.length]);

  const recentTransactions = useMemo(() => {
    const combined = [...liveOrders, ...latestOrders];
    const map = new Map();
    combined.forEach((order) => {
      if (!map.has(order.id)) map.set(order.id, order);
    });
    return Array.from(map.values())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5);
  }, [liveOrders, latestOrders]);

  if (loading) {
    return (
      <div className="space-y-3">
        <LoadingSpinner label="Loading dashboard..." />
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Today's Revenue" value={formatCurrency(summary.revenueToday)} />
        <MetricCard label="Orders Today" value={summary.ordersToday} />
        <MetricCard label="Items Sold Today" value={summary.itemsSoldToday} />
        <MetricCard label="Customers Served Today" value={summary.customersServedToday} />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-slate-900">Revenue Last 7 Days</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenue7Days}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="revenue" fill="#1ca57d" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-lg font-bold text-slate-900">Sales by Category (Today)</h3>
          <div className="h-72">
            {salesByCategory.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                No sales recorded today.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={salesByCategory} cx="50%" cy="50%" outerRadius={98} dataKey="value" label>
                    {salesByCategory.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title="Top 5 Products Today">
          {topProducts.length === 0 ? (
            <EmptyPanelText text="No product sales today." />
          ) : (
            topProducts.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-sm">
                <div>
                  <p className="font-semibold text-slate-900">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.quantity} units</p>
                </div>
                <p className="font-bold text-slate-900">{formatCurrency(item.amount)}</p>
              </div>
            ))
          )}
        </Panel>

        <Panel title="Low Stock Alerts">
          {lowStock.length === 0 ? (
            <EmptyPanelText text="No low stock alerts." />
          ) : (
            lowStock.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg bg-red-50 p-2 text-sm">
                <p className="font-semibold text-red-800">{item.products?.name || "Unknown Product"}</p>
                <p className="font-bold text-red-700">{item.quantity} left</p>
              </div>
            ))
          )}
        </Panel>

        <Panel title="Last 5 Transactions (Live)">
          {recentTransactions.length === 0 ? (
            <EmptyPanelText text="No transactions yet." />
          ) : (
            recentTransactions.map((order) => (
              <div key={order.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                <p className="font-semibold text-slate-900">{order.order_number}</p>
                <p className="text-xs text-slate-500">{order.customer_name_snapshot || "Walk-in Customer"}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-xs text-slate-500">{formatDateTime(order.created_at)}</p>
                  <p className="font-bold text-slate-900">{formatCurrency(order.total || 0)}</p>
                </div>
              </div>
            ))
          )}
        </Panel>
      </section>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.1em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
    </article>
  );
}

function Panel({ title, children }) {
  return (
    <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-base font-bold text-slate-900">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function EmptyPanelText({ text }) {
  return <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">{text}</div>;
}
