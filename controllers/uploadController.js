const Admin = require("../models/AdminModel.js");
const RiwayatLog = require("../models/RiwayatLog.js");
const path = require("path");
const fs = require("fs");

const uploadProfileImage = async (req, res) => {
  const userId = req.session ? req.session.userId : null;

  if (!userId) {
    return res.status(401).json({ message: "Anda belum login" });
  }

  // 1. Validasi apakah ada file yang dikirim
  if (!req.file || !req.file.path) {
    return res.status(400).json({ message: "Silakan pilih file gambar untuk diunggah" });
  }

  const newFilePath = req.file.path;

  try {
    const admin = await Admin.findByPk(userId);
    if (!admin) {
      if (fs.existsSync(newFilePath)) fs.unlinkSync(newFilePath);
      return res.status(404).json({ message: "Admin tidak ditemukan" });
    }

    // 2. Hapus file gambar lama jika ada
    if (admin.profileImage && fs.existsSync(admin.profileImage)) {
      try {
        fs.unlinkSync(admin.profileImage);
      } catch (err) {
        console.error("Gagal menghapus file gambar profil lama:", err.message);
      }
    }

    // 3. Simpan path file baru
    admin.profileImage = newFilePath;
    await admin.save();

    // 4. Catat riwayat
    try {
      await RiwayatLog.create({
        username: admin.username,
        role: admin.role,
        description: "Mengunggah gambar profil",
      });
    } catch (logErr) {
      console.error("Gagal mencatat log upload:", logErr.message);
    }

    res.status(200).json({
      message: "Gambar profil berhasil diunggah",
      profileImage: newFilePath,
    });
  } catch (error) {
    // 5. Bersihkan file yang baru diunggah jika terjadi error database
    if (fs.existsSync(newFilePath)) {
      fs.unlinkSync(newFilePath);
    }

    res.status(500).json({
      message: "Gagal mengunggah gambar profil",
      error: error.message,
    });
  }
};

const getProfileImage = async (req, res) => {
  try {
    const userId = req.session ? req.session.userId : null;

    if (!userId) {
      return res.status(401).json({ message: "Anda belum login" });
    }

    const admin = await Admin.findByPk(userId);
    if (!admin) {
      return res.status(404).json({ message: "Admin tidak ditemukan" });
    }

    if (!admin.profileImage || !fs.existsSync(admin.profileImage)) {
      const defaultImagePath = path.join(
        __dirname,
        "..",
        "uploads",
        "default-profile-image.png"
      );
      if (fs.existsSync(defaultImagePath)) {
        return res.status(200).sendFile(defaultImagePath);
      }
      return res.status(404).json({ message: "Gambar profil tidak ditemukan" });
    }

    res.status(200).sendFile(path.resolve(admin.profileImage));
  } catch (error) {
    console.error("Error saat mendapatkan gambar profil:", error.message);
    res.status(500).json({
      message: "Gagal mendapatkan gambar profil",
      error: error.message,
    });
  }
};

module.exports = { uploadProfileImage, getProfileImage };
