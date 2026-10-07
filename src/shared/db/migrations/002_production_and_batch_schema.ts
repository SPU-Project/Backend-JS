import { DataTypes, QueryInterface } from "sequelize";

export async function up({ context: queryInterface }: { context: QueryInterface }) {
  // 1. Tambah shelf_life_days ke ProdukModel
  await queryInterface.addColumn("ProdukModel", "shelf_life_days", {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 365,
  });

  // 2. production_orders
  await queryInterface.createTable("production_orders", {
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
        model: "ProdukModel",
        key: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    planned_qty: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    actual_yield: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "planned", // planned | in_progress | completed | cancelled
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
    },
    unit_cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
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

  // 3. product_batches
  await queryInterface.createTable("product_batches", {
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
        model: "ProdukModel",
        key: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    production_order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "production_orders",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
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
    },
    current_qty: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    unit_cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "active", // active | depleted | expired
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

  // Index untuk FEFO performance: expiry_date, product_id, status
  await queryInterface.addIndex("product_batches", ["expiry_date"], {
    name: "idx_product_batches_expiry_date",
  });
  await queryInterface.addIndex("product_batches", ["product_id", "status"], {
    name: "idx_product_batches_product_status",
  });

  // 4. raw_material_movements
  await queryInterface.createTable("raw_material_movements", {
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
        model: "bahanbakumodel",
        key: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    production_order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "production_orders",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false, // in | out | adjust
    },
    qty: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    balance_after: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
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

  await queryInterface.addIndex("raw_material_movements", ["raw_material_id"], {
    name: "idx_raw_material_movements_raw_id",
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }) {
  await queryInterface.dropTable("raw_material_movements");
  await queryInterface.dropTable("product_batches");
  await queryInterface.dropTable("production_orders");
  await queryInterface.removeColumn("ProdukModel", "shelf_life_days");
}
