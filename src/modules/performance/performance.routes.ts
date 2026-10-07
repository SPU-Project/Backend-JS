import { Router } from "express";
import { PerformanceController } from "./performance.controller";
const sessionChecker = require("../../../middleware/sessionChecker");

const router = Router();

// Protect endpoints with session authentication
router.use(sessionChecker);

router.get("/cache/stats", PerformanceController.getCacheStats);
router.post("/cache/flush", PerformanceController.flushCache);
router.post("/performance/explain", PerformanceController.runExplain);

export default router;
export { router as performanceRouter };
