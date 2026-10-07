import { DataTypes, Model } from "sequelize";
const db = require("../../../config/Database");
const ProdukModel = require("../../../models/ProdukModel");
const Admin = require("../../../models/AdminModel");
import { Store, Customer } from "../stores/stores.models";
import { ProductBatch } from "../production/production.models";

export class PosTransaction extends Model {
  declare id: number;
  declare invoice_number: string;
  declare idempotency_key: string | null;
  declare store_id: number;
  declare customer_id: number | null;
  declare cashier_id: number | null;
  declare subtotal: number;
  declare discount: number;
  declare total_amount: number;
  declare payment_status: "paid" | "partial_tempo" | "unpaid_tempo";
  declare notes: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

PosTransaction.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    invoice_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    idempotency_key: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    store_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Store,
        key: "id",
      },
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Customer,
        key: "id",
      },
    },
    cashier_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Admin,
        key: "id",
      },
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue("subtotal");
        return val ? Number(val) : 0;
      },
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        const val = this.getDataValue("discount");
        return val ? Number(val) : 0;
      },
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue("total_amount");
        return val ? Number(val) : 0;
      },
    },
    payment_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "paid",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "pos_transactions",
    freezeTableName: true,
    timestamps: true,
  }
);

export class PosTransactionItem extends Model {
  declare id: number;
  declare transaction_id: number;
  declare product_id: number;
  declare batch_id: number;
  declare qty: number;
  declare unit_price: number;
  declare subtotal: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

PosTransactionItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: PosTransaction,
        key: "id",
      },
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: ProdukModel,
        key: "id",
      },
    },
    batch_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: ProductBatch,
        key: "id",
      },
    },
    qty: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      get() {
        const val = this.getDataValue("qty");
        return val ? Number(val) : 0;
      },
    },
    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue("unit_price");
        return val ? Number(val) : 0;
      },
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue("subtotal");
        return val ? Number(val) : 0;
      },
    },
  },
  {
    sequelize: db,
    tableName: "pos_transaction_items",
    freezeTableName: true,
    timestamps: true,
  }
);

export class PosPayment extends Model {
  declare id: number;
  declare transaction_id: number;
  declare method: "cash" | "qris" | "transfer" | "tempo";
  declare amount: number;
  declare reference_number: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

PosPayment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: PosTransaction,
        key: "id",
      },
    },
    method: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue("amount");
        return val ? Number(val) : 0;
      },
    },
    reference_number: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "pos_payments",
    freezeTableName: true,
    timestamps: true,
  }
);

export class Receivable extends Model {
  declare id: number;
  declare invoice_number: string;
  declare transaction_id: number;
  declare customer_id: number;
  declare total_amount: number;
  declare remaining_amount: number;
  declare status: "unpaid" | "partially_paid" | "paid";
  declare due_date: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Receivable.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    invoice_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    transaction_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: PosTransaction,
        key: "id",
      },
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Customer,
        key: "id",
      },
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue("total_amount");
        return val ? Number(val) : 0;
      },
    },
    remaining_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue("remaining_amount");
        return val ? Number(val) : 0;
      },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "unpaid",
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    sequelize: db,
    tableName: "receivables",
    freezeTableName: true,
    timestamps: true,
  }
);

// Associations
PosTransaction.belongsTo(Store, { foreignKey: "store_id", as: "store" });
PosTransaction.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
PosTransaction.belongsTo(Admin, { foreignKey: "cashier_id", as: "cashier" });

PosTransaction.hasMany(PosTransactionItem, { foreignKey: "transaction_id", as: "items" });
PosTransactionItem.belongsTo(PosTransaction, { foreignKey: "transaction_id", as: "transaction" });
PosTransactionItem.belongsTo(ProdukModel, { foreignKey: "product_id", as: "product" });
PosTransactionItem.belongsTo(ProductBatch, { foreignKey: "batch_id", as: "batch" });

PosTransaction.hasMany(PosPayment, { foreignKey: "transaction_id", as: "payments" });
PosPayment.belongsTo(PosTransaction, { foreignKey: "transaction_id", as: "transaction" });

PosTransaction.hasOne(Receivable, { foreignKey: "transaction_id", as: "receivable" });
Receivable.belongsTo(PosTransaction, { foreignKey: "transaction_id", as: "transaction" });
Receivable.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
