const express = require("express");
const {
  addBahanBaku,
  updateBahanBaku,
  getAllBahanBaku,
  deleteBahanBaku,
} = require("../controllers/BahanBaku.js");
const sessionChecker = require("../middleware/sessionChecker.js");

const router = express.Router();

router.use(sessionChecker);

router.post("/bahanbaku", addBahanBaku);
router.patch("/bahanbaku/:id", updateBahanBaku);
router.get("/bahanbaku", getAllBahanBaku);
router.delete("/bahanbaku/:id", deleteBahanBaku);

module.exports = router;
