const express = require("express");
const router = express.Router();
const sessionChecker = require("../middleware/sessionChecker.js");

// Import controller
const {
  getAllPenjualanProduk,
  getPenjualanProdukById,
  createPenjualanProduk,
  updatePenjualanProduk,
  deletePenjualanProduk,
} = require("../controllers/PenjualanProduk.js");

router.use(sessionChecker);

router.get("/PenjualanProduk", getAllPenjualanProduk);
router.get("/PenjualanProduk/:id", getPenjualanProdukById);
router.post("/PenjualanProduk", createPenjualanProduk);
router.patch("/PenjualanProduk/:id", updatePenjualanProduk);
router.delete("/PenjualanProduk/:id", deletePenjualanProduk);

module.exports = router;
