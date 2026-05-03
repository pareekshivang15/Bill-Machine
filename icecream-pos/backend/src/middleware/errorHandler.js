import { ZodError } from "zod";

function normalizeMessage(error) {
  if (error instanceof ZodError) {
    return error.errors.map((issue) => issue.message).join(", ");
  }
  return error.message || "Unexpected server error";
}

export function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message: `Route ${req.method} ${req.originalUrl} was not found`,
  });
}

export function errorHandler(error, _req, res, _next) {
  // eslint-disable-next-line no-console
  console.error(error);

  if (error instanceof ZodError || error.code === "VALIDATION_ERROR") {
    return res.status(400).json({
      success: false,
      error: "VALIDATION_ERROR",
      message: normalizeMessage(error),
    });
  }

  if (error.code === "PDF_FAILED") {
    return res.status(500).json({
      success: false,
      error: "PDF_FAILED",
      message: "Bill saved but PDF generation failed. Retry from Invoice History.",
    });
  }

  if (error.code === "PDF_UPLOAD_FAILED") {
    return res.status(502).json({
      success: false,
      error: "NETWORK_ERROR",
      message: "Could not upload PDF to storage. Check internet connection and retry.",
    });
  }

  if (error.code === "INVOICE_UPDATE_FAILED") {
    return res.status(500).json({
      success: false,
      error: "INVOICE_UPDATE_FAILED",
      message: "PDF generated but invoice record update failed. Retry from Invoice History.",
    });
  }

  if (error.code === "INVOICE_NOT_FOUND") {
    return res.status(404).json({
      success: false,
      error: "DUPLICATE_ORDER",
      message: "Order already processed, refresh page.",
    });
  }

  return res.status(500).json({
    success: false,
    error: "SERVER_ERROR",
    message: normalizeMessage(error),
  });
}
