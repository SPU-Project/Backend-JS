const Admin = require("../models/AdminModel.js");

const sessionChecker = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ msg: "Akses ditolak: Silakan login terlebih dahulu." });
  }

  try {
    const user = await Admin.findByPk(req.session.userId, {
      attributes: ["id", "uuid", "username", "email", "role"],
    });

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ msg: "Sesi tidak valid: Pengguna tidak ditemukan." });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(500).json({ msg: "Terjadi kesalahan saat memverifikasi sesi", error: error.message });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ msg: "Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini." });
    }
    next();
  };
};

sessionChecker.requireRole = requireRole;
module.exports = sessionChecker;
module.exports.sessionChecker = sessionChecker;
module.exports.requireRole = requireRole;
