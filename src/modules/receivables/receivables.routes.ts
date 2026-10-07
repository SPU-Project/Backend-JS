import { Router } from "express";
import { ReceivablesController } from "./receivables.controller";
const sessionChecker = require("../../../middleware/sessionChecker");

const router = Router();

// Protect all receivables endpoints
router.use(sessionChecker);

router.get("/aging-report", ReceivablesController.agingReport);
router.get("/", ReceivablesController.list);
router.get("/:id", ReceivablesController.getById);
router.post("/:id/payments", ReceivablesController.pay);

export default router;
export { router as receivablesRouter };
