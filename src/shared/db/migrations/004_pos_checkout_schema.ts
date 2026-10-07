import { DataTypes, QueryInterface } from "sequelize";

export async function up({ context: queryInterface }: { context: QueryInterface }) {
  // 1. pos_transactions
  await queryInterface.createTable("pos_transactions", {
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
        model: "stores",
        key: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "customers",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    cashier_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "Admin",
        key: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    payment_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "paid", // paid | partial_tempo | unpaid_tempo
    },
    notes: {
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

  await queryInterface.addIndex("pos_transactions", ["store_id", "createdAt"], {
    name: "idx_pos_transactions_store_date",
  });

  // 2. pos_transaction_items
  await queryInterface.createTable("pos_transaction_items", {
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
        model: "pos_transactions",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
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
    batch_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "product_batches",
        key: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    qty: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },
    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
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

  // 3. pos_payments
  await queryInterface.createTable("pos_payments", {
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
        model: "pos_transactions",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    method: {
      type: DataTypes.STRING(20),
      allowNull: false, // cash | qris | transfer | tempo
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    reference_number: {
      type: DataTypes.STRING(100),
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

  // 4. receivables (Piutang Tempo / Yarnen)
  await queryInterface.createTable("receivables", {
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
        model: "pos_transactions",
        key: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "customers",
        key: "id",
      },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    remaining_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "unpaid", // unpaid | partially_paid | paid
    },
    due_date: {
      type: DataTypes.DATEONLY,
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

  await queryInterface.addIndex("receivables", ["customer_id", "status"], {
    name: "idx_receivables_customer_status",
  });
  await queryInterface.addIndex("receivables", ["due_date"], {
    name: "idx_receivables_due_date",
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }) {
  await queryInterface.dropTable("receivables");
  await queryInterface.dropTable("pos_payments");
  await queryInterface.dropTable("pos_transaction_items");
  await queryInterface.dropTable("pos_transactions");
}
