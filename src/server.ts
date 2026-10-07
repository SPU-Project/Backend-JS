import dotenv from "dotenv";
dotenv.config();

import { Server } from "http";
import app, { sessionStore } from "./app";
import { migrator } from "./shared/db/migrator";
const db = require("../config/Database");
const cronStatusProduksi = require("../utils/cronStatusProduksi");

let server: Server | null = null;

export const startServer = async (): Promise<Server> => {
  try {
    // 1. Authenticate Database
    await db.authenticate();
    console.log("Database connected successfully...");

    // 2. Run Pending Migrations automatically (if not in test mode)
    if (process.env.NODE_ENV !== "test") {
      console.log("Checking database migrations...");
      await migrator.up();
      console.log("Database migrations up to date.");
    }

    // 3. Ensure Session Store sync
    await sessionStore.sync();

    // 4. Start Background Scheduler
    if (process.env.NODE_ENV !== "test") {
      cronStatusProduksi();
    }

    // 5. Start Listening
    const PORT = parseInt(process.env.APP_PORT || process.env.PORT || "3000", 10);
    server = app.listen(PORT, () => {
      console.log(`SPU Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]...`);
    });

    return server;
  } catch (error: any) {
    console.error("Fatal: Gagal memulai server:", error.message || error);
    process.exit(1);
  }
};

// Graceful Shutdown Handler
const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log("HTTP server closed.");
      try {
        await db.close();
        console.log("Database connection pool closed.");
        process.exit(0);
      } catch (err) {
        console.error("Error closing database connection:", err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

if (require.main === module) {
  startServer();
}

export default startServer;
