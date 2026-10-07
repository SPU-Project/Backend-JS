import { Router } from "express";
import { StoreController } from "./stores.controller";
const sessionChecker = require("../../../middleware/sessionChecker");

const router = Router();

// Protect all store endpoints with authentication
router.use(sessionChecker);

// Store / Outlet endpoints
router.post("/stores", StoreController.createStore);
router.get("/stores", StoreController.listStores);
router.get("/stores/:storeId/stocks", StoreController.getStocks);
router.post("/stores/prices", StoreController.setPrice);
router.post("/stores/transfers", StoreController.transferStock);

// Customer / CRM endpoints
router.post("/customers", StoreController.createCustomer);
router.get("/customers", StoreController.listCustomers);
router.get("/customers/:id", StoreController.getCustomer);
router.put("/customers/:id/credit-limit", StoreController.updateCreditLimit);

export default router;
export { router as storeRouter };
