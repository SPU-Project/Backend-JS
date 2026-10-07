import { DataTypes, Model } from "sequelize";
const db = require("../../../config/Database");
const ProdukModel = require("../../../models/ProdukModel");
const BahanBakuModel = require("../../../models/BahanBakuModel");
const Admin = require("../../../models/AdminModel");

export class ProductionOrder extends Model {
  declare id: number;
  declare order_code: string;
  declare product_id: number;
  declare planned_qty: number;
  declare actual_yield: number | null;
  declare status: "planned" | "in_progress" | "completed" | "cancelled";
  declare start_date: Date | null;
  declare completion_date: Date | null;
  declare total_cost: number | null;
  declare unit_cost: number | null;
  declare notes: string | null;
  declare created_by: number | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

ProductionOrder.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    order_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: ProdukModel,
        key: "id",
      },
    },
    planned_qty: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      get() {
        const val = this.getDataValue("planned_qty");
        return val ? Number(val) : 0;
      },
    },
    actual_yield: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: true,
      get() {
        const val = this.getDataValue("actual_yield");
        return val ? Number(val) : null;
      },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "planned",
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completion_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    total_cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      get() {
        const val = this.getDataValue("total_cost");
        return val ? Number(val) : null;
      },
    },
    unit_cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      get() {
        const val = this.getDataValue("unit_cost");
        return val ? Number(val) : null;
      },
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
    tableName: "production_orders",
    freezeTableName: true,
    timestamps: true,
  }
);

export class ProductBatch extends Model {
  declare id: number;
  declare product_id: number;
  declare production_order_id: number | null;
  declare batch_number: string;
  declare manufacture_date: string;
  declare expiry_date: string;
  declare initial_qty: number;
  declare current_qty: number;
  declare unit_cost: number;
  declare status: "active" | "depleted" | "expired";
  declare createdAt: Date;
  declare updatedAt: Date;
}

ProductBatch.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: ProdukModel,
        key: "id",
      },
    },
    production_order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: ProductionOrder,
        key: "id",
      },
    },
    batch_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    manufacture_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    initial_qty: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      get() {
        const val = this.getDataValue("initial_qty");
        return val ? Number(val) : 0;
      },
    },
    current_qty: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      get() {
        const val = this.getDataValue("current_qty");
        return val ? Number(val) : 0;
      },
    },
    unit_cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      get() {
        const val = this.getDataValue("unit_cost");
        return val ? Number(val) : 0;
      },
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    sequelize: db,
    tableName: "product_batches",
    freezeTableName: true,
    timestamps: true,
  }
);

export class RawMaterialMovement extends Model {
  declare id: number;
  declare raw_material_id: number;
  declare production_order_id: number | null;
  declare type: "in" | "out" | "adjust";
  declare qty: number;
  declare balance_after: number;
  declare description: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

RawMaterialMovement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    raw_material_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: BahanBakuModel,
        key: "id",
      },
    },
    production_order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: ProductionOrder,
        key: "id",
      },
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    qty: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      get() {
        const val = this.getDataValue("qty");
        return val ? Number(val) : 0;
      },
    },
    balance_after: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      get() {
        const val = this.getDataValue("balance_after");
        return val ? Number(val) : 0;
      },
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize: db,
    tableName: "raw_material_movements",
    freezeTableName: true,
    timestamps: true,
  }
);

// Setup associations
ProductionOrder.belongsTo(ProdukModel, { foreignKey: "product_id", as: "product" });
ProdukModel.hasMany(ProductionOrder, { foreignKey: "product_id", as: "productionOrders" });

ProductionOrder.belongsTo(Admin, { foreignKey: "created_by", as: "creator" });

ProductBatch.belongsTo(ProdukModel, { foreignKey: "product_id", as: "product" });
ProdukModel.hasMany(ProductBatch, { foreignKey: "product_id", as: "batches" });

ProductBatch.belongsTo(ProductionOrder, { foreignKey: "production_order_id", as: "productionOrder" });
ProductionOrder.hasOne(ProductBatch, { foreignKey: "production_order_id", as: "batch" });

RawMaterialMovement.belongsTo(BahanBakuModel, { foreignKey: "raw_material_id", as: "rawMaterial" });
RawMaterialMovement.belongsTo(ProductionOrder, { foreignKey: "production_order_id", as: "productionOrder" });
