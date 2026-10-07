const express = require("express");
const {
  updateStokBahanBaku,
  getAllStokBahanBaku,
} = require("../controllers/StokBahanBaku");
const sessionChecker = require("../middleware/sessionChecker.js");

const router = express.Router();

router.use(sessionChecker);

router.patch("/stokbahanbaku/:id", updateStokBahanBaku);
router.get("/stokbahanbaku", getAllStokBahanBaku);

module.exports = router;
