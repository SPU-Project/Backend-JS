import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express from "express";
import { z, ZodError } from "zod";
import { AppError } from "../src/shared/http/AppError";
import { sendSuccess, sendError } from "../src/shared/http/response";
import { errorHandler } from "../src/shared/http/errorHandler";
import { withTransaction } from "../src/shared/db/withTransaction";
import { migrator } from "../src/shared/db/migrator";
const db = require("../config/Database");
const BahanBakuModel = require("../models/BahanBakuModel");

describe("Sprint 1: TypeScript Foundation & Layered Architecture Verification", () => {
  let testApp: express.Application;

  beforeAll(async () => {
    // Ensure test database migrations are applied
    await migrator.up();

    // Build isolated Express app for testing errorHandler and responses
    testApp = express();
    testApp.use(express.json());

    // Test routes for HTTP envelope verification
    testApp.get("/test/success", (req, res) => {
      sendSuccess(res, { item: "sample-data" }, 200, { page: 1, limit: 10 });
    });

    testApp.get("/test/custom-error", (req, res) => {
      sendError(res, 400, "Operasi tidak diizinkan", "INVALID_OPERATION", { reason: "test" });
    });

    testApp.get("/test/app-error-bad-request", () => {
      throw AppError.badRequest("Input tidak valid", "CUSTOM_BAD_REQUEST", { field: "name" });
    });

    testApp.get("/test/app-error-not-found", () => {
      throw AppError.notFound("Data spesifik tidak ditemukan", "RECORD_NOT_FOUND");
    });

    testApp.post("/test/zod-validation", (req, res, next) => {
      try {
        const schema = z.object({
          email: z.string().email("Format email salah"),
          qty: z.number().positive("Kuantitas harus bilangan positif"),
        });
        const validated = schema.parse(req.body);
        sendSuccess(res, validated);
      } catch (err) {
        next(err);
      }
    });

    testApp.get("/test/unhandled-error", () => {
      throw new Error("Simulated unhandled exception");
    });

    // Central error handler
    testApp.use(errorHandler);
  });

  describe("1. Shared HTTP Response Envelope", () => {
    it("should return standard success envelope with data and meta", async () => {
      const res = await request(testApp).get("/test/success");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ item: "sample-data" });
      expect(res.body.meta).toEqual({ page: 1, limit: 10 });
    });

    it("should return standard error envelope when sendError is invoked", async () => {
      const res = await request(testApp).get("/test/custom-error");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("INVALID_OPERATION");
      expect(res.body.error.message).toBe("Operasi tidak diizinkan");
      expect(res.body.error.details).toEqual({ reason: "test" });
    });
  });

  describe("2. Centralized Error Handler & Exception Mapping", () => {
    it("should catch AppError badRequest and format 400 JSON envelope", async () => {
      const res = await request(testApp).get("/test/app-error-bad-request");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CUSTOM_BAD_REQUEST");
      expect(res.body.error.message).toBe("Input tidak valid");
      expect(res.body.error.details).toEqual({ field: "name" });
    });

    it("should catch AppError notFound and format 404 JSON envelope", async () => {
      const res = await request(testApp).get("/test/app-error-not-found");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("RECORD_NOT_FOUND");
      expect(res.body.error.message).toBe("Data spesifik tidak ditemukan");
    });

    it("should catch ZodError and format 422 VALIDATION_ERROR envelope", async () => {
      const res = await request(testApp).post("/test/zod-validation").send({
        email: "not-an-email",
        qty: -5,
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(Array.isArray(res.body.error.details)).toBe(true);
      expect(res.body.error.details.length).toBe(2);

      const fields = res.body.error.details.map((d: any) => d.field);
      expect(fields).toContain("email");
      expect(fields).toContain("qty");
    });

    it("should catch unexpected errors and return 500 INTERNAL_ERROR", async () => {
      const res = await request(testApp).get("/test/unhandled-error");
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("3. Database Transaction Wrapper (withTransaction)", () => {
    it("should commit records executed inside withTransaction successfully", async () => {
      const uniqueName = `Bahan-Tx-Success-${Date.now()}`;

      const created = await withTransaction(async (t) => {
        return await BahanBakuModel.create(
          {
            BahanBaku: uniqueName,
            Satuan: "kg",
            Harga: 50000,
          },
          { transaction: t }
        );
      });

      expect(created).toBeDefined();
      expect(created.BahanBaku).toBe(uniqueName);

      // Verify record is committed in DB
      const found = await BahanBakuModel.findOne({ where: { BahanBaku: uniqueName } });
      expect(found).not.toBeNull();
      expect(found.BahanBaku).toBe(uniqueName);

      // Cleanup
      await BahanBakuModel.destroy({ where: { BahanBaku: uniqueName } });
    });

    it("should automatically rollback on error and leave no orphaned records", async () => {
      const uniqueName = `Bahan-Tx-Fail-${Date.now()}`;

      await expect(
        withTransaction(async (t) => {
          await BahanBakuModel.create(
            {
              BahanBaku: uniqueName,
              Satuan: "kg",
              Harga: 25000,
            },
            { transaction: t }
          );

          // Force an intentional rollback exception
          throw new Error("Forced transaction rollback simulation");
        })
      ).rejects.toThrow("Forced transaction rollback simulation");

      // Verify record was rolled back and does not exist in DB
      const found = await BahanBakuModel.findOne({ where: { BahanBaku: uniqueName } });
      expect(found).toBeNull();
    });
  });

  describe("4. Umzug Migrations & Deterministic Schema", () => {
    it("should verify executed migrations in SequelizeMeta storage", async () => {
      const executed = await migrator.executed();
      const executedNames = executed.map((m) => m.name);

      expect(executedNames).toContain("001_initial_schema.ts");
    });

    it("should ensure core tables exist in PostgreSQL information_schema", async () => {
      const [results]: any = await db.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);

      const tableNames = results.map((r: any) => r.table_name);
      expect(tableNames).toContain("Admin");
      expect(tableNames).toContain("bahanbakumodel");
      expect(tableNames).toContain("StokBahanBaku");
      expect(tableNames).toContain("ProdukModel");
      expect(tableNames).toContain("ProdukBahanBakuModel");
      expect(tableNames).toContain("Sessions");
      expect(tableNames).toContain("SequelizeMeta");
    });
  });
});
