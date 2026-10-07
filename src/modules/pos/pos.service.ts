import { Op } from "sequelize";
import { AppError } from "../../shared/http/AppError";
import { withTransaction } from "../../shared/db/withTransaction";
import {
  PosTransaction,
  PosTransactionItem,
  PosPayment,
  Receivable,
} from "./pos.models";
import { Store, Customer, StoreStock } from "../stores/stores.models";
import { ProductBatch } from "../production/production.models";

const ProdukModel = require("../../../models/ProdukModel");

export class PosService {
  private static generateInvoiceNumber(storeCode: string): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `INV-${storeCode}-${today}-${randomSuffix}`;
  }

  private static formatDueDate(daysAhead = 30): string {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split("T")[0];
  }

  /**
   * Main POS Checkout Flow with Concurrency Row-Locking, FEFO Deduction, and Idempotency
   */
  static async checkout(
    payload: {
      storeId: number;
      customerId?: number;
      items: { productId: number; qty: number }[];
      discount?: number;
      payments: { method: "cash" | "qris" | "transfer" | "tempo"; amount: number; referenceNumber?: string }[];
      tempoDueDate?: string;
      notes?: string;
    },
    idempotencyKey?: string,
    cashierId?: number
  ) {
    // 1. Idempotency Check: Return existing transaction if matching key exists
    if (idempotencyKey) {
      const existing = await PosTransaction.findOne({
        where: { idempotency_key: idempotencyKey },
        include: [
          { model: PosTransactionItem, as: "items", include: [{ model: ProdukModel, as: "product" }] },
          { model: PosPayment, as: "payments" },
          { model: Receivable, as: "receivable" },
        ],
      });

      if (existing) {
        return {
          idempotentReplay: true,
          transaction: existing,
        };
      }
    }

    return await withTransaction(async (t) => {
      // 2. Validate Store
      const store = await Store.findByPk(payload.storeId, { transaction: t });
      if (!store || !store.is_active) {
        throw AppError.notFound(`Cabang ID ${payload.storeId} tidak ditemukan atau non-aktif.`);
      }

      // 3. Prevent deadlock: sort items by productId ASC (Hussein Nasser concurrency pattern)
      const sortedItems = [...payload.items].sort((a, b) => a.productId - b.productId);

      let subtotal = 0;
      const allocatedItemsToCreate: any[] = [];
      const stockUpdatesToPerform: { stockRecord: StoreStock; newQty: number }[] = [];

      // 4. Validate & Allocate batches per product using FEFO
      for (const item of sortedItems) {
        let remainingToFulfill = Number(item.qty);

        // Fetch store stocks ordered by FEFO (earliest expiry first) with row lock
        const availableStocks = await StoreStock.findAll({
          where: {
            store_id: payload.storeId,
            product_id: item.productId,
            quantity: { [Op.gt]: 0 },
          },
          include: [{ model: ProductBatch, as: "batch", required: true }],
          order: [[{ model: ProductBatch, as: "batch" }, "expiry_date", "ASC"]],
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        const totalStock = availableStocks.reduce((sum, s) => sum + Number(s.quantity), 0);
        if (totalStock < remainingToFulfill) {
          throw AppError.badRequest(
            `Stok produk ID ${item.productId} tidak mencukupi di ${store.name}. Dibutuhkan: ${remainingToFulfill}, Tersedia: ${totalStock}.`
          );
        }

        // Allocate batch by batch (FEFO)
        for (const stockRecord of availableStocks) {
          if (remainingToFulfill <= 0) break;

          const batchQty = Number(stockRecord.quantity);
          const allocatedQty = Math.min(batchQty, remainingToFulfill);
          const unitPrice = Number(stockRecord.selling_price);
          const lineSubtotal = Number((allocatedQty * unitPrice).toFixed(2));

          subtotal += lineSubtotal;

          allocatedItemsToCreate.push({
            product_id: item.productId,
            batch_id: stockRecord.batch_id,
            qty: allocatedQty,
            unit_price: unitPrice,
            subtotal: lineSubtotal,
          });

          stockUpdatesToPerform.push({
            stockRecord,
            newQty: batchQty - allocatedQty,
          });

          remainingToFulfill -= allocatedQty;
        }
      }

      // 5. Calculate final amounts
      const discount = Number(payload.discount || 0);
      const totalAmount = Number(Math.max(0, subtotal - discount).toFixed(2));

      // 6. Validate Payments
      const totalPaid = Number(
        payload.payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2)
      );

      if (totalPaid < totalAmount) {
        throw AppError.badRequest(
          `Total pembayaran (Rp ${totalPaid.toLocaleString("id-ID")}) kurang dari total tagihan (Rp ${totalAmount.toLocaleString("id-ID")}).`
        );
      }

      // 7. Handle Tempo (Kasbon / Yarnen) Payment & Credit Limit Validation
      const tempoPayment = payload.payments.find((p) => p.method === "tempo");
      let customer: Customer | null = null;

      if (tempoPayment) {
        if (!payload.customerId) {
          throw AppError.badRequest("Pembayaran tempo (kasbon/yarnen) mewajibkan ID pelanggan.");
        }

        customer = await Customer.findByPk(payload.customerId, {
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        if (!customer || !customer.is_active) {
          throw AppError.notFound(`Pelanggan ID ${payload.customerId} tidak ditemukan atau non-aktif.`);
        }

        const tempoAmount = Number(tempoPayment.amount);
        const creditLimit = Number(customer.credit_limit);
        const currentCredit = Number(customer.current_credit);
        const newCredit = currentCredit + tempoAmount;

        if (newCredit > creditLimit) {
          const sisaPlafon = Math.max(0, creditLimit - currentCredit);
          throw AppError.badRequest(
            `Plafon kasbon tidak mencukupi untuk ${customer.name}. Sisa plafon: Rp ${sisaPlafon.toLocaleString("id-ID")}, Pengajuan tempo: Rp ${tempoAmount.toLocaleString("id-ID")}.`
          );
        }

        // Increase current customer credit
        await customer.update({ current_credit: newCredit }, { transaction: t });
      }

      // 8. Execute Stock Deductions
      for (const update of stockUpdatesToPerform) {
        await update.stockRecord.update({ quantity: update.newQty }, { transaction: t });
      }

      // 9. Determine Payment Status
      let paymentStatus: "paid" | "partial_tempo" | "unpaid_tempo" = "paid";
      if (tempoPayment) {
        paymentStatus = Number(tempoPayment.amount) >= totalAmount ? "unpaid_tempo" : "partial_tempo";
      }

      // 10. Generate Invoice Number & Create Transaction
      const invoiceNumber = this.generateInvoiceNumber(store.store_code);

      const transaction = await PosTransaction.create(
        {
          invoice_number: invoiceNumber,
          idempotency_key: idempotencyKey || null,
          store_id: payload.storeId,
          customer_id: payload.customerId || null,
          cashier_id: cashierId || null,
          subtotal,
          discount,
          total_amount: totalAmount,
          payment_status: paymentStatus,
          notes: payload.notes || null,
        },
        { transaction: t }
      );

      // 11. Create Transaction Items
      const itemsToInsert = allocatedItemsToCreate.map((item) => ({
        ...item,
        transaction_id: transaction.id,
      }));
      await PosTransactionItem.bulkCreate(itemsToInsert, { transaction: t });

      // 12. Create Payments
      const paymentsToInsert = payload.payments.map((p) => ({
        transaction_id: transaction.id,
        method: p.method,
        amount: Number(p.amount),
        reference_number: p.referenceNumber || null,
      }));
      await PosPayment.bulkCreate(paymentsToInsert, { transaction: t });

      // 13. Create Receivable Record if Tempo
      let receivableRecord: Receivable | null = null;
      if (tempoPayment) {
        const dueDate = payload.tempoDueDate || this.formatDueDate(30);
        receivableRecord = await Receivable.create(
          {
            invoice_number: invoiceNumber,
            transaction_id: transaction.id,
            customer_id: customer!.id,
            total_amount: Number(tempoPayment.amount),
            remaining_amount: Number(tempoPayment.amount),
            status: "unpaid",
            due_date: dueDate,
          },
          { transaction: t }
        );
      }

      return {
        idempotentReplay: false,
        transaction: {
          id: transaction.id,
          invoiceNumber: transaction.invoice_number,
          storeName: store.name,
          customerName: customer ? customer.name : "Pelanggan Umum",
          subtotal,
          discount,
          totalAmount,
          paymentStatus,
          items: itemsToInsert,
          payments: paymentsToInsert,
          receivable: receivableRecord
            ? {
                invoiceNumber: receivableRecord.invoice_number,
                totalTempo: receivableRecord.total_amount,
                dueDate: receivableRecord.due_date,
              }
            : null,
        },
      };
    });
  }

  /**
   * Get transaction details by invoice number or ID
   */
  static async getTransaction(identifier: string | number) {
    const where: any = typeof identifier === "number" ? { id: identifier } : { invoice_number: identifier };

    const transaction = await PosTransaction.findOne({
      where,
      include: [
        { model: Store, as: "store" },
        { model: Customer, as: "customer" },
        {
          model: PosTransactionItem,
          as: "items",
          include: [
            { model: ProdukModel, as: "product", attributes: ["id", "namaProduk", "KodeProduksi"] },
            { model: ProductBatch, as: "batch", attributes: ["id", "batch_number", "expiry_date"] },
          ],
        },
        { model: PosPayment, as: "payments" },
        { model: Receivable, as: "receivable" },
      ],
    });

    if (!transaction) {
      throw AppError.notFound(`Transaksi ${identifier} tidak ditemukan.`);
    }

    return transaction;
  }
}
