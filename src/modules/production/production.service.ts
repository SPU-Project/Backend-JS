import { Op, Transaction } from "sequelize";
import { AppError } from "../../shared/http/AppError";
import { withTransaction } from "../../shared/db/withTransaction";
import {
  calculateRecipeCost,
  calculateMarginTiers,
  RecipeCostBreakdown,
  MarginTier,
} from "./production.cost";
import {
  ProductionOrder,
  ProductBatch,
  RawMaterialMovement,
} from "./production.models";

const db = require("../../../config/Database");
const ProdukModel = require("../../../models/ProdukModel");
const BahanBakuModel = require("../../../models/BahanBakuModel");
const StokBahanBaku = require("../../../models/StokBahanBakuModel");
const ProdukBahanBakuModel = require("../../../models/ProdukBahanBakuModel");
const KemasanModel = require("../../../models/KemasanModel");
const OverheadModel = require("../../../models/OverheadModel");

export class ProductionService {
  /**
   * Helper to format date as YYYY-MM-DD
   */
  private static formatDateOnly(date: Date = new Date()): string {
    return date.toISOString().split("T")[0];
  }

  /**
   * Generates unique sequential/timestamp code
   */
  private static generateCode(prefix: string): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${today}-${randomSuffix}`;
  }

  /**
   * Create recipe (Produk) with verified HPP and batch-creation of components
   */
  static async createRecipe(data: any, userId?: number) {
    const rawMaterialIds = data.bahanBaku.map((b: any) => b.id);

    // 1. Batch query all raw materials (O(1) query)
    const materials = await BahanBakuModel.findAll({
      where: { id: rawMaterialIds },
    });

    if (materials.length !== rawMaterialIds.length) {
      throw AppError.badRequest("Satu atau lebih bahan baku tidak ditemukan di sistem.");
    }

    const materialMap = new Map<number, any>();
    materials.forEach((m: any) => materialMap.set(m.id, m));

    // 2. Prepare cost calculation inputs
    const costItems = data.bahanBaku.map((b: any) => ({
      rawMaterialId: b.id,
      qty: b.jumlah,
      unitPrice: materialMap.get(b.id).Harga,
    }));

    // 3. Pure HPP calculation
    const breakdown: RecipeCostBreakdown = calculateRecipeCost(
      costItems,
      data.kemasan || [],
      data.overhead || []
    );

    const kodeProduksi = data.kodeProduksi || this.generateCode("PRD");

    // 4. Atomic creation
    return await withTransaction(async (t) => {
      const product = await ProdukModel.create(
        {
          KodeProduksi: kodeProduksi,
          namaProduk: data.namaProduk,
          hpp: breakdown.totalHpp,
          shelf_life_days: data.shelfLifeDays || 365,
        },
        { transaction: t }
      );

      // Bulk create ingredients
      const ingredientsData = data.bahanBaku.map((b: any) => ({
        produkId: product.id,
        bahanBakuId: b.id,
        jumlah: b.jumlah,
      }));
      await ProdukBahanBakuModel.bulkCreate(ingredientsData, { transaction: t });

      // Bulk create packagings
      if (data.kemasan?.length) {
        const packagingData = data.kemasan.map((k: any) => ({
          produkId: product.id,
          namaKemasan: k.namaKemasan,
          harga: k.harga,
        }));
        await KemasanModel.bulkCreate(packagingData, { transaction: t });
      }

      // Bulk create overheads
      if (data.overhead?.length) {
        const overheadData = data.overhead.map((o: any) => ({
          produkId: product.id,
          namaOverhead: o.namaOverhead,
          harga: o.harga,
        }));
        await OverheadModel.bulkCreate(overheadData, { transaction: t });
      }

      const margins = calculateMarginTiers(breakdown.totalHpp);

      return {
        product: {
          id: product.id,
          kodeProduksi: product.KodeProduksi,
          namaProduk: product.namaProduk,
          hpp: breakdown.totalHpp,
          shelfLifeDays: product.shelf_life_days,
        },
        costBreakdown: breakdown,
        marginTiers: margins,
      };
    });
  }

  /**
   * Update recipe with deterministic recalculated HPP (Fixes Bug B1)
   */
  static async updateRecipe(id: number, data: any, userId?: number) {
    const product = await ProdukModel.findByPk(id);
    if (!product) {
      throw AppError.notFound(`Produk dengan ID ${id} tidak ditemukan.`);
    }

    const rawMaterialIds = data.bahanBaku.map((b: any) => b.id);
    const materials = await BahanBakuModel.findAll({
      where: { id: rawMaterialIds },
    });

    if (materials.length !== rawMaterialIds.length) {
      throw AppError.badRequest("Satu atau lebih bahan baku tidak ditemukan di sistem.");
    }

    const materialMap = new Map<number, any>();
    materials.forEach((m: any) => materialMap.set(m.id, m));

    const costItems = data.bahanBaku.map((b: any) => ({
      rawMaterialId: b.id,
      qty: b.jumlah,
      unitPrice: materialMap.get(b.id).Harga,
    }));

    // Recalculate HPP from scratch (prevents cumulative error)
    const breakdown = calculateRecipeCost(
      costItems,
      data.kemasan || [],
      data.overhead || []
    );

    return await withTransaction(async (t) => {
      // 1. Delete old associations
      await ProdukBahanBakuModel.destroy({ where: { produkId: id }, transaction: t });
      await KemasanModel.destroy({ where: { produkId: id }, transaction: t });
      await OverheadModel.destroy({ where: { produkId: id }, transaction: t });

      // 2. Insert new associations
      const ingredientsData = data.bahanBaku.map((b: any) => ({
        produkId: id,
        bahanBakuId: b.id,
        jumlah: b.jumlah,
      }));
      await ProdukBahanBakuModel.bulkCreate(ingredientsData, { transaction: t });

      if (data.kemasan?.length) {
        const packagingData = data.kemasan.map((k: any) => ({
          produkId: id,
          namaKemasan: k.namaKemasan,
          harga: k.harga,
        }));
        await KemasanModel.bulkCreate(packagingData, { transaction: t });
      }

      if (data.overhead?.length) {
        const overheadData = data.overhead.map((o: any) => ({
          produkId: id,
          namaOverhead: o.namaOverhead,
          harga: o.harga,
        }));
        await OverheadModel.bulkCreate(overheadData, { transaction: t });
      }

      // 3. Update main product
      await product.update(
        {
          namaProduk: data.namaProduk,
          hpp: breakdown.totalHpp,
          shelf_life_days: data.shelfLifeDays || product.shelf_life_days || 365,
        },
        { transaction: t }
      );

      const margins = calculateMarginTiers(breakdown.totalHpp);

      return {
        product: {
          id: product.id,
          kodeProduksi: product.KodeProduksi,
          namaProduk: product.namaProduk,
          hpp: breakdown.totalHpp,
          shelfLifeDays: product.shelf_life_days,
        },
        costBreakdown: breakdown,
        marginTiers: margins,
      };
    });
  }

  /**
   * Get single recipe by ID
   */
  static async getRecipeById(id: number) {
    const product = await ProdukModel.findByPk(id, {
      include: [
        {
          model: BahanBakuModel,
          as: "bahanbakumodel",
          through: { attributes: ["jumlah"] },
        },
        { model: KemasanModel, as: "kemasans" },
        { model: OverheadModel, as: "overheads" },
      ],
    });

    if (!product) {
      throw AppError.notFound(`Produk dengan ID ${id} tidak ditemukan.`);
    }

    const hpp = Number(product.hpp);
    const margins = calculateMarginTiers(hpp);

    return {
      product,
      marginTiers: margins,
    };
  }

  /**
   * List all recipes
   */
  static async listRecipes() {
    const products = await ProdukModel.findAll({
      order: [["id", "DESC"]],
      include: [
        { model: KemasanModel, as: "kemasans" },
        { model: OverheadModel, as: "overheads" },
      ],
    });

    return products.map((p: any) => {
      const hpp = Number(p.hpp);
      return {
        id: p.id,
        kodeProduksi: p.KodeProduksi,
        namaProduk: p.namaProduk,
        hpp,
        shelfLifeDays: p.shelf_life_days || 365,
        marginTiers: calculateMarginTiers(hpp),
      };
    });
  }

  /**
   * Create a new Production Order in planned status
   */
  static async createProductionOrder(
    payload: { productId: number; plannedQty: number; notes?: string },
    userId?: number
  ) {
    const product = await ProdukModel.findByPk(payload.productId);
    if (!product) {
      throw AppError.notFound(`Produk dengan ID ${payload.productId} tidak ditemukan.`);
    }

    // Verify recipe has ingredients
    const ingredients = await ProdukBahanBakuModel.findAll({
      where: { produkId: payload.productId },
    });

    if (ingredients.length === 0) {
      throw AppError.badRequest("Produk belum memiliki komposisi resep bahan baku.");
    }

    const orderCode = this.generateCode("PO");

    const order = await ProductionOrder.create({
      order_code: orderCode,
      product_id: payload.productId,
      planned_qty: payload.plannedQty,
      status: "planned",
      start_date: new Date(),
      notes: payload.notes || null,
      created_by: userId || null,
    });

    return order;
  }

  /**
   * Complete Production Order with Deadlock-Free Row-Locking & Finished Good FEFO Batch Creation.
   * Fixes Bug B5 & B6!
   */
  static async completeProductionOrder(
    orderId: number,
    payload: { actualYield: number; manufactureDate?: string; shelfLifeDays?: number },
    userId?: number
  ) {
    return await withTransaction(async (t) => {
      // 1. Lock Production Order without outer join (PostgreSQL compliance)
      const order = await ProductionOrder.findByPk(orderId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!order) {
        throw AppError.notFound(`Production order #${orderId} tidak ditemukan.`);
      }

      if (order.status === "completed") {
        throw AppError.conflict("Production order ini sudah selesai (completed) sebelumnya.");
      }

      if (order.status === "cancelled") {
        throw AppError.badRequest("Production order yang sudah dibatalkan tidak dapat diselesaikan.");
      }

      // 2. Fetch recipe ingredients
      const ingredients = await ProdukBahanBakuModel.findAll({
        where: { produkId: order.product_id },
        transaction: t,
      });

      if (!ingredients.length) {
        throw AppError.badRequest("Resep produk tidak memiliki bahan baku yang terdaftar.");
      }

      // 3. Hussein Nasser pattern: Sort IDs ascending to prevent distributed deadlocks
      const rawMaterialIds = ingredients
        .map((i: any) => Number(i.bahanBakuId))
        .sort((a: number, b: number) => a - b);

      // 4. Lock raw material stocks ordered by ID
      const stocks = await StokBahanBaku.findAll({
        where: { BahanBakuId: rawMaterialIds },
        order: [["BahanBakuId", "ASC"]],
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      const stockMap = new Map<number, any>();
      stocks.forEach((s: any) => stockMap.set(Number(s.BahanBakuId), s));

      // 5. Check stock sufficiency
      for (const ingredient of ingredients) {
        const matId = Number(ingredient.bahanBakuId);
        const stockRecord = stockMap.get(matId);
        const requiredQty = Number(ingredient.jumlah) * Number(order.planned_qty);

        if (!stockRecord) {
          throw AppError.badRequest(
            `Data stok untuk bahan baku ID ${matId} tidak ditemukan.`
          );
        }

        const currentStock = Number(stockRecord.Stok || 0);
        if (currentStock < requiredQty) {
          throw AppError.badRequest(
            `Stok bahan baku ID ${matId} tidak mencukupi untuk produksi. Dibutuhkan: ${requiredQty}, Tersedia: ${currentStock}.`
          );
        }
      }

      // 6. Deduct raw material stocks & log movements
      for (const ingredient of ingredients) {
        const matId = Number(ingredient.bahanBakuId);
        const stockRecord = stockMap.get(matId);
        const requiredQty = Number(ingredient.jumlah) * Number(order.planned_qty);
        const newBalance = Number(stockRecord.Stok) - requiredQty;

        await stockRecord.update(
          {
            Stok: newBalance,
            TanggalPembaruan: new Date(),
          },
          { transaction: t }
        );

        await RawMaterialMovement.create(
          {
            raw_material_id: matId,
            production_order_id: order.id,
            type: "out",
            qty: requiredQty,
            balance_after: newBalance,
            description: `Konsumsi produksi Order ${order.order_code} (${order.planned_qty} unit)`,
          },
          { transaction: t }
        );
      }

      // 7. Calculate production costs
      const product = await ProdukModel.findByPk(order.product_id, { transaction: t });
      const hppPerBatch = Number(product.hpp || 0);
      const totalProductionCost = Number((hppPerBatch * Number(order.planned_qty)).toFixed(2));
      const unitCost = Number((totalProductionCost / payload.actualYield).toFixed(2));

      // 8. Calculate dates & FEFO Expiry Date
      const mfgDateStr = payload.manufactureDate || this.formatDateOnly();
      const shelfLife = payload.shelfLifeDays || product.shelf_life_days || 365;

      const mfgDateObj = new Date(mfgDateStr);
      const expDateObj = new Date(mfgDateObj);
      expDateObj.setDate(expDateObj.getDate() + shelfLife);
      const expDateStr = this.formatDateOnly(expDateObj);

      // 9. Generate unique Batch Number and instantiate ProductBatch
      const batchNumber = this.generateCode("BATCH-SPU");

      const batch = await ProductBatch.create(
        {
          product_id: order.product_id,
          production_order_id: order.id,
          batch_number: batchNumber,
          manufacture_date: mfgDateStr,
          expiry_date: expDateStr,
          initial_qty: payload.actualYield,
          current_qty: payload.actualYield,
          unit_cost: unitCost,
          status: "active",
        },
        { transaction: t }
      );

      // 10. Finalize Production Order
      const completionTime = new Date();
      await order.update(
        {
          status: "completed",
          actual_yield: payload.actualYield,
          completion_date: completionTime,
          total_cost: totalProductionCost,
          unit_cost: unitCost,
        },
        { transaction: t }
      );

      return {
        productionOrder: order,
        productBatch: batch,
        summary: {
          orderCode: order.order_code,
          productName: product.namaProduk,
          plannedQty: order.planned_qty,
          actualYield: payload.actualYield,
          batchNumber: batch.batch_number,
          manufactureDate: batch.manufacture_date,
          expiryDate: batch.expiry_date,
          totalCost: totalProductionCost,
          unitCost: unitCost,
        },
      };
    });
  }

  /**
   * Cancel a planned production order
   */
  static async cancelProductionOrder(orderId: number, notes?: string, userId?: number) {
    const order = await ProductionOrder.findByPk(orderId);
    if (!order) {
      throw AppError.notFound(`Production order #${orderId} tidak ditemukan.`);
    }

    if (order.status === "completed") {
      throw AppError.badRequest("Production order yang sudah completed tidak dapat dibatalkan.");
    }

    await order.update({
      status: "cancelled",
      notes: notes ? `${order.notes || ""} [Batal: ${notes}]`.trim() : order.notes,
    });

    return order;
  }

  /**
   * List production orders
   */
  static async listProductionOrders(status?: string) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    return await ProductionOrder.findAll({
      where,
      order: [["id", "DESC"]],
      include: [
        { model: ProdukModel, as: "product", attributes: ["id", "namaProduk", "KodeProduksi"] },
        { model: ProductBatch, as: "batch" },
      ],
    });
  }

  /**
   * List active product batches sorted by FEFO (First Expired, First Out)
   */
  static async listBatches(productId?: number, status = "active") {
    const where: any = { status };
    if (productId) {
      where.product_id = productId;
    }

    return await ProductBatch.findAll({
      where,
      order: [
        ["expiry_date", "ASC"], // FEFO core rule!
        ["id", "ASC"],
      ],
      include: [
        { model: ProdukModel, as: "product", attributes: ["id", "namaProduk", "KodeProduksi"] },
      ],
    });
  }
}
