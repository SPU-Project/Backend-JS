import { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { sendSuccess } from "../../shared/http/response";
import { posCheckoutSchema } from "./pos.schema";
import { PosService } from "./pos.service";

export class PosController {
  /**
   * POST /api/v1/pos/checkout
   */
  static checkout = asyncHandler(async (req: Request, res: Response) => {
    const validated = posCheckoutSchema.parse(req.body);
    const idempotencyKey = (req.headers["idempotency-key"] || req.headers["x-idempotency-key"]) as string | undefined;
    const cashierId = (req as any).user?.id;

    const result = await PosService.checkout(validated, idempotencyKey, cashierId);
    return sendSuccess(res, result, result.idempotentReplay ? 200 : 201);
  });

  /**
   * GET /api/v1/pos/transactions/:identifier
   */
  static getTransaction = asyncHandler(async (req: Request, res: Response) => {
    const identifier = req.params.identifier;
    const isNum = /^\d+$/.test(identifier);
    const result = await PosService.getTransaction(isNum ? parseInt(identifier, 10) : identifier);
    return sendSuccess(res, result, 200);
  });
}
