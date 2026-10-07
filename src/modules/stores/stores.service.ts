import { Op } from "sequelize";
import { AppError } from "../../shared/http/AppError";
import { withTransaction } from "../../shared/db/withTransaction";
import {
  Store,
  Customer,
  StoreStock,
  StockTransfer,
  StockTransferItem,
} from "./stores.models";
import { ProductBatch } from "../production/production.models";

const ProdukModel = require("../../../models/ProdukModel");

export class StoreService {
  private static generateTransferCode(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `TRF-${today}-${randomSuffix}`;
  }

  /**
   * Create new store / outlet
   */
  static async createStore(data: {
    storeCode: string;
    name: string;
    type?: "warehouse_hq" | "outlet";
    address?: string;
    city?: string;
  }) {
    const existing = await Store.findOne({ where: { store_code: data.storeCode } });
    if (existing) {
      throw AppError.conflict(`Cabang dengan kode ${data.storeCode} sudah terdaftar.`);
    }

    return await Store.create({
      store_code: data.storeCode,
      name: data.name,
      type: data.type || "outlet",
      address: data.address || null,
      city: data.city || null,
      is_active: true,
    });
  }

  /**
   * List all stores
   */
  static async listStores() {
    return await Store.findAll({
      order: [["id", "ASC"]],
    });
  }

  /**
   * Create new customer (Farmer / Retail partner)
   */
  static async createCustomer(data: {
    name: string;
    nik?: string;
    phone?: string;
    address?: string;
    type?: "farmer" | "retail_shop" | "distributor";
    poktanName?: string;
    creditLimit?: number;
  }) {
    if (data.nik) {
      const existing = await Customer.findOne({ where: { nik: data.nik } });
      if (existing) {
        throw AppError.conflict(`Petani/Customer dengan NIK ${data.nik} sudah terdaftar.`);
      }
    }

    return await Customer.create({
      name: data.name,
      nik: data.nik || null,
      phone: data.phone || null,
      address: data.address || null,
      type: data.type || "farmer",
      poktan_name: data.poktanName || null,
      credit_limit: data.creditLimit || 0.0,
      current_credit: 0.0,
      is_active: true,
    });
  }

  /**
   * List customers
   */
  static async listCustomers() {
    return await Customer.findAll({
      order: [["id", "DESC"]],
    });
  }

  /**
   * Get single customer with credit status
   */
  static async getCustomerById(id: number) {
    const customer = await Customer.findByPk(id);
    if (!customer) {
      throw AppError.notFound(`Pelanggan dengan ID ${id} tidak ditemukan.`);
    }

    const availableCredit = Number(customer.credit_limit) - Number(customer.current_credit);

    return {
      customer,
      availableCredit: Math.max(0, availableCredit),
    };
  }

  /**
   * Update credit limit
   */
  static async updateCreditLimit(id: number, creditLimit: number) {
    const customer = await Customer.findByPk(id);
    if (!customer) {
      throw AppError.notFound(`Pelanggan dengan ID ${id} tidak ditemukan.`);
    }

    await customer.update({ credit_limit: creditLimit });
    return customer;
  }

  /**
   * Set selling price for store & product
   */
  static async setProductPrice(storeId: number, productId: number, sellingPrice: number) {
    const store = await Store.findByPk(storeId);
    if (!store) {
      throw AppError.notFound(`Cabang ID ${storeId} tidak ditemukan.`);
    }

    const product = await ProdukModel.findByPk(productId);
    if (!product) {
      throw AppError.notFound(`Produk ID ${productId} tidak ditemukan.`);
    }

    // Update all existing batches in this store
    await StoreStock.update(
      { selling_price: sellingPrice },
      { where: { store_id: storeId, product_id: productId } }
    );

    return {
      storeId,
      productId,
      sellingPrice,
      message: `Harga jual produk ${product.namaProduk} di cabang ${store.name} berhasil diperbarui.`,
    };
  }

  /**
   * Get store inventory breakdown per batch with FEFO near-expiry alerts
   */
  static async getStoreStocks(storeId: number, productId?: number) {
    const store = await Store.findByPk(storeId);
    if (!store) {
      throw AppError.notFound(`Cabang ID ${storeId} tidak ditemukan.`);
    }

    const where: any = { store_id: storeId };
    if (productId) {
      where.product_id = productId;
    }

    const stocks = await StoreStock.findAll({
      where,
      include: [
        {
          model: ProdukModel,
          as: "product",
          attributes: ["id", "namaProduk", "KodeProduksi"],
        },
        {
          model: ProductBatch,
          as: "batch",
          attributes: ["id", "batch_number", "manufacture_date", "expiry_date", "status"],
        },
      ],
      order: [
        [{ model: ProductBatch, as: "batch" }, "expiry_date", "ASC"], // FEFO
      ],
    });

    const now = new Date();
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

    return stocks.map((s: any) => {
      const expDate = s.batch ? new Date(s.batch.expiry_date) : null;
      const isNearExpiry = expDate ? expDate.getTime() - now.getTime() <= thirtyDaysInMs : false;
      const isBelowMinStock = Number(s.quantity) <= Number(s.min_stock_alert);

      return {
        id: s.id,
        storeId: s.store_id,
        productId: s.product_id,
        productName: s.product?.namaProduk,
        batchId: s.batch_id,
        batchNumber: s.batch?.batch_number,
        manufactureDate: s.batch?.manufacture_date,
        expiryDate: s.batch?.expiry_date,
        quantity: Number(s.quantity),
        buyPrice: Number(s.buy_price),
        sellingPrice: Number(s.selling_price),
        alerts: {
          nearExpiry: isNearExpiry,
          belowMinStock: isBelowMinStock,
        },
      };
    });
  }

  /**
   * FEFO Stock Transfer from one Store (e.g., HQ Warehouse) to an Outlet
   * Guarantees ACID consistency and lot traceability.
   */
  static async transferStock(
    payload: {
      fromStoreId: number;
      toStoreId: number;
      items: { productId: number; qty: number }[];
      notes?: string;
    },
    userId?: number
  ) {
    if (payload.fromStoreId === payload.toStoreId) {
      throw AppError.badRequest("Cabang asal dan cabang tujuan tidak boleh sama.");
    }

    const [fromStore, toStore] = await Promise.all([
      Store.findByPk(payload.fromStoreId),
      Store.findByPk(payload.toStoreId),
    ]);

    if (!fromStore || !fromStore.is_active) {
      throw AppError.notFound(`Cabang asal #${payload.fromStoreId} tidak ditemukan atau non-aktif.`);
    }
    if (!toStore || !toStore.is_active) {
      throw AppError.notFound(`Cabang tujuan #${payload.toStoreId} tidak ditemukan atau non-aktif.`);
    }

    const transferCode = this.generateTransferCode();

    return await withTransaction(async (t) => {
      // 1. Create StockTransfer record
      const transfer = await StockTransfer.create(
        {
          transfer_code: transferCode,
          from_store_id: payload.fromStoreId,
          to_store_id: payload.toStoreId,
          status: "completed",
          notes: payload.notes || null,
          created_by: userId || null,
        },
        { transaction: t }
      );

      const transferredItems: any[] = [];

      // 2. Process each requested product with FEFO allocation
      for (const item of payload.items) {
        let remainingNeeded = Number(item.qty);

        // Fetch source store stocks sorted by earliest expiry date first (FEFO)
        const availableStocks = await StoreStock.findAll({
          where: {
            store_id: payload.fromStoreId,
            product_id: item.productId,
            quantity: { [Op.gt]: 0 },
          },
          include: [{ model: ProductBatch, as: "batch", required: true }],
          order: [[{ model: ProductBatch, as: "batch" }, "expiry_date", "ASC"]],
          lock: t.LOCK.UPDATE,
          transaction: t,
        });

        const totalAvailable = availableStocks.reduce(
          (sum, s) => sum + Number(s.quantity),
          0
        );

        if (totalAvailable < remainingNeeded) {
          throw AppError.badRequest(
            `Stok produk ID ${item.productId} di ${fromStore.name} tidak mencukupi untuk transfer. Dibutuhkan: ${remainingNeeded}, Tersedia: ${totalAvailable}.`
          );
        }

        // Allocate batch by batch (FEFO)
        for (const stockRecord of availableStocks) {
          if (remainingNeeded <= 0) break;

          const currentBatchQty = Number(stockRecord.quantity);
          const allocatedQty = Math.min(currentBatchQty, remainingNeeded);

          // Deduct from source store
          await stockRecord.update(
            { quantity: currentBatchQty - allocatedQty },
            { transaction: t }
          );

          // Add / Upsert to target store
          const [targetStock] = await StoreStock.findOrCreate({
            where: {
              store_id: payload.toStoreId,
              product_id: item.productId,
              batch_id: stockRecord.batch_id,
            },
            defaults: {
              store_id: payload.toStoreId,
              product_id: item.productId,
              batch_id: stockRecord.batch_id,
              quantity: 0,
              buy_price: stockRecord.buy_price,
              selling_price: stockRecord.selling_price,
              min_stock_alert: stockRecord.min_stock_alert,
            },
            transaction: t,
          });

          await targetStock.update(
            { quantity: Number(targetStock.quantity) + allocatedQty },
            { transaction: t }
          );

          // Record transfer item
          await StockTransferItem.create(
            {
              transfer_id: transfer.id,
              product_id: item.productId,
              batch_id: stockRecord.batch_id,
              qty: allocatedQty,
            },
            { transaction: t }
          );

          transferredItems.push({
            productId: item.productId,
            batchId: stockRecord.batch_id,
            batchNumber: stockRecord.batch?.batch_number,
            expiryDate: stockRecord.batch?.expiry_date,
            qty: allocatedQty,
          });

          remainingNeeded -= allocatedQty;
        }
      }

      return {
        transfer: {
          id: transfer.id,
          transferCode: transfer.transfer_code,
          fromStore: fromStore.name,
          toStore: toStore.name,
          status: transfer.status,
        },
        items: transferredItems,
      };
    });
  }
}
