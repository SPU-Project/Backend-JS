import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { Op } from "sequelize";
import argon2 from "argon2";
import crypto from "crypto";
import { app } from "../src/app";
import { migrator } from "../src/shared/db/migrator";
import { Store, Customer, StoreStock } from "../src/modules/stores/stores.models";
import { ProductBatch } from "../src/modules/production/production.models";
import { PosTransaction, Receivable } from "../src/modules/pos/pos.models";

const ProdukModel = require("../models/ProdukModel");
const Admin = require("../models/AdminModel");

describe("Sprint 4: POS Checkout Core, ACID Concurrency & Anti-Overselling", () => {
  let authCookie: string;
  let testStore: any;
  let farmerCustomer: any;
  let productA: any;
  let batchA1: any;
  let batchA2: any;

  beforeAll(async () => {
    await migrator.up();

    // Authenticate
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
        uuid: "superadmin-uuid-test4",
        username: `superadmin_${Date.now()}`,
        email: "superadmin@sukarajapangan.com",
        password: hashedPassword,
        role: "superadmin",
      });
    }

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

    authCookie = loginRes.headers["set-cookie"][0];

    // Setup Store
    testStore = await Store.create({
      store_code: `OUTLET-CKO-${Date.now()}`,
      name: "Gerai Agro SPU Cikarang",
      type: "outlet",
      city: "Cikarang",
      is_active: true,
    });

    // Setup Farmer with 1,000,000 credit limit
    farmerCustomer = await Customer.create({
      name: "Pak Tani Sudirman",
      nik: `3216${Date.now()}`,
      type: "farmer",
      poktan_name: "Poktan Sumber Makmur",
      credit_limit: 1000000,
      current_credit: 0,
      is_active: true,
    });

    // Setup Product
    productA = await ProdukModel.create({
      KodeProduksi: `PRD-BNH-${Date.now()}`,
      namaProduk: "Benih Padi Ciherang Unggul 5kg",
      hpp: 60000,
      shelf_life_days: 180,
    });

    // Batch A1: Expiring earlier (2026-11-15), 15 units
    batchA1 = await ProductBatch.create({
      product_id: productA.id,
      batch_number: `BATCH-CKO-1-${Date.now()}`,
      manufacture_date: "2026-09-01",
      expiry_date: "2026-11-15",
      initial_qty: 15,
      current_qty: 15,
      unit_cost: 60000,
      status: "active",
    });

    // Batch A2: Expiring later (2027-01-15), 20 units
    batchA2 = await ProductBatch.create({
      product_id: productA.id,
      batch_number: `BATCH-CKO-2-${Date.now()}`,
      manufacture_date: "2026-09-01",
      expiry_date: "2027-01-15",
      initial_qty: 20,
      current_qty: 20,
      unit_cost: 60000,
      status: "active",
    });

    // Seed Store Stocks (selling price: Rp 80,000 / pack)
    await StoreStock.create({
      store_id: testStore.id,
      product_id: productA.id,
      batch_id: batchA1.id,
      quantity: 15,
      buy_price: 60000,
      selling_price: 80000,
      min_stock_alert: 5,
    });

    await StoreStock.create({
      store_id: testStore.id,
      product_id: productA.id,
      batch_id: batchA2.id,
      quantity: 20,
      buy_price: 60000,
      selling_price: 80000,
      min_stock_alert: 5,
    });
  });

  describe("1. Cash & Multi-Payment Checkout with FEFO Allocation", () => {
    it("should checkout 10 units, deduct from oldest batch first (FEFO), and accept cash payment", async () => {
      // Buy 10 units @ Rp 80,000 = Rp 800,000
      const res = await request(app)
        .post("/api/v1/pos/checkout")
        .set("Cookie", authCookie)
        .send({
          storeId: testStore.id,
          items: [{ productId: productA.id, qty: 10 }],
          discount: 0,
          payments: [{ method: "cash", amount: 800000 }],
          notes: "Penjualan tunai kasir",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.invoiceNumber).toContain(`INV-${testStore.store_code}`);
      expect(res.body.data.transaction.totalAmount).toBe(800000);
      expect(res.body.data.transaction.paymentStatus).toBe("paid");

      // Verify FEFO: Batch A1 had 15 units, now should have 5 units left
      const stock1 = await StoreStock.findOne({
        where: { store_id: testStore.id, batch_id: batchA1.id },
      });
      expect(Number(stock1.quantity)).toBe(5);

      // Batch A2 should remain untouched (20 units)
      const stock2 = await StoreStock.findOne({
        where: { store_id: testStore.id, batch_id: batchA2.id },
      });
      expect(Number(stock2.quantity)).toBe(20);
    });
  });

  describe("2. Tempo Payment (Kasbon / Yarnen) & Credit Limit Enforcement", () => {
    it("should allow partial cash + partial tempo within customer credit limit", async () => {
      // Buy 5 units @ 80,000 = 400,000
      // Pay: 100,000 cash + 300,000 tempo (farmer credit limit: 1,000,000)
      const res = await request(app)
        .post("/api/v1/pos/checkout")
        .set("Cookie", authCookie)
        .send({
          storeId: testStore.id,
          customerId: farmerCustomer.id,
          items: [{ productId: productA.id, qty: 5 }],
          discount: 0,
          payments: [
            { method: "cash", amount: 100000 },
            { method: "tempo", amount: 300000 },
          ],
          tempoDueDate: "2026-11-30",
          notes: "Petani kasbon bayar saat panen",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.transaction.paymentStatus).toBe("partial_tempo");
      expect(res.body.data.transaction.receivable).not.toBeNull();
      expect(res.body.data.transaction.receivable.totalTempo).toBe(300000);

      // Verify customer current_credit updated
      const customer = await Customer.findByPk(farmerCustomer.id);
      expect(Number(customer.current_credit)).toBe(300000);

      // Verify receivable recorded in DB
      const rec = await Receivable.findOne({
        where: { customer_id: farmerCustomer.id, status: "unpaid" },
      });
      expect(rec).not.toBeNull();
      expect(Number(rec.remaining_amount)).toBe(300000);
    });

    it("should reject checkout if tempo amount exceeds remaining credit limit", async () => {
      // Remaining credit limit = 1,000,000 - 300,000 = 700,000
      // Try to take tempo 800,000 (10 units @ 80k) -> Must reject!
      const res = await request(app)
        .post("/api/v1/pos/checkout")
        .set("Cookie", authCookie)
        .send({
          storeId: testStore.id,
          customerId: farmerCustomer.id,
          items: [{ productId: productA.id, qty: 10 }],
          discount: 0,
          payments: [{ method: "tempo", amount: 800000 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("Plafon kasbon tidak mencukupi");

      // Verify customer credit unchanged
      const customer = await Customer.findByPk(farmerCustomer.id);
      expect(Number(customer.current_credit)).toBe(300000);
    });
  });

  describe("3. Idempotency-Key Header (Anti-Double Transaction)", () => {
    it("should replay existing transaction without double deduction on repeated Idempotency-Key", async () => {
      const idempotencyKey = `idemp-${crypto.randomUUID()}`;

      // First request
      const firstRes = await request(app)
        .post("/api/v1/pos/checkout")
        .set("Cookie", authCookie)
        .set("Idempotency-Key", idempotencyKey)
        .send({
          storeId: testStore.id,
          items: [{ productId: productA.id, qty: 1 }],
          payments: [{ method: "cash", amount: 80000 }],
        });

      expect(firstRes.status).toBe(201);
      expect(firstRes.body.data.idempotentReplay).toBe(false);
      const invoiceFirst = firstRes.body.data.transaction.invoiceNumber;

      // Second identical request with same Idempotency-Key (simulating network retry)
      const secondRes = await request(app)
        .post("/api/v1/pos/checkout")
        .set("Cookie", authCookie)
        .set("Idempotency-Key", idempotencyKey)
        .send({
          storeId: testStore.id,
          items: [{ productId: productA.id, qty: 1 }],
          payments: [{ method: "cash", amount: 80000 }],
        });

      expect(secondRes.status).toBe(200);
      expect(secondRes.body.data.idempotentReplay).toBe(true);
      expect(secondRes.body.data.transaction.invoice_number).toBe(invoiceFirst);
    });
  });

  describe("4. Concurrency Stress Test: Anti-Overselling Guard", () => {
    it("should handle 20 concurrent requests on a 10-unit stock: exactly 10 succeed, 10 fail, stock is exactly 0", async () => {
      // 1. Create a special product with exactly 10 units in stock
      const scarceProduct = await ProdukModel.create({
        KodeProduksi: `PRD-SCARCE-${Date.now()}`,
        namaProduk: "Pestisida Organik Langka 500ml",
        hpp: 50000,
        shelf_life_days: 90,
      });

      const scarceBatch = await ProductBatch.create({
        product_id: scarceProduct.id,
        batch_number: `BATCH-SCARCE-${Date.now()}`,
        manufacture_date: "2026-10-01",
        expiry_date: "2027-01-01",
        initial_qty: 10,
        current_qty: 10,
        unit_cost: 50000,
        status: "active",
      });

      await StoreStock.create({
        store_id: testStore.id,
        product_id: scarceProduct.id,
        batch_id: scarceBatch.id,
        quantity: 10,
        buy_price: 50000,
        selling_price: 75000,
        min_stock_alert: 0,
      });

      // 2. Fire 20 parallel checkout requests, each wanting 1 unit
      const parallelRequests = Array.from({ length: 20 }, (_, i) => {
        return request(app)
          .post("/api/v1/pos/checkout")
          .set("Cookie", authCookie)
          .send({
            storeId: testStore.id,
            items: [{ productId: scarceProduct.id, qty: 1 }],
            payments: [{ method: "cash", amount: 75000 }],
            notes: `Concurrent checkout stress test #${i + 1}`,
          });
      });

      const responses = await Promise.all(parallelRequests);

      const successfulResponses = responses.filter((r) => r.status === 201);
      const failedResponses = responses.filter((r) => r.status === 400);

      // Exactly 10 must succeed, exactly 10 must fail
      expect(successfulResponses.length).toBe(10);
      expect(failedResponses.length).toBe(10);

      // Verify all failures are due to insufficient stock
      failedResponses.forEach((failRes) => {
        expect(failRes.body.error.message).toContain("tidak mencukupi");
      });

      // Verify final stock in DB is EXACTLY 0 (Never negative / Overselling prevented!)
      const finalStock = await StoreStock.findOne({
        where: { store_id: testStore.id, product_id: scarceProduct.id },
      });
      expect(Number(finalStock.quantity)).toBe(0);
    });
  });
});
