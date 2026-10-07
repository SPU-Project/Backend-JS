import { DataTypes, Model } from "sequelize";
const db = require("../../../config/Database");
const ProdukModel = require("../../../models/ProdukModel");
const Admin = require("../../../models/AdminModel");
import { ProductBatch } from "../production/production.models";

export class Store extends Model {
  declare id: number;
  declare store_code: string;
  declare name: string;
  declare type: "warehouse_hq" | "outlet";
  declare address: string | null;
  declare city: string | null;
  declare is_active: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Store.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    store_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "outlet",
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize: db,
    tableName: "stores",
    freezeTableName: true,
    timestamps: true,
  }
);

export class Customer extends Model {
  declare id: number;
  declare nik: string | null;
  declare name: string;
  declare phone: string | null;
  declare address: string | null;
  declare type: "farmer" | "retail_shop" | "distributor";
  declare poktan_name: string | null;
  declare credit_limit: number;
  declare current_credit: number;
  declare is_active: boolean;
  declare createdAt: Date;
  declare updatedAt: Date;
}

Customer.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    nik: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "farmer",
    },
    poktan_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    credit_limit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        const val = this.getDataValue("credit_limit");
        return val ? Number(val) : 0;
      },
    },
    current_credit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        const val = this.getDataValue("current_credit");
        return val ? Number(val) : 0;
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize: db,
    tableName: "customers",
    freezeTableName: true,
    timestamps: true,
  }
);

export class StoreStock extends Model {
  declare id: number;
  declare store_id: number;
  declare product_id: number;
  declare batch_id: number;
  declare quantity: number;
  declare buy_price: number;
  declare selling_price: number;
  declare min_stock_alert: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

StoreStock.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    store_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Store,
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
    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        const val = this.getDataValue("quantity");
        return val ? Number(val) : 0;
      },
    },
    buy_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        const val = this.getDataValue("buy_price");
        return val ? Number(val) : 0;
      },
    },
    selling_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      get() {
        const val = this.getDataValue("selling_price");
        return val ? Number(val) : 0;
      },
    },
    min_stock_alert: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 5.0,
      get() {
        const val = this.getDataValue("min_stock_alert");
        return val ? Number(val) : 5;
      },
    },
  },
  {
    sequelize: db,
    tableName: "store_stocks",
    freezeTableName: true,
    timestamps: true,
  }
);

export class StockTransfer extends Model {
  declare id: number;
  declare transfer_code: string;
  declare from_store_id: number;
  declare to_store_id: number;
  declare status: "pending" | "in_transit" | "completed" | "cancelled";
  declare notes: string | null;
  declare created_by: number | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

StockTransfer.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    transfer_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    from_store_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Store,
        key: "id",
      },
    },
    to_store_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Store,
        key: "id",
      },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "completed",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
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
    tableName: "stock_transfers",
    freezeTableName: true,
    timestamps: true,
  }
);

export class StockTransferItem extends Model {
  declare id: number;
  declare transfer_id: number;
  declare product_id: number;
  declare batch_id: number;
  declare qty: number;
  declare createdAt: Date;
  declare updatedAt: Date;
}

StockTransferItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    transfer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: StockTransfer,
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
  },
  {
    sequelize: db,
    tableName: "stock_transfer_items",
    freezeTableName: true,
    timestamps: true,
  }
);

// Associations
Store.hasMany(StoreStock, { foreignKey: "store_id", as: "stocks" });
StoreStock.belongsTo(Store, { foreignKey: "store_id", as: "store" });

StoreStock.belongsTo(ProdukModel, { foreignKey: "product_id", as: "product" });
StoreStock.belongsTo(ProductBatch, { foreignKey: "batch_id", as: "batch" });

StockTransfer.belongsTo(Store, { foreignKey: "from_store_id", as: "fromStore" });
StockTransfer.belongsTo(Store, { foreignKey: "to_store_id", as: "toStore" });
StockTransfer.hasMany(StockTransferItem, { foreignKey: "transfer_id", as: "items" });
StockTransferItem.belongsTo(StockTransfer, { foreignKey: "transfer_id", as: "transfer" });
StockTransferItem.belongsTo(ProdukModel, { foreignKey: "product_id", as: "product" });
StockTransferItem.belongsTo(ProductBatch, { foreignKey: "batch_id", as: "batch" });
