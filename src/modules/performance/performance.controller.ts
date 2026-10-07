import { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { sendSuccess } from "../../shared/http/response";
import { cacheService } from "../../shared/cache/cache.service";
import { ExplainHelper } from "../../shared/db/explainHelper";

export class PerformanceController {
  /**
   * Get real-time cache statistics (Redis or In-Memory fallback)
   */
  static getCacheStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await cacheService.getStats();
    return sendSuccess(res, stats, 200);
  });

  /**
   * Flush application cache keys
   */
  static flushCache = asyncHandler(async (_req: Request, res: Response) => {
    await cacheService.flush();
    return sendSuccess(res, { message: "Cache successfully flushed." }, 200);
  });

  /**
   * Execute EXPLAIN (ANALYZE, BUFFERS) benchmark on critical POS queries
   */
  static runExplain = asyncHandler(async (req: Request, res: Response) => {
    const { template = "fefo_stock_lookup", storeId = 1, productId = 1, customerId = 1 } = req.body || {};

    let sql = "";
    switch (template) {
      case "fefo_stock_lookup":
        sql = `SELECT * FROM store_stocks WHERE store_id = ${Number(storeId)} AND product_id = ${Number(productId)} AND quantity > 0;`;
        break;
      case "cashier_daily_sales":
        sql = `SELECT * FROM pos_transactions WHERE store_id = ${Number(storeId)} AND payment_status = 'paid' ORDER BY "createdAt" DESC LIMIT 50;`;
        break;
      case "customer_receivables":
        sql = `SELECT * FROM receivables WHERE customer_id = ${Number(customerId)} AND status = 'unpaid';`;
        break;
      default:
        sql = `SELECT * FROM store_stocks WHERE store_id = ${Number(storeId)} AND product_id = ${Number(productId)};`;
    }

    const explainResult = await ExplainHelper.explainQuery(sql);

    return sendSuccess(
      res,
      {
        template,
        query: sql,
        nodeType: explainResult.nodeType,
        indexName: explainResult.indexName,
        isIndexScan: explainResult.isIndexScan,
        executionTimeMs: explainResult.executionTimeMs,
        planningTimeMs: explainResult.planningTimeMs,
        totalCost: explainResult.totalCost,
        rawPlan: explainResult.rawPlan,
      },
      200
    );
  });
}
