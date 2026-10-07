const express = require("express");
const upload = require("../middleware/uploadMiddleware.js");
const sessionChecker = require("../middleware/sessionChecker.js");
const {
  uploadProfileImage,
  getProfileImage,
} = require("../controllers/uploadController.js");

const router = express.Router();

// sessionChecker ditempatkan sebelum multer agar unauthenticated request langsung ditolak
router.post(
  "/upload-profile",
  sessionChecker,
  upload.single("profileImage"),
  uploadProfileImage
);
router.get("/profile-image", sessionChecker, getProfileImage);

module.exports = router;
