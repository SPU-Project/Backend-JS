import { Op } from "sequelize";
import { AppError } from "../../shared/http/AppError";
import { withTransaction } from "../../shared/db/withTransaction";
import { Receivable, ReceivablePayment } from "./receivables.models";
import { Customer } from "../stores/stores.models";
import { PosTransaction } from "../pos/pos.models";
import { cacheService } from "../../shared/cache/cache.service";

export class ReceivablesService {
  private static generatePaymentCode(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `PAY-REC-${today}-${randomSuffix}`;
  }

  /**
   * List receivables with filters
   */
  static async listReceivables(filters?: { customerId?: number; status?: string }) {
    const where: any = {};
    if (filters?.customerId) {
      where.customer_id = filters.customerId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return await Receivable.findAll({
      where,
      order: [["due_date", "ASC"]],
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "phone", "poktan_name"] },
        { model: PosTransaction, as: "transaction", attributes: ["id", "invoice_number", "total_amount", "createdAt"] },
      ],
    });
  }

  /**
   * Get single receivable details with installment history
   */
  static async getReceivableById(id: number) {
    const receivable = await Receivable.findByPk(id, {
      include: [
        { model: Customer, as: "customer" },
        { model: PosTransaction, as: "transaction" },
        {
          model: ReceivablePayment,
          as: "installments",
          order: [["createdAt", "DESC"]],
        },
      ],
    });

    if (!receivable) {
      throw AppError.notFound(`Tagihan piutang #${id} tidak ditemukan.`);
    }

    return receivable;
  }

  /**
   * Record installment or full payment against a receivable
   * Restores customer credit limit in ACID transaction.
   */
  static async payReceivable(
    id: number,
    payload: { amount: number; method: "cash" | "transfer" | "qris"; notes?: string },
    userId?: number
  ) {
    let customerIdToInvalidate: number | null = null;

    const result = await withTransaction(async (t) => {
      // 1. Lock Receivable without outer join
      const receivable = await Receivable.findByPk(id, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!receivable) {
        throw AppError.notFound(`Tagihan piutang #${id} tidak ditemukan.`);
      }

      customerIdToInvalidate = receivable.customer_id;

      if (receivable.status === "paid") {
        throw AppError.conflict("Tagihan piutang ini sudah lunas sepenuhnya.");
      }

      const remainingAmount = Number(receivable.remaining_amount);
      const payAmount = Number(payload.amount);

      if (payAmount > remainingAmount) {
        throw AppError.badRequest(
          `Nominal pembayaran (Rp ${payAmount.toLocaleString("id-ID")}) melebihi sisa tagihan (Rp ${remainingAmount.toLocaleString("id-ID")}).`
        );
      }

      // 2. Lock & Update Customer credit balance
      const customer = await Customer.findByPk(receivable.customer_id, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (customer) {
        const newCredit = Math.max(0, Number(customer.current_credit) - payAmount);
        await customer.update({ current_credit: newCredit }, { transaction: t });
      }

      // 3. Update Receivable
      const newRemaining = Number((remainingAmount - payAmount).toFixed(2));
      const newStatus = newRemaining === 0 ? "paid" : "partially_paid";

      await receivable.update(
        {
          remaining_amount: newRemaining,
          status: newStatus,
        },
        { transaction: t }
      );

      // 4. Create Payment Record
      const paymentCode = this.generatePaymentCode();
      const payment = await ReceivablePayment.create(
        {
          payment_code: paymentCode,
          receivable_id: receivable.id,
          amount: payAmount,
          method: payload.method,
          notes: payload.notes || null,
          received_by: userId || null,
        },
        { transaction: t }
      );

      return {
        payment: {
          code: payment.payment_code,
          amountPaid: payAmount,
          method: payment.method,
          date: payment.createdAt,
        },
        receivable: {
          id: receivable.id,
          invoiceNumber: receivable.invoice_number,
          remainingAmount: newRemaining,
          status: newStatus,
        },
        customer: customer
          ? {
              name: customer.name,
              currentCredit: customer.current_credit,
              availableCredit: Math.max(0, Number(customer.credit_limit) - Number(customer.current_credit)),
            }
          : null,
      };
    });

    // Invalidate cached customer profile
    if (customerIdToInvalidate) {
      await cacheService.del(`customer:${customerIdToInvalidate}`);
    }

    return result;
  }

  /**
   * Accounts Receivable (AR) Aging Report:
   * Categorizes outstanding debt into 0-30, 31-60, 61-90, and >90 days buckets.
   */
  static async getAgingReport() {
    const unpaidReceivables = await Receivable.findAll({
      where: {
        status: { [Op.ne]: "paid" },
      },
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "poktan_name", "phone"] },
      ],
      order: [["createdAt", "ASC"]],
    });

    const now = new Date();

    const report = {
      totalOutstanding: 0,
      buckets: {
        current_0_30: { label: "0 - 30 Hari (Musim Tanam Awal)", total: 0, count: 0, items: [] as any[] },
        overdue_31_60: { label: "31 - 60 Hari (Fase Pertumbuhan)", total: 0, count: 0, items: [] as any[] },
        overdue_61_90: { label: "61 - 90 Hari (Menjelang Panen)", total: 0, count: 0, items: [] as any[] },
        critical_gt_90: { label: "> 90 Hari (Lewat Masa Panen / Risiko Tinggi)", total: 0, count: 0, items: [] as any[] },
      },
    };

    for (const rec of unpaidReceivables) {
      const createdDate = new Date(rec.createdAt);
      const diffTime = Math.abs(now.getTime() - createdDate.getTime());
      const ageDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const amount = Number(rec.remaining_amount);

      report.totalOutstanding = Number((report.totalOutstanding + amount).toFixed(2));

      const itemSummary = {
        receivableId: rec.id,
        invoiceNumber: rec.invoice_number,
        customerName: (rec as any).customer?.name,
        poktanName: (rec as any).customer?.poktan_name,
        ageDays,
        dueDate: rec.due_date,
        remainingAmount: amount,
      };

      if (ageDays <= 30) {
        report.buckets.current_0_30.total = Number((report.buckets.current_0_30.total + amount).toFixed(2));
        report.buckets.current_0_30.count++;
        report.buckets.current_0_30.items.push(itemSummary);
      } else if (ageDays <= 60) {
        report.buckets.overdue_31_60.total = Number((report.buckets.overdue_31_60.total + amount).toFixed(2));
        report.buckets.overdue_31_60.count++;
        report.buckets.overdue_31_60.items.push(itemSummary);
      } else if (ageDays <= 90) {
        report.buckets.overdue_61_90.total = Number((report.buckets.overdue_61_90.total + amount).toFixed(2));
        report.buckets.overdue_61_90.count++;
        report.buckets.overdue_61_90.items.push(itemSummary);
      } else {
        report.buckets.critical_gt_90.total = Number((report.buckets.critical_gt_90.total + amount).toFixed(2));
        report.buckets.critical_gt_90.count++;
        report.buckets.critical_gt_90.items.push(itemSummary);
      }
    }

    return report;
  }
}
