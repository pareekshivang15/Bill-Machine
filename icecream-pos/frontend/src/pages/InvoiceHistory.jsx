import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Modal from "../components/shared/Modal";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import LoadingSkeleton from "../components/shared/LoadingSkeleton";
import { useInvoiceStore } from "../store/invoiceStore";
import { getPaymentMethodLabel } from "../services/invoiceService";
import { formatCurrency, formatDateTime } from "../utils/formatters";

function getStartOfLocalDay(value) {
  const date = new Date(`${value}T00:00:00`);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function getEndOfLocalDay(value) {
  const date = new Date(`${value}T23:59:59.999`);
  date.setHours(23, 59, 59, 999);
  return date.getTime();
}

export default function InvoiceHistory() {
  const { invoices, loading, fetchInvoices, generateAndSave, printInvoice } = useInvoiceStore();
  const [customerFilter, setCustomerFilter] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [busyInvoiceId, setBusyInvoiceId] = useState(null);

  useEffect(() => {
    fetchInvoices().catch(() => toast.error("Unable to load invoices"));
  }, [fetchInvoices]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((invoice) => {
      const createdAt = new Date(invoice.created_at).getTime();
      if (fromDate && createdAt < getStartOfLocalDay(fromDate)) return false;
      if (toDate && createdAt > getEndOfLocalDay(toDate)) return false;

      const customer = (invoice.orders?.customer_name_snapshot || "").toLowerCase();
      if (customerFilter && !customer.includes(customerFilter.toLowerCase())) return false;

      if (minAmount && Number(invoice.orders?.total || 0) < Number(minAmount)) return false;
      return true;
    });
  }, [invoices, customerFilter, minAmount, fromDate, toDate]);

  const regeneratePdf = async (invoice) => {
    try {
      setBusyInvoiceId(invoice.id);
      const order = invoice.orders;
      if (!order) throw new Error("Order data missing for invoice");
      const payload = {
        order_id: order.id,
        invoice_number: invoice.invoice_number,
        order_number: order.order_number,
        customer_name: order.customer_name_snapshot || "Walk-in Customer",
        customer_phone: order.customer_phone_snapshot || "",
        customer_address: order.customer_address_snapshot || "",
        items: (order.order_items || []).map((item) => ({
          product_name: item.product_name_snapshot,
          quantity: item.quantity,
          unit_price: Number(item.unit_price),
          subtotal: Number(item.subtotal),
        })),
        subtotal: Number(order.subtotal || 0),
        discount: Number(order.discount_amount || 0),
        total: Number(order.total || 0),
        created_at: order.created_at,
        payment_method: order.payment_method || "CASH",
      };

      await generateAndSave(payload);
      toast.success("PDF regenerated");
      await fetchInvoices();
    } catch (error) {
      toast.error(error.message || "Failed to regenerate PDF");
    } finally {
      setBusyInvoiceId(null);
    }
  };

  const downloadPdf = (invoice) => {
    if (!invoice.pdf_url) {
      toast.error("PDF not available yet");
      return;
    }
    window.open(invoice.pdf_url, "_blank", "noopener,noreferrer");
  };

  const handleReprint = async (invoice) => {
    try {
      setBusyInvoiceId(invoice.id);
      await printInvoice(invoice);
    } catch (error) {
      toast.error(error.message || "Unable to reprint invoice");
    } finally {
      setBusyInvoiceId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <LoadingSpinner label="Loading invoices..." />
        <LoadingSkeleton rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xl font-bold text-slate-900">Invoice History</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <input
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            placeholder="Customer name"
            value={customerFilter}
            onChange={(event) => setCustomerFilter(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
          <input
            type="number"
            min="0"
            placeholder="Minimum amount"
            value={minAmount}
            onChange={(event) => setMinAmount(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
          />
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Invoice #</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-600">{formatDateTime(invoice.created_at)}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{invoice.invoice_number}</td>
                <td className="px-4 py-3 text-slate-600">{invoice.orders?.customer_name_snapshot || "Walk-in"}</td>
                <td className="px-4 py-3 font-bold text-slate-900">
                  {formatCurrency(invoice.orders?.total || 0)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => downloadPdf(invoice)}
                      className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                    >
                      Download PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReprint(invoice)}
                      disabled={busyInvoiceId === invoice.id}
                      className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Reprint Receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(invoice)}
                      className="rounded-lg bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800"
                    >
                      View Details
                    </button>
                    {!invoice.pdf_url && (
                      <button
                        type="button"
                        onClick={() => regeneratePdf(invoice)}
                        disabled={busyInvoiceId === invoice.id}
                        className="rounded-lg bg-amber-500 px-2 py-1 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        Retry PDF
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredInvoices.length === 0 && (
          <div className="py-10 text-center text-sm text-slate-500">No invoices found.</div>
        )}
      </section>

      <Modal
        open={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        title={`Invoice Details - ${selectedInvoice?.invoice_number || ""}`}
        width="max-w-3xl"
      >
        {selectedInvoice && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
              <p>
                <span className="font-semibold">Order:</span> {selectedInvoice.orders?.order_number}
              </p>
              <p>
                <span className="font-semibold">Customer:</span>{" "}
                {selectedInvoice.orders?.customer_name_snapshot || "Walk-in"}
              </p>
              <p>
                <span className="font-semibold">Date:</span> {formatDateTime(selectedInvoice.created_at)}
              </p>
              <p>
                <span className="font-semibold">Total:</span>{" "}
                {formatCurrency(selectedInvoice.orders?.total || 0)}
              </p>
              <p>
                <span className="font-semibold">Payment:</span>{" "}
                {getPaymentMethodLabel(selectedInvoice.orders?.payment_method || "CASH")}
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-left text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Rate</th>
                    <th className="px-3 py-2">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedInvoice.orders?.order_items || []).map((item, index) => (
                    <tr key={`${item.product_name_snapshot}-${index}`} className="border-t border-slate-100">
                      <td className="px-3 py-2">{item.product_name_snapshot}</td>
                      <td className="px-3 py-2">{item.quantity}</td>
                      <td className="px-3 py-2">{formatCurrency(item.unit_price)}</td>
                      <td className="px-3 py-2">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
