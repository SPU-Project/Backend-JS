const express = require("express");
const {
  addProduk,
  getAllProdukBahanBaku,
  getProdukBahanBakuByProdukId,
  updateProduk,
  deleteProduk,
} = require("../controllers/Produk.js");
const sessionChecker = require("../middleware/sessionChecker.js");

const router = express.Router();

router.use(sessionChecker);

router.post("/produk", addProduk);
router.get("/produkdetails", getAllProdukBahanBaku);
router.get("/produkdetails/:produkId", getProdukBahanBakuByProdukId);
router.patch("/produkbahanbaku/:id", updateProduk);
router.delete("/produkdelete/:id", deleteProduk);

module.exports = router;
