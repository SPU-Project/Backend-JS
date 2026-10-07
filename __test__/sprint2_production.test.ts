import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { migrator } from "../src/shared/db/migrator";
import {
  calculateRecipeCost,
  calculateMarginTiers,
} from "../src/modules/production/production.cost";
import {
  ProductionOrder,
  ProductBatch,
  RawMaterialMovement,
} from "../src/modules/production/production.models";

import { Op } from "sequelize";
import argon2 from "argon2";
const BahanBakuModel = require("../models/BahanBakuModel");
const StokBahanBaku = require("../models/StokBahanBakuModel");
const ProdukModel = require("../models/ProdukModel");
const Admin = require("../models/AdminModel");

describe("Sprint 2: Production Refactor & FEFO Batch Generation", () => {
  let authCookie: string;
  let testRaw1: any;
  let testRaw2: any;
  let createdProductId: number;
  let createdOrderId: number;

  beforeAll(async () => {
    // 1. Ensure migrations are up to date in test DB
    await migrator.up();

    // 2. Ensure superadmin exists and login to acquire auth session cookie
    let admin = await Admin.findOne({
      where: {
        [Op.or]: [
          { email: "superadmin@spu.co.id" },
          { email: "superadmin@sukarajapangan.com" },
        ],
      },
    });

    if (!admin) {
      const hashedPassword = await argon2.hash("Superadmin@123");
      admin = await Admin.create({
        uuid: "superadmin-uuid-test",
        username: `superadmin_${Date.now()}`,
        email: "superadmin@sukarajapangan.com",
        password: hashedPassword,
        role: "superadmin",
      });
    }

    // Attempt login with corresponding password
    let loginRes = await request(app).post("/login").send({
      email: admin.email,
      password: "Superadmin@123",
    });

    if (loginRes.status !== 200) {
      loginRes = await request(app).post("/login").send({
        email: admin.email,
        password: "Password123!",
      });
    }

    expect(loginRes.status).toBe(200);
    authCookie = loginRes.headers["set-cookie"][0];
  });

  describe("1. Pure Mathematical Cost Calculation (Bug B1 Guard)", () => {
    it("should calculate exact HPP without cumulative side effects", () => {
      const rawMaterials = [
        { rawMaterialId: 1, qty: 2.5, unitPrice: 20000 }, // 50,000
        { rawMaterialId: 2, qty: 1.0, unitPrice: 15000 }, // 15,000
      ];
      const packaging = [{ namaKemasan: "Pouch 250g", harga: 2500 }]; // 2,500
      const overheads = [{ namaOverhead: "Listrik & Gas", harga: 3000 }]; // 3,000

      const result = calculateRecipeCost(rawMaterials, packaging, overheads);

      expect(result.rawMaterialCost).toBe(65000);
      expect(result.packagingCost).toBe(2500);
      expect(result.overheadCost).toBe(3000);
      expect(result.totalHpp).toBe(70500);

      // Re-running with same input returns identical result (pure function)
      const repeat = calculateRecipeCost(rawMaterials, packaging, overheads);
      expect(repeat.totalHpp).toBe(70500);
    });

    it("should generate 9 margin tiers dynamically", () => {
      const hpp = 10000;
      const tiers = calculateMarginTiers(hpp);

      expect(tiers.length).toBe(9);
      expect(tiers[0]).toEqual({ percentage: 20, sellingPrice: 12000, profit: 2000 });
      expect(tiers[4]).toEqual({ percentage: 60, sellingPrice: 16000, profit: 6000 });
      expect(tiers[8]).toEqual({ percentage: 100, sellingPrice: 20000, profit: 10000 });
    });
  });

  describe("2. Production Recipe Management API", () => {
    beforeAll(async () => {
      // Setup raw materials in DB
      testRaw1 = await BahanBakuModel.create({
        BahanBaku: `Cabai Bubuk Test ${Date.now()}`,
        Satuan: "kg",
        Harga: 40000,
      });
      await StokBahanBaku.create({
        BahanBakuId: testRaw1.id,
        BahanBaku: testRaw1.BahanBaku,
        Stok: 50.0,
      });

      testRaw2 = await BahanBakuModel.create({
        BahanBaku: `Bawang Putih Test ${Date.now()}`,
        Satuan: "kg",
        Harga: 30000,
      });
      await StokBahanBaku.create({
        BahanBakuId: testRaw2.id,
        BahanBaku: testRaw2.BahanBaku,
        Stok: 50.0,
      });
    });

    it("should create recipe with atomic transaction and return HPP breakdown", async () => {
      const payload = {
        namaProduk: `Bumbu Tabur Balado Test ${Date.now()}`,
        shelfLifeDays: 180,
        bahanBaku: [
          { id: testRaw1.id, jumlah: 0.5 }, // 0.5 * 40,000 = 20,000
          { id: testRaw2.id, jumlah: 0.2 }, // 0.2 * 30,000 = 6,000
        ],
        kemasan: [{ namaKemasan: "Botol Plastik 100g", harga: 1500 }],
        overhead: [{ namaOverhead: "Penyusutan Mesin", harga: 500 }],
      };

      const res = await request(app)
        .post("/api/v1/production/recipes")
        .set("Cookie", authCookie)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product).toBeDefined();
      expect(res.body.data.product.namaProduk).toBe(payload.namaProduk);
      // Total HPP = 20,000 + 6,000 + 1,500 + 500 = 28,000
      expect(Number(res.body.data.costBreakdown.totalHpp)).toBe(28000);
      expect(res.body.data.marginTiers.length).toBe(9);

      createdProductId = res.body.data.product.id;
    });

    it("should update recipe and recalculate HPP without cumulative bug B1", async () => {
      // Update by altering ingredient quantities
      const updatePayload = {
        namaProduk: `Bumbu Tabur Balado Test Updated ${Date.now()}`,
        shelfLifeDays: 180,
        bahanBaku: [
          { id: testRaw1.id, jumlah: 1.0 }, // 1.0 * 40,000 = 40,000
          { id: testRaw2.id, jumlah: 0.5 }, // 0.5 * 30,000 = 15,000
        ],
        kemasan: [{ namaKemasan: "Botol Plastik 100g", harga: 1500 }],
        overhead: [{ namaOverhead: "Penyusutan Mesin", harga: 500 }],
      };

      const res = await request(app)
        .put(`/api/v1/production/recipes/${createdProductId}`)
        .set("Cookie", authCookie)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // New HPP = 40,000 + 15,000 + 1,500 + 500 = 57,000 (NOT 28,000 + 57,000)
      expect(Number(res.body.data.costBreakdown.totalHpp)).toBe(57000);
    });
  });

  describe("3. Production Order & FEFO Batch Generation", () => {
    it("should create production order with status planned", async () => {
      const res = await request(app)
        .post("/api/v1/production/orders")
        .set("Cookie", authCookie)
        .send({
          productId: createdProductId,
          plannedQty: 10, // Needs 10 * 1.0 = 10kg testRaw1, 10 * 0.5 = 5kg testRaw2
          notes: "Batch produksi batch uji coba",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("planned");
      expect(res.body.data.planned_qty).toBe(10);

      createdOrderId = res.body.data.id;
    });

    it("should reject completion and rollback if raw material stock is insufficient", async () => {
      // Create order with massive plannedQty exceeding available stock (available: 50kg)
      const hugeOrderRes = await request(app)
        .post("/api/v1/production/orders")
        .set("Cookie", authCookie)
        .send({
          productId: createdProductId,
          plannedQty: 9999, // Needs 9,999kg, exceeds 50kg!
        });

      const hugeOrderId = hugeOrderRes.body.data.id;

      const completeRes = await request(app)
        .post(`/api/v1/production/orders/${hugeOrderId}/complete`)
        .set("Cookie", authCookie)
        .send({ actualYield: 9999 });

      expect(completeRes.status).toBe(400);
      expect(completeRes.body.success).toBe(false);
      expect(completeRes.body.error.message).toContain("tidak mencukupi untuk produksi");

      // Verify stock in DB was NOT decremented (rollback verified)
      const stock1 = await StokBahanBaku.findOne({ where: { BahanBakuId: testRaw1.id } });
      expect(Number(stock1.Stok)).toBe(50.0);
    });

    it("should complete production order, deduct raw materials, and spawn FEFO batch", async () => {
      const completeRes = await request(app)
        .post(`/api/v1/production/orders/${createdOrderId}/complete`)
        .set("Cookie", authCookie)
        .send({
          actualYield: 10,
          manufactureDate: "2026-10-01",
          shelfLifeDays: 90,
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.success).toBe(true);

      const summary = completeRes.body.data.summary;
      expect(summary.actualYield).toBe(10);
      expect(summary.batchNumber).toContain("BATCH-SPU-");
      expect(summary.manufactureDate).toBe("2026-10-01");
      // 2026-10-01 + 90 days = 2026-12-30
      expect(summary.expiryDate).toBe("2026-12-30");

      // Verify raw material stock deduction in DB:
      // testRaw1: 50 - 10 = 40
      const stock1 = await StokBahanBaku.findOne({ where: { BahanBakuId: testRaw1.id } });
      expect(Number(stock1.Stok)).toBe(40.0);

      // testRaw2: 50 - 5 = 45
      const stock2 = await StokBahanBaku.findOne({ where: { BahanBakuId: testRaw2.id } });
      expect(Number(stock2.Stok)).toBe(45.0);

      // Verify movement ledger record
      const movements = await RawMaterialMovement.findAll({
        where: { production_order_id: createdOrderId },
      });
      expect(movements.length).toBe(2);
      expect(movements[0].type).toBe("out");

      // Verify batch in DB
      const batchInDb = await ProductBatch.findOne({
        where: { production_order_id: createdOrderId },
      });
      expect(batchInDb).not.toBeNull();
      expect(batchInDb.status).toBe("active");
      expect(Number(batchInDb.current_qty)).toBe(10);
    });

    it("should prevent completing the same order twice (idempotency guard)", async () => {
      const duplicateRes = await request(app)
        .post(`/api/v1/production/orders/${createdOrderId}/complete`)
        .set("Cookie", authCookie)
        .send({ actualYield: 10 });

      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error.code).toBe("CONFLICT");
    });
  });

  describe("4. FEFO Finished Goods Inventory Query", () => {
    it("should list active batches sorted by earliest expiry date first (FEFO)", async () => {
      const res = await request(app)
        .get("/api/v1/production/batches")
        .set("Cookie", authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const batches = res.body.data;
      expect(batches.length).toBeGreaterThanOrEqual(1);

      // Verify FEFO sorting (expiry_date ascending)
      for (let i = 0; i < batches.length - 1; i++) {
        const currentExp = new Date(batches[i].expiry_date).getTime();
        const nextExp = new Date(batches[i + 1].expiry_date).getTime();
        expect(currentExp).toBeLessThanOrEqual(nextExp);
      }
    });
  });
});
