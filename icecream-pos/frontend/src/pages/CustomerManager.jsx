import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import CustomerCard from "../components/customer/CustomerCard";
import CustomerOrderHistory from "../components/customer/CustomerOrderHistory";
import Modal from "../components/shared/Modal";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import LoadingSkeleton from "../components/shared/LoadingSkeleton";
import { useCustomerStore } from "../store/customerStore";
import { supabase } from "../services/supabase";

export default function CustomerManager() {
  const { customers, loading, fetchCustomers, addCustomer, updateCustomer } = useCustomerStore();
  const [ordersByCustomer, setOrdersByCustomer] = useState({});
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", phone: "", address: "", email: "" });
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", phone: "", address: "", email: "" });
  const [historyCustomer, setHistoryCustomer] = useState(null);

  useEffect(() => {
    fetchCustomers().catch(() => toast.error("Unable to fetch customers"));
  }, [fetchCustomers]);

  useEffect(() => {
    const loadOrders = async () => {
      if (!customers.length) {
        setOrdersByCustomer({});
        return;
      }
      const customerIds = customers.map((customer) => customer.id);
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, total, created_at, customer_id")
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false });
      if (error) {
        toast.error("Unable to fetch customer orders");
        return;
      }
      const grouped = (data || []).reduce((acc, order) => {
        const key = order.customer_id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(order);
        return acc;
      }, {});
      setOrdersByCustomer(grouped);
    };
    loadOrders();
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const safeQuery = query.toLowerCase();
    if (!safeQuery) return customers;
    return customers.filter(
      (customer) =>
        customer.name?.toLowerCase().includes(safeQuery) || customer.phone?.toLowerCase().includes(safeQuery),
    );
  }, [customers, query]);

  const handleAddCustomer = async (event) => {
    event.preventDefault();
    try {
      setAdding(true);
      await addCustomer({
        name: addForm.name.trim(),
        phone: addForm.phone.trim() || null,
        address: addForm.address.trim() || null,
        email: addForm.email.trim() || null,
      });
      setAddForm({ name: "", phone: "", address: "", email: "" });
      toast.success("Customer added");
    } catch (error) {
      if (error.message?.includes("duplicate")) {
        toast.error("Customer phone already exists");
      } else {
        toast.error("Unable to add customer");
      }
    } finally {
      setAdding(false);
    }
  };

  const openEdit = (customer) => {
    setEditingCustomer(customer);
    setEditForm({
      name: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || "",
      email: customer.email || "",
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    try {
      await updateCustomer(editingCustomer.id, {
        name: editForm.name.trim(),
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
        email: editForm.email.trim() || null,
      });
      toast.success("Customer updated");
      setEditingCustomer(null);
    } catch {
      toast.error("Unable to update customer");
    }
  };

  const reprintOrder = async (order) => {
    const { data, error } = await supabase
      .from("invoices")
      .select("id, pdf_url, printed")
      .eq("order_id", order.id)
      .maybeSingle();
    if (error || !data) {
      toast.error("Invoice not found for this order");
      return;
    }
    if (!data.pdf_url) {
      toast.error("PDF not available yet. Regenerate from Invoice History.");
      return;
    }
    window.open(data.pdf_url, "_blank", "noopener,noreferrer");
    await supabase.from("invoices").update({ printed: true }).eq("id", data.id);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <LoadingSpinner label="Loading customers..." />
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-slate-900">Customer Manager</h2>
          <input
            placeholder="Search by name or phone"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
        </div>

        <form onSubmit={handleAddCustomer} className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input
            required
            placeholder="Name"
            value={addForm.name}
            onChange={(event) => setAddForm((prev) => ({ ...prev, name: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            placeholder="Phone"
            value={addForm.phone}
            onChange={(event) => setAddForm((prev) => ({ ...prev, phone: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            placeholder="Email"
            value={addForm.email}
            onChange={(event) => setAddForm((prev) => ({ ...prev, email: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            placeholder="Address"
            value={addForm.address}
            onChange={(event) => setAddForm((prev) => ({ ...prev, address: event.target.value }))}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {adding ? "Adding..." : "Add Customer"}
          </button>
        </form>
      </section>

      {filteredCustomers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center text-sm text-slate-500">
          No customers found.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filteredCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              recentOrders={(ordersByCustomer[customer.id] || []).slice(0, 5)}
              onEdit={() => openEdit(customer)}
              onReprint={reprintOrder}
              onViewHistory={() => setHistoryCustomer(customer)}
            />
          ))}
        </div>
      )}

      <Modal open={Boolean(editingCustomer)} onClose={() => setEditingCustomer(null)} title="Edit Customer" width="max-w-md">
        <form onSubmit={saveEdit} className="space-y-3">
          <input
            required
            value={editForm.name}
            onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="Name"
          />
          <input
            value={editForm.phone}
            onChange={(event) => setEditForm((prev) => ({ ...prev, phone: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="Phone"
          />
          <input
            value={editForm.email}
            onChange={(event) => setEditForm((prev) => ({ ...prev, email: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="Email"
          />
          <textarea
            rows={2}
            value={editForm.address}
            onChange={(event) => setEditForm((prev) => ({ ...prev, address: event.target.value }))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            placeholder="Address"
          />
          <button type="submit" className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
            Save Changes
          </button>
        </form>
      </Modal>

      <CustomerOrderHistory
        open={Boolean(historyCustomer)}
        customer={historyCustomer}
        orders={historyCustomer ? ordersByCustomer[historyCustomer.id] || [] : []}
        onClose={() => setHistoryCustomer(null)}
        onReprint={reprintOrder}
      />
    </div>
  );
}
