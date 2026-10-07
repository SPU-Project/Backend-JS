import { DataTypes, QueryInterface } from "sequelize";

export async function up({ context: queryInterface }: { context: QueryInterface }) {
  // 1. Admin
  await queryInterface.createTable("Admin", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    uuid: {
      type: DataTypes.STRING,
      defaultValue: DataTypes.UUIDV4,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    profileImage: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // 2. bahanbakumodel
  await queryInterface.createTable("bahanbakumodel", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    BahanBaku: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    Satuan: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Harga: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // 3. StokBahanBaku
  await queryInterface.createTable("StokBahanBaku", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    BahanBakuId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: "bahanbakumodel",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    BahanBaku: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Stok: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    TanggalPembaruan: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // 4. ProdukModel
  await queryInterface.createTable("ProdukModel", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    KodeProduksi: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    namaProduk: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    hpp: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    margin20: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    margin30: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    margin40: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    margin50: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    margin60: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    margin70: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    margin80: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    margin90: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    margin100: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // 5. ProdukBahanBakuModel
  await queryInterface.createTable("ProdukBahanBakuModel", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    jumlah: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    produkId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "ProdukModel",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    bahanBakuId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "bahanbakumodel",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // 6. KemasanModel
  await queryInterface.createTable("KemasanModel", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    namaKemasan: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    harga: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    produkId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "ProdukModel",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // 7. OverheadModel
  await queryInterface.createTable("OverheadModel", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    namaOverhead: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    harga: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: false,
    },
    produkId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "ProdukModel",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // 8. StatusProduksiModel
  await queryInterface.createTable("StatusProduksiModel", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    KodeProduksi: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    TanggalProduksi: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    TanggalSelesai: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    NamaProduk: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Batch: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Satuan: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    JumlahProduksi: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    StatusProduksi: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // 9. PenjualanProdukModel
  await queryInterface.createTable("PenjualanProdukModel", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    NamaProduk: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Batch: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    JumlahProduksi: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Margin: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    Terjual: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    HargaSatuan: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    Pendapatan: {
      type: DataTypes.DECIMAL(10, 3),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // 10. RiwayatLog
  await queryInterface.createTable("RiwayatLog", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });

  // 11. Sessions (connect-session-sequelize)
  await queryInterface.createTable("Sessions", {
    sid: {
      type: DataTypes.STRING(36),
      primaryKey: true,
    },
    expires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    data: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }) {
  await queryInterface.dropTable("Sessions");
  await queryInterface.dropTable("RiwayatLog");
  await queryInterface.dropTable("PenjualanProdukModel");
  await queryInterface.dropTable("StatusProduksiModel");
  await queryInterface.dropTable("OverheadModel");
  await queryInterface.dropTable("KemasanModel");
  await queryInterface.dropTable("ProdukBahanBakuModel");
  await queryInterface.dropTable("ProdukModel");
  await queryInterface.dropTable("StokBahanBaku");
  await queryInterface.dropTable("bahanbakumodel");
  await queryInterface.dropTable("Admin");
}
