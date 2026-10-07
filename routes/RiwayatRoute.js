const express = require("express");
const { getAllRiwayat } = require("../controllers/Riwayat.js");
const sessionChecker = require("../middleware/sessionChecker.js");

const router = express.Router();

router.use(sessionChecker);

router.get("/riwayat", getAllRiwayat);

module.exports = router;
