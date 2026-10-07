const Admin = require("../models/AdminModel.js");
const argon2 = require("argon2");
const RiwayatLog = require("../models/RiwayatLog.js");

const Login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ msg: "Email dan password wajib diisi" });
    }

    const user = await Admin.findOne({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ msg: "Email atau password salah" });
    }

    const match = await argon2.verify(user.password, password);
    if (!match) {
      return res.status(401).json({ msg: "Email atau password salah" });
    }

    const setSessionAndRespond = async () => {
      req.session.userId = user.id;

      try {
        await RiwayatLog.create({
          username: user.username,
          role: user.role,
          description: "User logged in",
        });
      } catch (logErr) {
        console.error("Error creating log entry:", logErr.message);
      }

      res.status(200).json({
        msg: "Login success",
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        username: user.username,
        role: user.role,
      });
    };

    if (typeof req.session.regenerate === "function") {
      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ msg: "Gagal menginisialisasi sesi login", error: err.message });
        }
        setSessionAndRespond();
      });
    } else {
      await setSessionAndRespond();
    }
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ msg: "Internal server error" });
  }
};

const Me = async (req, res) => {
  console.log("Session in /me route:", req.session.userId); // Log session details

  if (!req.session.userId)
    return res.status(401).json({ msg: "Please log in to your account" });

  try {
    const user = await Admin.findOne({
      attributes: ["uuid", "email", "username", "role"],
      where: {
        id: req.session.userId,
      },
    });
    if (!user) return res.status(404).json({ msg: "User not found" });

    res.status(200).json({ user });
  } catch (error) {
    res
      .status(500)
      .json({ msg: "Internal server error", error: error.message });
  }
};

const Logout = async (req, res) => {
  if (!req.session.userId) {
    console.log("Logout attempt without a valid session");
    return res.status(401).json({ msg: "User not logged in" });
  }

  // Get user information before destroying the session
  const user = await Admin.findOne({
    where: { id: req.session.userId },
    attributes: ["username", "role"],
  });

  // Function to destroy the session using a Promise
  const destroySession = () =>
    new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  try {
    // Destroy the session
    await destroySession();
    res.clearCookie("connect.sid");
    console.log("Session destroyed and cookie cleared");

    // Create a log entry in RiwayatLog
    try {
      await RiwayatLog.create({
        username: user.username,
        role: user.role,
        description: "User logged out",
      });
    } catch (error) {
      console.error("Error creating log entry:", error);
      // You can choose to handle this error or proceed
    }

    // Send success response
    res.status(200).json({ msg: "Logout success" });
  } catch (err) {
    console.log("Error destroying session:", err);
    return res.status(400).json({ msg: "Logout failed" });
  }
};

module.exports = { Login, Me, Logout };
