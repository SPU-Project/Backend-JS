import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { Op } from "sequelize";
import argon2 from "argon2";
import { app } from "../src/app";
import { migrator } from "../src/shared/db/migrator";
import {
  Store,
  Customer,
  StoreStock,
  StockTransfer,
  StockTransferItem,
} from "../src/modules/stores/stores.models";
import { ProductBatch } from "../src/modules/production/production.models";

const ProdukModel = require("../models/ProdukModel");
const Admin = require("../models/AdminModel");

describe("Sprint 3: Master Data POS, Multi-Store, and FEFO Stock Transfer", () => {
  let authCookie: string;
  let hqStore: any;
  let outletStore: any;
  let testCustomer: any;
  let testProduct: any;
  let batchA: any;
  let batchB: any;

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
        uuid: "superadmin-uuid-test3",
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

    expect(loginRes.status).toBe(200);
    authCookie = loginRes.headers["set-cookie"][0];
  });

  describe("1. Master Store & Outlet Management", () => {
    it("should create HQ Warehouse and regional Outlet", async () => {
      const hqRes = await request(app)
        .post("/api/v1/stores")
        .set("Cookie", authCookie)
        .send({
          storeCode: `HQ-${Date.now()}`,
          name: "Gudang Utama SPU Pusat",
          type: "warehouse_hq",
          city: "Bogor",
        });

      expect(hqRes.status).toBe(201);
      expect(hqRes.body.success).toBe(true);
      hqStore = hqRes.body.data;

      const outletRes = await request(app)
        .post("/api/v1/stores")
        .set("Cookie", authCookie)
        .send({
          storeCode: `OUTLET-BGR-${Date.now()}`,
          name: "Gerai Agro SPU Sentra Bogor",
          type: "outlet",
          city: "Bogor",
        });

      expect(outletRes.status).toBe(201);
      expect(outletRes.body.success).toBe(true);
      outletStore = outletRes.body.data;
    });

    it("should list all stores including HQ and Outlet", async () => {
      const res = await request(app).get("/api/v1/stores").set("Cookie", authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("2. Customer CRM & Credit Plafond (Yarnen)", () => {
    it("should create farmer customer with initial credit limit", async () => {
      const res = await request(app)
        .post("/api/v1/customers")
        .set("Cookie", authCookie)
        .send({
          name: "Pak Haji Subur",
          nik: `3201${Date.now()}`,
          phone: "081234567890",
          type: "farmer",
          poktanName: "Kelompok Tani Makmur Sejahtera",
          creditLimit: 5000000,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe("Pak Haji Subur");
      expect(Number(res.body.data.credit_limit)).toBe(5000000);
      expect(Number(res.body.data.current_credit)).toBe(0);

      testCustomer = res.body.data;
    });

    it("should get customer detail and compute available credit", async () => {
      const res = await request(app)
        .get(`/api/v1/customers/${testCustomer.id}`)
        .set("Cookie", authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.availableCredit).toBe(5000000);
    });

    it("should update customer credit limit", async () => {
      const res = await request(app)
        .put(`/api/v1/customers/${testCustomer.id}/credit-limit`)
        .set("Cookie", authCookie)
        .send({ creditLimit: 7500000 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Number(res.body.data.credit_limit)).toBe(7500000);
    });
  });

  describe("3. FEFO Stock Transfer (HQ Warehouse -> Outlet)", () => {
    beforeAll(async () => {
      // 1. Create a Product
      testProduct = await ProdukModel.create({
        KodeProduksi: `PRD-TRF-${Date.now()}`,
        namaProduk: "Benih Unggul Cabai Rawit F1",
        hpp: 25000,
        shelf_life_days: 180,
      });

      // 2. Create 2 Finished Good Batches (Different Expiry Dates)
      // Batch A: Expiring in 20 days (FEFO First Priority)
      batchA = await ProductBatch.create({
        product_id: testProduct.id,
        batch_number: `BATCH-A-${Date.now()}`,
        manufacture_date: "2026-09-01",
        expiry_date: "2026-10-27",
        initial_qty: 20,
        current_qty: 20,
        unit_cost: 25000,
        status: "active",
      });

      // Batch B: Expiring in 120 days (FEFO Second Priority)
      batchB = await ProductBatch.create({
        product_id: testProduct.id,
        batch_number: `BATCH-B-${Date.now()}`,
        manufacture_date: "2026-10-01",
        expiry_date: "2027-02-01",
        initial_qty: 30,
        current_qty: 30,
        unit_cost: 25000,
        status: "active",
      });

      // 3. Stock them in HQ Warehouse
      await StoreStock.create({
        store_id: hqStore.id,
        product_id: testProduct.id,
        batch_id: batchA.id,
        quantity: 20,
        buy_price: 25000,
        selling_price: 35000,
        min_stock_alert: 5,
      });

      await StoreStock.create({
        store_id: hqStore.id,
        product_id: testProduct.id,
        batch_id: batchB.id,
        quantity: 30,
        buy_price: 25000,
        selling_price: 35000,
        min_stock_alert: 5,
      });
    });

    it("should transfer 25 units from HQ to Outlet using strict FEFO allocation", async () => {
      // We want to transfer 25 units.
      // Batch A has 20 units (oldest expiry) -> Must be consumed completely.
      // Batch B has 30 units (newer expiry) -> 5 units must be consumed.
      const transferRes = await request(app)
        .post("/api/v1/stores/transfers")
        .set("Cookie", authCookie)
        .send({
          fromStoreId: hqStore.id,
          toStoreId: outletStore.id,
          items: [{ productId: testProduct.id, qty: 25 }],
          notes: "Distribusi stok persiapan musim tanam",
        });

      expect(transferRes.status).toBe(200);
      expect(transferRes.body.success).toBe(true);

      const items = transferRes.body.data.items;
      expect(items.length).toBe(2);

      // Verify Batch A: 20 units transferred
      const itemA = items.find((i: any) => i.batchId === batchA.id);
      expect(itemA).toBeDefined();
      expect(itemA.qty).toBe(20);

      // Verify Batch B: 5 units transferred
      const itemB = items.find((i: any) => i.batchId === batchB.id);
      expect(itemB).toBeDefined();
      expect(itemB.qty).toBe(5);

      // Verify remaining stock in HQ Warehouse
      const hqStockA = await StoreStock.findOne({
        where: { store_id: hqStore.id, batch_id: batchA.id },
      });
      expect(Number(hqStockA.quantity)).toBe(0);

      const hqStockB = await StoreStock.findOne({
        where: { store_id: hqStore.id, batch_id: batchB.id },
      });
      expect(Number(hqStockB.quantity)).toBe(25); // 30 - 5 = 25

      // Verify newly received stock in Outlet
      const outletStockA = await StoreStock.findOne({
        where: { store_id: outletStore.id, batch_id: batchA.id },
      });
      expect(Number(outletStockA.quantity)).toBe(20);

      const outletStockB = await StoreStock.findOne({
        where: { store_id: outletStore.id, batch_id: batchB.id },
      });
      expect(Number(outletStockB.quantity)).toBe(5);
    });

    it("should query store stocks in Outlet and flag near_expiry alerts", async () => {
      const res = await request(app)
        .get(`/api/v1/stores/${outletStore.id}/stocks?productId=${testProduct.id}`)
        .set("Cookie", authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);

      // Batch A expires in ~20 days -> nearExpiry must be true
      const stockA = res.body.data.find((s: any) => s.batchId === batchA.id);
      expect(stockA.alerts.nearExpiry).toBe(true);

      // Batch B expires next year -> nearExpiry must be false
      const stockB = res.body.data.find((s: any) => s.batchId === batchB.id);
      expect(stockB.alerts.nearExpiry).toBe(false);
    });
  });
});
