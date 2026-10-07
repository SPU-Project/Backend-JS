import express, { Request, Response } from "express";
import cors from "cors";
import session from "express-session";
import path from "path";
const SequelizeStore = require("connect-session-sequelize")(session.Store);

const db = require("../config/Database");

// Import models & associations for legacy Sequelize registry
require("../models/AdminModel");
require("../models/BahanBakuModel");
require("../models/KemasanModel");
require("../models/OverheadModel");
require("../models/ProdukBahanBakuModel");
require("../models/ProdukModel");
require("../models/RiwayatLog");
require("../models/StokBahanBakuModel");
require("../models/StatusProduksiModel");
require("../models/PenjualanProdukModel");
require("../models/association");

// Import legacy routes
const AuthRoute = require("../routes/AuthRoute");
const AdminRoute = require("../routes/AdminRoute");
const BahanBakuRoute = require("../routes/BahanBakuRoute");
const ProdukRoute = require("../routes/ProdukRoute");
const uploadRoute = require("../routes/uploadRoute");
const RiwayatRoute = require("../routes/RiwayatRoute");
const StokBahanBakuRoute = require("../routes/StokBahanBakuRoute");
const StatusProduk = require("../routes/StatusProduk");
const PenjualanProduk = require("../routes/PenjualanProduk");

// Import shared HTTP middleware
import { errorHandler } from "./shared/http/errorHandler";
import { AppError } from "./shared/http/AppError";

const app = express();

// Body parser with size limits (Guard against DoS)
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

// Session Store
export const sessionStore = new SequelizeStore({
  db: db,
  tableName: "Sessions",
  expiration: 7 * 24 * 60 * 60 * 1000, // 7 days
  checkExpirationInterval: 15 * 60 * 1000,
});

// Dynamic CORS configuration
const defaultOrigins = [
  "https://produksi.pabrikbumbu.com",
  "http://localhost:3000",
  "http://localhost:5000",
  "http://localhost:5173",
];
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : defaultOrigins;

app.use(
  cors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin tidak diizinkan oleh CORS"));
      }
    },
  })
);

// Session Middleware
app.use(
  session({
    secret: process.env.SESS_SECRET || "spu_default_session_secret",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// Health check endpoint
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Static uploads directory
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

// Application Routes
app.use(AuthRoute);
app.use(AdminRoute);
app.use(BahanBakuRoute);
app.use(ProdukRoute);
app.use(uploadRoute);
app.use(RiwayatRoute);
app.use(StokBahanBakuRoute);
app.use(StatusProduk);
app.use(PenjualanProduk);

// 404 Handler
app.use((req: Request, res: Response, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.url} tidak ditemukan.`));
});

// Central Error Handler
app.use(errorHandler);

export { app };
export default app;
