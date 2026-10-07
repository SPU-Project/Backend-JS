import { DataTypes, QueryInterface } from "sequelize";

export async function up({ context: queryInterface }: { context: QueryInterface }) {
  // Tabel receivable_payments (Riwayat Pembayaran Cicilan Piutang Kasbon Petani)
  await queryInterface.createTable("receivable_payments", {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    payment_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    receivable_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "receivables",
        key: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    method: {
      type: DataTypes.STRING(20),
      allowNull: false, // cash | transfer | qris
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    received_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Admin",
        key: "id",
      },
      onDelete: "SET NULL",
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

  await queryInterface.addIndex("receivable_payments", ["receivable_id"], {
    name: "idx_receivable_payments_rec_id",
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }) {
  await queryInterface.dropTable("receivable_payments");
}
