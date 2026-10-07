import { DataTypes, Model } from "sequelize";
const db = require("../../../config/Database");
const Admin = require("../../../models/AdminModel");
import { Receivable } from "../pos/pos.models";

export class ReceivablePayment extends Model {
  declare id: number;
  declare payment_code: string;
  declare receivable_id: number;
  declare amount: number;
  declare method: "cash" | "transfer" | "qris";
  declare notes: string | null;
  declare received_by: number | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ReceivablePayment.init(
  {
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
        model: Receivable,
        key: "id",
      },
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue("amount");
        return val ? Number(val) : 0;
      },
    },
    method: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    received_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Admin,
        key: "id",
      },
    },
  },
  {
    sequelize: db,
    tableName: "receivable_payments",
    freezeTableName: true,
    timestamps: true,
  }
);

// Associations
Receivable.hasMany(ReceivablePayment, { foreignKey: "receivable_id", as: "installments" });
ReceivablePayment.belongsTo(Receivable, { foreignKey: "receivable_id", as: "receivable" });
ReceivablePayment.belongsTo(Admin, { foreignKey: "received_by", as: "receiver" });

export { Receivable };
