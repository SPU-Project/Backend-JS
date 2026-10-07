const express = require("express");
const {
  getAllStatusProduksi,
  getStatusProduksiById,
  createStatusProduksi,
  updateStatusProduksi,
  deleteStatusProduksi,
} = require("../controllers/StatusProduk.js");
const sessionChecker = require("../middleware/sessionChecker.js");

const router = express.Router();

router.use(sessionChecker);

router.get("/statusproduksi", getAllStatusProduksi);
router.get("/statusproduksi/:id", getStatusProduksiById);
router.post("/statusproduksi", createStatusProduksi);
router.patch("/statusproduksi/:id", updateStatusProduksi);
router.delete("/statusproduksi/:id", deleteStatusProduksi);

module.exports = router;
