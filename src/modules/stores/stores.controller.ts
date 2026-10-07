import { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { sendSuccess } from "../../shared/http/response";
import {
  createStoreSchema,
  createCustomerSchema,
  updateCreditLimitSchema,
  setStorePriceSchema,
  transferStockSchema,
} from "./stores.schema";
import { StoreService } from "./stores.service";

export class StoreController {
  static createStore = asyncHandler(async (req: Request, res: Response) => {
    const validated = createStoreSchema.parse(req.body);
    const store = await StoreService.createStore(validated);
    return sendSuccess(res, store, 201);
  });

  static listStores = asyncHandler(async (req: Request, res: Response) => {
    const stores = await StoreService.listStores();
    return sendSuccess(res, stores, 200);
  });

  static createCustomer = asyncHandler(async (req: Request, res: Response) => {
    const validated = createCustomerSchema.parse(req.body);
    const customer = await StoreService.createCustomer(validated);
    return sendSuccess(res, customer, 201);
  });

  static listCustomers = asyncHandler(async (req: Request, res: Response) => {
    const customers = await StoreService.listCustomers();
    return sendSuccess(res, customers, 200);
  });

  static getCustomer = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const result = await StoreService.getCustomerById(id);
    return sendSuccess(res, result, 200);
  });

  static updateCreditLimit = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    const { creditLimit } = updateCreditLimitSchema.parse(req.body);
    const updated = await StoreService.updateCreditLimit(id, creditLimit);
    return sendSuccess(res, updated, 200);
  });

  static setPrice = asyncHandler(async (req: Request, res: Response) => {
    const validated = setStorePriceSchema.parse(req.body);
    const result = await StoreService.setProductPrice(
      validated.storeId,
      validated.productId,
      validated.sellingPrice
    );
    return sendSuccess(res, result, 200);
  });

  static getStocks = asyncHandler(async (req: Request, res: Response) => {
    const storeId = parseInt(req.params.storeId, 10);
    const productId = req.query.productId ? parseInt(req.query.productId as string, 10) : undefined;
    const stocks = await StoreService.getStoreStocks(storeId, productId);
    return sendSuccess(res, stocks, 200);
  });

  static transferStock = asyncHandler(async (req: Request, res: Response) => {
    const validated = transferStockSchema.parse(req.body);
    const userId = (req as any).user?.id;
    const result = await StoreService.transferStock(validated, userId);
    return sendSuccess(res, result, 200);
  });

  static getPrice = asyncHandler(async (req: Request, res: Response) => {
    const storeId = parseInt(req.params.storeId, 10);
    const productId = parseInt(req.params.productId, 10);
    const result = await StoreService.getProductPrice(storeId, productId);
    return sendSuccess(res, result, 200);
  });
}
