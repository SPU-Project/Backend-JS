import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { Op } from "sequelize";
import argon2 from "argon2";
import { app } from "../src/app";
import { migrator } from "../src/shared/db/migrator";
import { Customer } from "../src/modules/stores/stores.models";
import { Receivable, ReceivablePayment } from "../src/modules/receivables/receivables.models";
import { PosTransaction } from "../src/modules/pos/pos.models";

const Admin = require("../models/AdminModel");

describe("Sprint 5: Accounts Receivable (Yarnen / Kasbon) & Aging Report", () => {
  let authCookie: string;
  let testCustomer: any;
  let testTransaction: any;
  let testReceivable: any;

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
        uuid: "superadmin-uuid-test5",
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

    // Setup Customer with credit limit 2,000,000 and current debt 500,000
    testCustomer = await Customer.create({
      name: "Pak Tani Sarwono",
      nik: `3205${Date.now()}`,
      phone: "081299887766",
      type: "farmer",
      poktan_name: "Kelompok Tani Subur Jaya",
      credit_limit: 2000000,
      current_credit: 500000,
      is_active: true,
    });

    // Mock an invoice transaction
    testTransaction = await PosTransaction.create({
      invoice_number: `INV-TEST-REC-${Date.now()}`,
      store_id: 1,
      customer_id: testCustomer.id,
      subtotal: 500000,
      discount: 0,
      total_amount: 500000,
      payment_status: "unpaid_tempo",
    });

    // Setup Receivable of 500,000
    testReceivable = await Receivable.create({
      invoice_number: testTransaction.invoice_number,
      transaction_id: testTransaction.id,
      customer_id: testCustomer.id,
      total_amount: 500000,
      remaining_amount: 500000,
      status: "unpaid",
      due_date: "2026-11-30",
    });
  });

  describe("1. Receivables Inquiry & Details", () => {
    it("should list receivables filtered by customer ID", async () => {
      const res = await request(app)
        .get(`/api/v1/receivables?customerId=${testCustomer.id}`)
        .set("Cookie", authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const found = res.body.data.find((r: any) => r.id === testReceivable.id);
      expect(found).toBeDefined();
      expect(Number(found.remaining_amount)).toBe(500000);
      expect(found.status).toBe("unpaid");
    });

    it("should get single receivable detail", async () => {
      const res = await request(app)
        .get(`/api/v1/receivables/${testReceivable.id}`)
        .set("Cookie", authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testReceivable.id);
      expect(res.body.data.customer.name).toBe("Pak Tani Sarwono");
    });
  });

  describe("2. Installment & Full Settlement Lifecycle", () => {
    it("should record partial payment (installment) and restore customer credit", async () => {
      // Pay Rp 200,000 installment
      const res = await request(app)
        .post(`/api/v1/receivables/${testReceivable.id}/payments`)
        .set("Cookie", authCookie)
        .send({
          amount: 200000,
          method: "cash",
          notes: "Cicilan panen jagung awal",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.payment.amountPaid).toBe(200000);
      expect(res.body.data.receivable.remainingAmount).toBe(300000);
      expect(res.body.data.receivable.status).toBe("partially_paid");

      // Verify customer current_credit restored: 500,000 - 200,000 = 300,000
      const customer = await Customer.findByPk(testCustomer.id);
      expect(Number(customer.current_credit)).toBe(300000);
    });

    it("should reject payment exceeding remaining balance", async () => {
      // Remaining is 300,000; attempt to pay 400,000 -> must reject
      const res = await request(app)
        .post(`/api/v1/receivables/${testReceivable.id}/payments`)
        .set("Cookie", authCookie)
        .send({
          amount: 400000,
          method: "cash",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain("melebihi sisa tagihan");
    });

    it("should record final payment to settle full receivable (status: paid)", async () => {
      // Settle remaining Rp 300,000 via transfer
      const res = await request(app)
        .post(`/api/v1/receivables/${testReceivable.id}/payments`)
        .set("Cookie", authCookie)
        .send({
          amount: 300000,
          method: "transfer",
          notes: "Pelunasan penuh panen raya",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.receivable.remainingAmount).toBe(0);
      expect(res.body.data.receivable.status).toBe("paid");

      // Verify customer current_credit is now 0 (full credit limit available)
      const customer = await Customer.findByPk(testCustomer.id);
      expect(Number(customer.current_credit)).toBe(0);
      expect(res.body.data.customer.availableCredit).toBe(2000000);
    });

    it("should reject paying an already settled receivable", async () => {
      const res = await request(app)
        .post(`/api/v1/receivables/${testReceivable.id}/payments`)
        .set("Cookie", authCookie)
        .send({
          amount: 50000,
          method: "cash",
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.error.message).toContain("sudah lunas sepenuhnya");
    });
  });

  describe("3. Accounts Receivable Aging Report", () => {
    it("should generate aging report with 4 risk aging buckets", async () => {
      const res = await request(app)
        .get("/api/v1/receivables/aging-report")
        .set("Cookie", authCookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const report = res.body.data;
      expect(report.buckets).toBeDefined();
      expect(report.buckets.current_0_30).toBeDefined();
      expect(report.buckets.overdue_31_60).toBeDefined();
      expect(report.buckets.overdue_61_90).toBeDefined();
      expect(report.buckets.critical_gt_90).toBeDefined();
      expect(typeof report.totalOutstanding).toBe("number");
    });
  });
});
