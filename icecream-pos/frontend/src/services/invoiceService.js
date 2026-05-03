import api from "./api";

let cachedReceiptConfig = null;

export async function generateInvoicePdf(payload) {
  const { data } = await api.post("/generate-invoice", payload);
  return data;
}

export async function getReceiptConfig() {
  if (cachedReceiptConfig) {
    return cachedReceiptConfig;
  }

  const { data } = await api.get("/receipt-config");
  cachedReceiptConfig = data || {};
  return cachedReceiptConfig;
}

export async function hydrateReceiptPayload(receipt) {
  const config = await getReceiptConfig().catch(() => ({}));
  return {
    ...config,
    ...receipt,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatReceiptDate(value) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}

function formatReceiptTime(value) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatReceiptMoney(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
}

export function getPaymentMethodLabel(paymentMethod) {
  const labels = {
    CASH: "Cash",
    UPI: "UPI",
    CARD: "Card",
    ONLINE: "Online",
  };
  return labels[paymentMethod] || "Cash";
}

function buildReceiptMarkup(receipt) {
  const totalQty = (receipt.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const customerName = receipt.customer_name?.trim() || "Walk-in Customer";
  const addressLine = receipt.shop_address ? `<div class="muted">${escapeHtml(receipt.shop_address)}</div>` : "";
  const gstinLine = receipt.shop_gstin ? `<div class="muted">GST No.: ${escapeHtml(receipt.shop_gstin)}</div>` : "";
  const fssaiLine = receipt.shop_fssai ? `<div class="muted">FSSAI No.: ${escapeHtml(receipt.shop_fssai)}</div>` : "";
  const rows = (receipt.items || [])
    .map(
      (item) => `
        <div class="item-row">
          <div class="item-name">${escapeHtml(item.product_name)}</div>
          <div class="item-metrics">
            <span>${escapeHtml(String(item.quantity))}</span>
            <span>${escapeHtml(formatReceiptMoney(item.unit_price))}</span>
            <span>${escapeHtml(formatReceiptMoney(item.subtotal))}</span>
          </div>
        </div>
      `,
    )
    .join("");

  return `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(receipt.invoice_number || "Receipt")}</title>
      <style>
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: #fff;
          color: #111;
          font-family: "Courier New", Courier, monospace;
        }
        .receipt {
          width: 80mm;
          margin: 0 auto;
          padding: 10px 9px 18px;
          font-size: 12px;
          line-height: 1.35;
        }
        .center { text-align: center; }
        .brand {
          margin-bottom: 4px;
          font-size: 21px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .title {
          margin: 8px 0 6px;
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0.12em;
        }
        .muted { font-size: 12px; }
        .divider {
          margin: 8px 0;
          border-top: 1px dashed #000;
        }
        .meta-stack { display: grid; gap: 2px; }
        .meta-row, .summary-row, .grand-total {
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
        .header-row, .item-metrics {
          display: grid;
          grid-template-columns: 1fr 34px 58px 64px;
          gap: 8px;
          align-items: start;
        }
        .header-row {
          margin-bottom: 6px;
          font-weight: 700;
        }
        .item-row { margin-bottom: 8px; }
        .item-name {
          margin-bottom: 2px;
          font-weight: 700;
          word-break: break-word;
        }
        .header-row span:nth-child(2),
        .item-metrics span:nth-child(1) {
          text-align: center;
        }
        .header-row span:nth-child(3),
        .header-row span:nth-child(4),
        .item-metrics span:nth-child(2),
        .item-metrics span:nth-child(3),
        .summary-row span:last-child,
        .grand-total span:last-child {
          text-align: right;
        }
        .grand-total {
          margin-top: 6px;
          font-size: 20px;
          font-weight: 700;
        }
        .footer {
          margin-top: 12px;
          text-align: center;
        }
        @media print {
          @page {
            size: 80mm auto;
            margin: 4mm;
          }
          body { margin: 0; }
        }
      </style>
    </head>
    <body>
      <main class="receipt">
        <section class="center">
          <div class="brand">${escapeHtml(receipt.shop_name || "Receipt")}</div>
          <div class="title">RETAIL INVOICE</div>
          ${addressLine}
          <div class="muted">${escapeHtml(receipt.shop_phone || "")}</div>
          ${gstinLine}
          ${fssaiLine}
        </section>
        <div class="divider"></div>

        <section class="meta-stack">
          <div><strong>Name:</strong> ${escapeHtml(customerName)}</div>
          <div class="meta-row">
            <span><strong>Date:</strong> ${escapeHtml(formatReceiptDate(receipt.created_at))}</span>
            <span><strong>Time:</strong> ${escapeHtml(formatReceiptTime(receipt.created_at))}</span>
          </div>
          <div class="meta-row">
            <span><strong>Bill No:</strong> ${escapeHtml(receipt.invoice_number || receipt.order_number || "-")}</span>
            <span><strong>Order:</strong> ${escapeHtml(receipt.order_number || "-")}</span>
          </div>
        </section>

        <div class="divider"></div>
        <div class="header-row">
          <span>Item</span>
          <span>Qty</span>
          <span>Price</span>
          <span>Amount</span>
        </div>
        ${rows}
        <div class="divider"></div>

        <section class="meta-stack">
          <div class="summary-row">
            <span>Total Qty:</span>
            <span>${escapeHtml(String(totalQty))}</span>
          </div>
          <div class="summary-row">
            <span>Sub Total</span>
            <span>${escapeHtml(formatReceiptMoney(receipt.subtotal))}</span>
          </div>
          ${
            Number(receipt.discount || 0) > 0
              ? `<div class="summary-row"><span>Discount</span><span>- ${escapeHtml(
                  formatReceiptMoney(receipt.discount),
                )}</span></div>`
              : ""
          }
        </section>

        <div class="divider"></div>
        <div class="grand-total">
          <span>Grand Total</span>
          <span>${escapeHtml(formatReceiptMoney(receipt.total))}</span>
        </div>
        <div class="divider"></div>

        <div><strong>Paid via ${escapeHtml(getPaymentMethodLabel(receipt.payment_method))}</strong></div>

        <div class="footer">
          Thank you for choosing us. Visit again!
        </div>
      </main>
      <script>
        window.addEventListener("load", function () {
          setTimeout(function () {
            window.focus();
            window.print();
          }, 180);
        });
        window.onafterprint = function () {
          setTimeout(function () {
            window.close();
          }, 120);
        };
      </script>
    </body>
  </html>`;
}

export function printReceipt(receipt) {
  const printWindow = window.open("", receipt.invoice_number || "Receipt", "width=420,height=900");
  if (!printWindow) {
    throw new Error("Please allow popups to print receipts");
  }

  printWindow.document.open();
  printWindow.document.write(buildReceiptMarkup(receipt));
  printWindow.document.close();
}

export function toReceiptPayloadFromInvoice(invoice) {
  const order = invoice?.orders;
  if (!order) {
    throw new Error("Order data missing for receipt");
  }

  return {
    invoice_number: invoice.invoice_number,
    order_number: order.order_number,
    customer_name: order.customer_name_snapshot || "Walk-in Customer",
    customer_phone: order.customer_phone_snapshot || "",
    customer_address: order.customer_address_snapshot || "",
    items: (order.order_items || []).map((item) => ({
      product_name: item.product_name_snapshot,
      quantity: Number(item.quantity || 0),
      unit_price: Number(item.unit_price || 0),
      subtotal: Number(item.subtotal || 0),
    })),
    subtotal: Number(order.subtotal || 0),
    discount: Number(order.discount_amount || 0),
    total: Number(order.total || 0),
    created_at: invoice.created_at || order.created_at,
    payment_method: order.payment_method || "CASH",
    shop_name: "",
    shop_address: "",
    shop_phone: "",
    shop_gstin: "",
    shop_fssai: "",
  };
}
