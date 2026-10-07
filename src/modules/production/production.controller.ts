import { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { sendSuccess } from "../../shared/http/response";
import {
  createRecipeSchema,
  updateRecipeSchema,
  createProductionOrderSchema,
  completeProductionOrderSchema,
} from "./production.schema";
import { ProductionService } from "./production.service";

export class ProductionController {
  /**
   * POST /api/v1/production/recipes
   */
  static createRecipe = asyncHandler(async (req: Request, res: Response) => {
    const validated = createRecipeSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const result = await ProductionService.createRecipe(validated, userId);
    return sendSuccess(res, result, 201);
  });

  /**
   * PUT /api/v1/production/recipes/:id
   */
  static updateRecipe = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const validated = updateRecipeSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const result = await ProductionService.updateRecipe(id, validated, userId);
    return sendSuccess(res, result, 200);
  });

  /**
   * GET /api/v1/production/recipes/:id
   */
  static getRecipe = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const result = await ProductionService.getRecipeById(id);
    return sendSuccess(res, result, 200);
  });

  /**
   * GET /api/v1/production/recipes
   */
  static listRecipes = asyncHandler(async (req: Request, res: Response) => {
    const result = await ProductionService.listRecipes();
    return sendSuccess(res, result, 200);
  });

  /**
   * POST /api/v1/production/orders
   */
  static createOrder = asyncHandler(async (req: Request, res: Response) => {
    const validated = createProductionOrderSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const order = await ProductionService.createProductionOrder(validated, userId);
    return sendSuccess(res, order, 201);
  });

  /**
   * POST /api/v1/production/orders/:id/complete
   */
  static completeOrder = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const validated = completeProductionOrderSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const result = await ProductionService.completeProductionOrder(id, validated, userId);
    return sendSuccess(res, result, 200);
  });

  /**
   * POST /api/v1/production/orders/:id/cancel
   */
  static cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const { notes } = req.body || {};
    const userId = (req as any).user?.id;
    const order = await ProductionService.cancelProductionOrder(id, notes, userId);
    return sendSuccess(res, order, 200);
  });

  /**
   * GET /api/v1/production/orders
   */
  static listOrders = asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as string | undefined;
    const orders = await ProductionService.listProductionOrders(status);
    return sendSuccess(res, orders, 200);
  });

  /**
   * GET /api/v1/production/batches
   * Returns finished good batches sorted by FEFO (earliest expiry first)
   */
  static listBatches = asyncHandler(async (req: Request, res: Response) => {
    const productId = req.query.productId ? parseInt(req.query.productId as string, 10) : undefined;
    const status = (req.query.status as string) || "active";
    const batches = await ProductionService.listBatches(productId, status);
    return sendSuccess(res, batches, 200);
  });
}
