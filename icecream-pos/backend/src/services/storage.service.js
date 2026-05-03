import { createClient } from "@supabase/supabase-js";

const BUCKET_NAME = "invoices";
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function normalizeInvoiceNumber(invoiceNumber) {
  return String(invoiceNumber || "")
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, "_");
}

export async function uploadAndPersistInvoicePdf({ orderId, invoiceNumber, pdfBuffer }) {
  const safeInvoiceNumber = normalizeInvoiceNumber(invoiceNumber);
  const filePath = `invoices/${safeInvoiceNumber}.pdf`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(filePath, pdfBuffer, {
      upsert: true,
      contentType: "application/pdf",
      cacheControl: "3600",
    });

  if (uploadError) {
    const error = new Error(`Failed to upload PDF: ${uploadError.message}`);
    error.code = "PDF_UPLOAD_FAILED";
    throw error;
  }

  const { data: publicData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(filePath);
  const pdfUrl = publicData.publicUrl;

  const { data: updatedInvoice, error: updateError } = await supabaseAdmin
    .from("invoices")
    .update({
      pdf_url: pdfUrl,
      saved: true,
    })
    .eq("invoice_number", invoiceNumber)
    .eq("order_id", orderId)
    .select("id")
    .maybeSingle();

  if (updateError) {
    const error = new Error(`Failed to update invoice record: ${updateError.message}`);
    error.code = "INVOICE_UPDATE_FAILED";
    throw error;
  }

  if (!updatedInvoice) {
    const error = new Error("No matching invoice row found for given order_id and invoice_number");
    error.code = "INVOICE_NOT_FOUND";
    throw error;
  }

  return pdfUrl;
}
