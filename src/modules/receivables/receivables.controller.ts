import { Request, Response } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { sendSuccess } from "../../shared/http/response";
import { payReceivableSchema } from "./receivables.schema";
import { ReceivablesService } from "./receivables.service";

export class ReceivablesController {
  static list = asyncHandler(async (req: Request, res: Response) => {
    const customerId = req.query.customerId ? parseInt(req.query.customerId as string, 10) : undefined;
    const status = req.query.status as string | undefined;

    const result = await ReceivablesService.listReceivables({ customerId, status });
    return sendSuccess(res, result, 200);
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const result = await ReceivablesService.getReceivableById(id);
    return sendSuccess(res, result, 200);
  });

  static pay = asyncHandler(async (req: Request, res: Response) => {
    const id = parseInt(String(req.params.id), 10);
    const validated = payReceivableSchema.parse(req.body);
    const userId = (req as any).user?.id;

    const result = await ReceivablesService.payReceivable(id, validated, userId);
    return sendSuccess(res, result, 200);
  });

  static agingReport = asyncHandler(async (req: Request, res: Response) => {
    const report = await ReceivablesService.getAgingReport();
    return sendSuccess(res, report, 200);
  });
}
