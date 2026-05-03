import express from "express";
import { z } from "zod";
import { generateInvoicePdfBuffer } from "../services/pdf.service.js";
import { uploadAndPersistInvoicePdf } from "../services/storage.service.js";

const router = express.Router();

const itemSchema = z.object({
  product_id: z.string().uuid().optional(),
  product_name: z.string().min(1, "Item name is required"),
  quantity: z.coerce.number().int().positive("Quantity must be > 0"),
  unit_price: z.coerce.number().nonnegative("Unit price cannot be negative"),
  subtotal: z.coerce.number().nonnegative("Subtotal cannot be negative"),
});

const payloadSchema = z
  .object({
    order_id: z.string().uuid("Valid order_id is required"),
    invoice_number: z.string().min(1, "invoice_number is required"),
    order_number: z.string().min(1, "order_number is required"),
    shop_name: z.string().optional(),
    shop_address: z.string().optional(),
    shop_phone: z.string().optional(),
    shop_gstin: z.string().nullable().optional(),
    shop_fssai: z.string().nullable().optional(),
    customer_name: z.string().nullable().optional(),
    customer_phone: z.string().nullable().optional(),
    customer_address: z.string().nullable().optional(),
    payment_method: z.enum(["CASH", "UPI", "CARD", "ONLINE"]).default("CASH"),
    items: z.array(itemSchema).min(1, "At least one item is required"),
    subtotal: z.coerce.number().nonnegative(),
    discount: z.coerce.number().nonnegative().default(0),
    total: z.coerce.number().nonnegative(),
    created_at: z.string().min(1, "created_at is required"),
  })
  .superRefine((payload, ctx) => {
    const computedSubtotal = payload.items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const delta = Math.abs(computedSubtotal - Number(payload.subtotal));
    if (delta > 0.5) {
      ctx.addIssue({
        code: "custom",
        path: ["subtotal"],
        message: "Subtotal does not match sum of item subtotals",
      });
    }

    const expectedTotal = Number(payload.subtotal) - Number(payload.discount);
    if (Math.abs(expectedTotal - Number(payload.total)) > 0.5) {
      ctx.addIssue({
        code: "custom",
        path: ["total"],
        message: "Total does not match subtotal - discount",
      });
    }
  });

router.get("/receipt-config", (_req, res) => {
  return res.status(200).json({
    shop_name: process.env.SHOP_NAME || "",
    shop_address: process.env.SHOP_ADDRESS || "",
    shop_phone: process.env.SHOP_PHONE || "",
    shop_gstin: process.env.SHOP_GSTIN || "",
    shop_fssai: process.env.SHOP_FSSAI || "",
  });
});

router.post("/generate-invoice", async (req, res, next) => {
  try {
    const parsed = payloadSchema.parse(req.body);
    const createdAtDate = new Date(parsed.created_at);

    if (Number.isNaN(createdAtDate.getTime())) {
      const error = new Error("created_at must be a valid datetime string");
      error.code = "VALIDATION_ERROR";
      throw error;
    }

    const resolvedShopName = parsed.shop_name || process.env.SHOP_NAME;
    const resolvedShopAddress = parsed.shop_address || process.env.SHOP_ADDRESS;
    const resolvedShopPhone = parsed.shop_phone || process.env.SHOP_PHONE;

    if (!resolvedShopName || !resolvedShopAddress || !resolvedShopPhone) {
      const error = new Error("Shop name, address, and phone must be configured before generating invoices");
      error.code = "SHOP_DETAILS_MISSING";
      throw error;
    }

    const invoicePayload = {
      ...parsed,
      shop_name: resolvedShopName,
      shop_address: resolvedShopAddress,
      shop_phone: resolvedShopPhone,
      shop_gstin: parsed.shop_gstin || process.env.SHOP_GSTIN || null,
      shop_fssai: parsed.shop_fssai || process.env.SHOP_FSSAI || null,
      created_at: createdAtDate.toISOString(),
    };

    let pdfBuffer;
    try {
      pdfBuffer = await generateInvoicePdfBuffer(invoicePayload);
    } catch (error) {
      error.code = "PDF_FAILED";
      throw error;
    }

    const pdfUrl = await uploadAndPersistInvoicePdf({
      orderId: invoicePayload.order_id,
      invoiceNumber: invoicePayload.invoice_number,
      pdfBuffer,
    });

    return res.status(200).json({
      success: true,
      pdf_url: pdfUrl,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
