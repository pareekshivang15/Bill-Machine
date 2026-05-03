import "dotenv/config";
import cors from "cors";
import express from "express";
import invoiceRoutes from "./src/routes/invoice.routes.js";
import { errorHandler, notFoundHandler } from "./src/middleware/errorHandler.js";

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missingEnv = REQUIRED_ENV.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  // Fail fast to avoid running with broken config in production.
  // eslint-disable-next-line no-console
  console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "icecream-pos-invoice-service",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api", invoiceRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Invoice service listening on http://localhost:${PORT}`);
});
