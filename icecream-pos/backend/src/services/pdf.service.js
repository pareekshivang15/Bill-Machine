import PDFDocument from "pdfkit";

const RECEIPT_WIDTH = 226;
const PAGE_MARGIN = 14;
const CONTENT_WIDTH = RECEIPT_WIDTH - PAGE_MARGIN * 2;

function formatReceiptMoney(value) {
  return `Rs ${Number(value || 0).toFixed(2)}`;
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

function getPaymentMethodLabel(paymentMethod) {
  const labels = {
    CASH: "Cash",
    UPI: "UPI",
    CARD: "Card",
    ONLINE: "Online",
  };
  return labels[paymentMethod] || "Cash";
}

function divider(doc, y) {
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(RECEIPT_WIDTH - PAGE_MARGIN, y)
    .strokeColor("#111111")
    .lineWidth(1)
    .dash(3, { space: 2 })
    .stroke()
    .undash();
}

function centerText(doc, text, y, font = "Courier", size = 11) {
  doc.font(font).fontSize(size).fillColor("#111111");
  doc.text(text, PAGE_MARGIN, y, {
    width: CONTENT_WIDTH,
    align: "center",
  });
  return doc.y;
}

function estimateHeight(payload) {
  const itemLines = (payload.items || []).reduce((lines, item) => {
    return lines + Math.max(1, Math.ceil(String(item.product_name || "").length / 18));
  }, 0);

  let height = 410 + itemLines * 22;
  if (payload.shop_address) height += 18;
  if (payload.shop_gstin) height += 14;
  if (payload.shop_fssai) height += 14;
  if (payload.customer_name) height += 14;
  if (Number(payload.discount || 0) > 0) height += 16;

  return Math.max(height, 520);
}

export function generateInvoicePdfBuffer(payload) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [RECEIPT_WIDTH, estimateHeight(payload)],
      margins: { top: PAGE_MARGIN, right: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN },
      compress: true,
      info: {
        Title: payload.invoice_number,
        Author: payload.shop_name,
        Subject: "Retail Receipt",
      },
    });

    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = PAGE_MARGIN;

    y = centerText(doc, payload.shop_name, y, "Courier-Bold", 18) + 2;
    y = centerText(doc, "RETAIL INVOICE", y, "Courier-Bold", 13) + 2;

    if (payload.shop_address) {
      y = centerText(doc, payload.shop_address, y, "Courier", 11) + 1;
    }

    if (payload.shop_phone) {
      y = centerText(doc, payload.shop_phone, y, "Courier", 11) + 1;
    }

    if (payload.shop_gstin) {
      y = centerText(doc, `GST No.: ${payload.shop_gstin}`, y, "Courier", 10) + 1;
    }

    if (payload.shop_fssai) {
      y = centerText(doc, `FSSAI No.: ${payload.shop_fssai}`, y, "Courier", 10) + 1;
    }

    divider(doc, y + 5);
    y += 14;

    doc.font("Courier-Bold").fontSize(11).text(`Name: ${payload.customer_name || "Walk-in Customer"}`, PAGE_MARGIN, y, {
      width: CONTENT_WIDTH,
    });
    y += 18;

    doc.font("Courier").fontSize(10);
    doc.text(`Date: ${formatReceiptDate(payload.created_at)}`, PAGE_MARGIN, y, { width: 92 });
    doc.text(`Time: ${formatReceiptTime(payload.created_at)}`, PAGE_MARGIN + 96, y, {
      width: CONTENT_WIDTH - 96,
      align: "right",
    });
    y += 14;
    doc.text(`Bill No: ${payload.invoice_number}`, PAGE_MARGIN, y, { width: CONTENT_WIDTH });
    y += 14;
    doc.text(`Order No: ${payload.order_number}`, PAGE_MARGIN, y, { width: CONTENT_WIDTH });
    y += 10;

    divider(doc, y + 3);
    y += 12;

    doc.font("Courier-Bold").fontSize(10);
    doc.text("Item", PAGE_MARGIN, y, { width: 96 });
    doc.text("Qty", PAGE_MARGIN + 102, y, { width: 24, align: "center" });
    doc.text("Price", PAGE_MARGIN + 132, y, { width: 34, align: "right" });
    doc.text("Amount", PAGE_MARGIN + 168, y, { width: 30, align: "right" });
    y += 14;

    divider(doc, y);
    y += 8;

    doc.font("Courier").fontSize(10);
    for (const item of payload.items) {
      const nameHeight = doc.heightOfString(item.product_name, { width: 96 });
      const rowHeight = Math.max(nameHeight, 12);

      doc.text(item.product_name, PAGE_MARGIN, y, { width: 96 });
      doc.text(String(item.quantity), PAGE_MARGIN + 102, y, { width: 24, align: "center" });
      doc.text(Number(item.unit_price || 0).toFixed(2), PAGE_MARGIN + 132, y, { width: 34, align: "right" });
      doc.text(Number(item.subtotal || 0).toFixed(2), PAGE_MARGIN + 168, y, { width: 30, align: "right" });

      y += rowHeight + 6;
    }

    divider(doc, y);
    y += 10;

    const totalQty = payload.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    doc.text(`Total Qty: ${totalQty}`, PAGE_MARGIN, y, { width: 84 });
    doc.text(`Sub Total ${Number(payload.subtotal || 0).toFixed(2)}`, PAGE_MARGIN + 84, y, {
      width: CONTENT_WIDTH - 84,
      align: "right",
    });
    y += 16;

    if (Number(payload.discount || 0) > 0) {
      doc.text("Discount", PAGE_MARGIN, y, { width: 84 });
      doc.text(`- ${Number(payload.discount || 0).toFixed(2)}`, PAGE_MARGIN + 84, y, {
        width: CONTENT_WIDTH - 84,
        align: "right",
      });
      y += 16;
    }

    divider(doc, y);
    y += 10;

    doc.font("Courier-Bold").fontSize(15);
    doc.text("Grand Total", PAGE_MARGIN, y, { width: 108 });
    doc.text(formatReceiptMoney(payload.total), PAGE_MARGIN + 108, y, {
      width: CONTENT_WIDTH - 108,
      align: "right",
    });
    y += 24;

    divider(doc, y);
    y += 12;

    doc.font("Courier-Bold").fontSize(11);
    doc.text(`Paid via ${getPaymentMethodLabel(payload.payment_method)}`, PAGE_MARGIN, y, {
      width: CONTENT_WIDTH,
    });
    y += 24;

    centerText(doc, "Thank you for choosing us. Visit again!", y, "Courier", 11);

    doc.end();
  });
}
