import { Router } from "express";
import { ProductionController } from "./production.controller";
const sessionChecker = require("../../../middleware/sessionChecker");

const router = Router();

// Protect all production endpoints with authentication
router.use(sessionChecker);

// Recipe Management
router.post("/recipes", ProductionController.createRecipe);
router.put("/recipes/:id", ProductionController.updateRecipe);
router.get("/recipes/:id", ProductionController.getRecipe);
router.get("/recipes", ProductionController.listRecipes);

// Production Order Lifecycle
router.post("/orders", ProductionController.createOrder);
router.post("/orders/:id/complete", ProductionController.completeOrder);
router.post("/orders/:id/cancel", ProductionController.cancelOrder);
router.get("/orders", ProductionController.listOrders);

// Finished Goods Batches (FEFO Inventory)
router.get("/batches", ProductionController.listBatches);

export default router;
export { router as productionRouter };
