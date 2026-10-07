const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);

const db = require("./config/Database.js");

// Import models
require("./models/AdminModel.js");
require("./models/BahanBakuModel.js");
require("./models/KemasanModel.js");
require("./models/OverheadModel.js");
require("./models/ProdukBahanBakuModel.js");
require("./models/ProdukModel.js");
require("./models/RiwayatLog.js");
require("./models/StokBahanBakuModel.js");
require("./models/StatusProduksiModel.js");
require("./models/PenjualanProdukModel.js");
require("./models/association.js");

// Import background scheduler
const cronStatusProduksi = require("./utils/cronStatusProduksi.js");

// Import routes
const AuthRoute = require("./routes/AuthRoute.js");
const AdminRoute = require("./routes/AdminRoute.js");
const BahanBakuRoute = require("./routes/BahanBakuRoute.js");
const ProdukRoute = require("./routes/ProdukRoute.js");
const uploadRoute = require("./routes/uploadRoute.js");
const RiwayatRoute = require("./routes/RiwayatRoute.js");
const StokBahanBakuRoute = require("./routes/StokBahanBakuRoute.js");
const StatusProduk = require("./routes/StatusProduk.js");
const PenjualanProduk = require("./routes/PenjualanProduk.js");

const app = express();

// Body parser with size limits
app.use(express.json({ limit: "200kb" }));
app.use(express.urlencoded({ extended: true, limit: "200kb" }));

// Session Store
const store = new SequelizeStore({
  db: db,
  expiration: 7 * 24 * 60 * 60 * 1000, // 7 hari
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
    store: store,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// Static uploads
app.use("/uploads", express.static("uploads"));

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
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.url} tidak ditemukan` });
});

// Central Error Handler
app.use((err, req, res, next) => {
  console.error("Internal Server Error:", err.message);
  res.status(err.status || 500).json({
    message: err.message || "Internal Server Error",
  });
});

// Modern Graceful Startup
const startServer = async () => {
  try {
    // 1. Authenticate Database
    await db.authenticate();
    console.log("Database connected successfully...");

    // 2. Synchronize Schema (Single clean sync for all registered models & associations)
    await db.sync({ alter: true });
    console.log("Database models synchronized...");

    // 3. Synchronize Session Table
    await store.sync();

    // 4. Start Background Scheduler
    cronStatusProduksi();

    // 5. Start Listening
    const PORT = process.env.APP_PORT || process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server up and running on port ${PORT}...`);
    });
  } catch (error) {
    console.error("Fatal: Gagal memulai server:", error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, db, startServer };
