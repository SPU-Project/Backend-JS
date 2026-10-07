import { Router } from "express";
import { PosController } from "./pos.controller";
const sessionChecker = require("../../../middleware/sessionChecker");

const router = Router();

// Protect all POS routes with authentication
router.use(sessionChecker);

router.post("/checkout", PosController.checkout);
router.get("/transactions/:identifier", PosController.getTransaction);

export default router;
export { router as posRouter };
