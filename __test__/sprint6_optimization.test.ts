import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { migrator } from "../src/shared/db/migrator";
import { cacheService } from "../src/shared/cache/cache.service";
import { ExplainHelper } from "../src/shared/db/explainHelper";
import { Store, Customer, StoreStock } from "../src/modules/stores/stores.models";
import { ProductBatch } from "../src/modules/production/production.models";
const db = require("../config/Database");
const Admin = require("../models/AdminModel");
const ProdukModel = require("../models/ProdukModel");

describe("Sprint 6: Database & Query Performance Optimization + Redis Caching", () => {
  let authCookie: string;
  let testStoreId: number;
  let testProductId: number;
  let testCustomerId: number;

  beforeAll(async () => {
    // 1. Run migrations up to 006
    await migrator.up();

    // 2. Clear cache
    await cacheService.flush();

    // 3. Create superadmin & login
    const argon2 = await import("argon2");
    const hash = await argon2.hash("SuperSecret123!");

    const [admin] = await Admin.findOrCreate({
      where: { email: "admin.opt@spu.co.id" },
      defaults: {
        username: "admin_opt",
        email: "admin.opt@spu.co.id",
        password: hash,
        role: "superadmin",
      },
    });

    const loginRes = await request(app)
      .post("/login")
      .send({ email: "admin.opt@spu.co.id", password: "SuperSecret123!" });

    authCookie = loginRes.headers["set-cookie"][0];

    // 4. Create seed store & product
    const store = await Store.create({
      store_code: `OPT-${Date.now().toString().slice(-4)}`,
      name: "Toko Optimasi Agro",
      type: "outlet",
      is_active: true,
    });
    testStoreId = store.id;

    const product = await ProdukModel.create({
      namaProduk: `Beras Optimal ${Date.now()}`,
      KodeProduksi: `PRD-OPT-${Date.now().toString().slice(-4)}`,
      stok: 100,
      hpp: 10000,
      harga: 15000,
      shelf_life_days: 90,
    });
    testProductId = product.id;

    const batch = await ProductBatch.create({
      product_id: testProductId,
      batch_number: `BATCH-OPT-${Date.now()}`,
      manufacture_date: "2026-10-01",
      expiry_date: "2027-01-01",
      initial_qty: 50,
      current_qty: 50,
      unit_cost: 10000,
      status: "active",
    });

    await StoreStock.create({
      store_id: testStoreId,
      product_id: testProductId,
      batch_id: batch.id,
      quantity: 50,
      buy_price: 10000,
      selling_price: 15000,
    });

    const customer = await Customer.create({
      name: "Petani Modern",
      nik: `3201${Date.now().toString().slice(-12)}`,
      credit_limit: 1000000,
      current_credit: 200000,
      is_active: true,
    });
    testCustomerId = customer.id;
  });

  afterAll(async () => {
    await cacheService.flush();
    await cacheService.disconnect();
  });

  describe("1. PostgreSQL Compound & Composite Indexes Verification", () => {
    it("should have all performance compound indexes registered in pg_indexes", async () => {
      const [indexes]: any = await db.query(`
        SELECT tablename, indexname 
        FROM pg_indexes 
        WHERE schemaname = 'public';
      `);

      const indexNames = indexes.map((idx: any) => idx.indexname);

      const requiredIndexes = [
        "idx_store_stocks_store_prod_qty",
        "idx_product_batches_fefo",
        "idx_pos_items_tx_id",
        "idx_pos_items_prod_id",
        "idx_pos_items_batch_id",
        "idx_pos_payments_tx_id",
        "idx_pos_tx_cashier_date",
        "idx_pos_tx_customer_id",
        "idx_pos_tx_store_status",
        "idx_transfers_from_store_status",
        "idx_transfers_to_store_status",
        "idx_transfer_items_transfer_id",
        "idx_raw_mat_movements_date",
        "idx_customers_type_active",
      ];

      for (const required of requiredIndexes) {
        expect(indexNames).toContain(required);
      }
    });
  });

  describe("2. Resilient CacheService Unit Behavior", () => {
    it("should set, get, and delete values correctly", async () => {
      const key = "test:unit_key";
      const data = { hello: "world", count: 42 };

      await cacheService.set(key, data, 10);
      const retrieved = await cacheService.get(key);
      expect(retrieved).toEqual(data);

      await cacheService.del(key);
      const afterDel = await cacheService.get(key);
      expect(afterDel).toBeNull();
    });

    it("should support wildcard pattern invalidation (delByPattern)", async () => {
      await cacheService.set("price:store1:prod1", 10000);
      await cacheService.set("price:store1:prod2", 20000);
      await cacheService.set("user:profile:1", { name: "test" });

      await cacheService.delByPattern("price:store1:*");

      expect(await cacheService.get("price:store1:prod1")).toBeNull();
      expect(await cacheService.get("price:store1:prod2")).toBeNull();
      expect(await cacheService.get("user:profile:1")).not.toBeNull();
    });

    it("should report cache statistics and health ping", async () => {
      const stats = await cacheService.getStats();
      expect(["redis", "memory"]).toContain(stats.driver);
      expect(stats.isConnected).toBe(true);

      const isAlive = await cacheService.ping();
      expect(isAlive).toBe(true);
    });
  });

  describe("3. Cache-Aside Pattern: Store Product Pricing & Cache Invalidation", () => {
    it("should return fromCache: false on first lookup (cache miss), and fromCache: true on subsequent (cache hit)", async () => {
      // 1st lookup -> Miss
      const res1 = await request(app)
        .get(`/api/v1/stores/${testStoreId}/products/${testProductId}/price`)
        .set("Cookie", authCookie);

      expect(res1.status).toBe(200);
      expect(res1.body.data.sellingPrice).toBe(15000);
      expect(res1.body.data.fromCache).toBe(false);

      // 2nd lookup -> Hit
      const res2 = await request(app)
        .get(`/api/v1/stores/${testStoreId}/products/${testProductId}/price`)
        .set("Cookie", authCookie);

      expect(res2.status).toBe(200);
      expect(res2.body.data.sellingPrice).toBe(15000);
      expect(res2.body.data.fromCache).toBe(true);
    });

    it("should invalidate cached price when price is updated, returning fresh price on next request", async () => {
      // Update price
      const updateRes = await request(app)
        .post("/api/v1/stores/prices")
        .set("Cookie", authCookie)
        .send({
          storeId: testStoreId,
          productId: testProductId,
          sellingPrice: 17500,
        });

      expect(updateRes.status).toBe(200);

      // 3rd lookup -> Cache was invalidated, so fromCache must be false and price is 17500
      const res3 = await request(app)
        .get(`/api/v1/stores/${testStoreId}/products/${testProductId}/price`)
        .set("Cookie", authCookie);

      expect(res3.status).toBe(200);
      expect(res3.body.data.sellingPrice).toBe(17500);
      expect(res3.body.data.fromCache).toBe(false);
    });
  });

  describe("4. Cache-Aside Pattern: Customer CRM & Credit Profile", () => {
    it("should cache customer lookup and invalidate upon credit limit update", async () => {
      // 1st lookup -> Miss
      const res1 = await request(app)
        .get(`/api/v1/customers/${testCustomerId}`)
        .set("Cookie", authCookie);

      expect(res1.status).toBe(200);
      expect(res1.body.data.fromCache).toBe(false);

      // 2nd lookup -> Hit
      const res2 = await request(app)
        .get(`/api/v1/customers/${testCustomerId}`)
        .set("Cookie", authCookie);

      expect(res2.status).toBe(200);
      expect(res2.body.data.fromCache).toBe(true);

      // Update credit limit
      await request(app)
        .put(`/api/v1/customers/${testCustomerId}/credit-limit`)
        .set("Cookie", authCookie)
        .send({ creditLimit: 1500000 });

      // 3rd lookup -> Cache invalidated, fresh fetch
      const res3 = await request(app)
        .get(`/api/v1/customers/${testCustomerId}`)
        .set("Cookie", authCookie);

      expect(res3.status).toBe(200);
      expect(res3.body.data.fromCache).toBe(false);
      expect(Number(res3.body.data.customer.credit_limit)).toBe(1500000);
    });
  });

  describe("5. EXPLAIN (ANALYZE, BUFFERS) Index Scan Verification", () => {
    it("should perform an Index Scan on store_stocks compound lookup", async () => {
      const explainRes = await ExplainHelper.explainQuery(
        `SELECT * FROM store_stocks WHERE store_id = ? AND product_id = ? AND quantity > 0;`,
        [testStoreId, testProductId]
      );

      expect(explainRes.isIndexScan).toBe(true);
      expect(explainRes.nodeType).toMatch(/Index/i);
      expect(explainRes.executionTimeMs).toBeLessThan(15); // Sub-15ms
    });

    it("should perform an Index Scan on POS transactions store & status query", async () => {
      const explainRes = await ExplainHelper.explainQuery(
        `SELECT * FROM pos_transactions WHERE store_id = ? AND payment_status = 'paid' ORDER BY "createdAt" DESC;`,
        [testStoreId]
      );

      expect(explainRes.isIndexScan).toBe(true);
      expect(explainRes.nodeType).toMatch(/Index/i);
    });
  });

  describe("6. Performance API Endpoints", () => {
    it("GET /api/v1/cache/stats should return cache driver and status", async () => {
      const res = await request(app)
        .get("/api/v1/cache/stats")
        .set("Cookie", authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isConnected).toBe(true);
    });

    it("POST /api/v1/performance/explain should return query execution plan metrics", async () => {
      const res = await request(app)
        .post("/api/v1/performance/explain")
        .set("Cookie", authCookie)
        .send({
          template: "fefo_stock_lookup",
          storeId: testStoreId,
          productId: testProductId,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isIndexScan).toBe(true);
      expect(res.body.data.nodeType).toMatch(/Index/i);
      expect(res.body.data.executionTimeMs).toBeDefined();
    });

    it("POST /api/v1/cache/flush should clear cache keys", async () => {
      const res = await request(app)
        .post("/api/v1/cache/flush")
        .set("Cookie", authCookie);

      expect(res.status).toBe(200);
      expect(res.body.data.message).toMatch(/flushed/i);
    });
  });
});
