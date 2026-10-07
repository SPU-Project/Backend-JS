const express = require("express");
const {
  getUser,
  getUserById,
  createUser,
  updateUser,
  deleteUserById,
} = require("../controllers/Users.js");
const sessionChecker = require("../middleware/sessionChecker.js");
const { requireRole } = sessionChecker;

const router = express.Router();

router.get("/users", sessionChecker, getUser);
router.get("/users/:id", sessionChecker, getUserById);
router.post("/users", createUser); // Dilindungi oleh bootstrap logic di controller (superadmin required if count > 0)
router.patch("/users/:id", sessionChecker, updateUser);
router.delete("/users/:id", sessionChecker, requireRole("superadmin"), deleteUserById);

module.exports = router;
