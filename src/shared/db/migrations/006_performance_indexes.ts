import { QueryInterface } from "sequelize";

export async function up({ context: queryInterface }: { context: QueryInterface }) {
  // 1. pos_transaction_items: foreign key & lookup indexes
  await queryInterface.addIndex("pos_transaction_items", ["transaction_id"], {
    name: "idx_pos_items_tx_id",
  });
  await queryInterface.addIndex("pos_transaction_items", ["product_id"], {
    name: "idx_pos_items_prod_id",
  });
  await queryInterface.addIndex("pos_transaction_items", ["batch_id"], {
    name: "idx_pos_items_batch_id",
  });

  // 2. pos_payments: index on transaction_id
  await queryInterface.addIndex("pos_payments", ["transaction_id"], {
    name: "idx_pos_payments_tx_id",
  });

  // 3. store_stocks: composite index covering store, product, and quantity
  await queryInterface.addIndex("store_stocks", ["store_id", "product_id", "quantity"], {
    name: "idx_store_stocks_store_prod_qty",
  });

  // 4. product_batches: composite FEFO index for allocation queries
  await queryInterface.addIndex(
    "product_batches",
    ["product_id", "status", "expiry_date", "current_qty"],
    {
      name: "idx_product_batches_fefo",
    }
  );

  // 5. pos_transactions: indexes for cashier daily reports and customer transaction history
  await queryInterface.addIndex("pos_transactions", ["cashier_id", "createdAt"], {
    name: "idx_pos_tx_cashier_date",
  });
  await queryInterface.addIndex("pos_transactions", ["customer_id"], {
    name: "idx_pos_tx_customer_id",
  });
  await queryInterface.addIndex("pos_transactions", ["store_id", "payment_status"], {
    name: "idx_pos_tx_store_status",
  });

  // 6. stock_transfers & items: tracking open transfers
  await queryInterface.addIndex("stock_transfers", ["from_store_id", "status"], {
    name: "idx_transfers_from_store_status",
  });
  await queryInterface.addIndex("stock_transfers", ["to_store_id", "status"], {
    name: "idx_transfers_to_store_status",
  });
  await queryInterface.addIndex("stock_transfer_items", ["transfer_id"], {
    name: "idx_transfer_items_transfer_id",
  });

  // 7. raw_material_movements: chronological ledger lookup
  await queryInterface.addIndex("raw_material_movements", ["raw_material_id", "createdAt"], {
    name: "idx_raw_mat_movements_date",
  });

  // 8. customers: search and filtering
  await queryInterface.addIndex("customers", ["type", "is_active"], {
    name: "idx_customers_type_active",
  });
}

export async function down({ context: queryInterface }: { context: QueryInterface }) {
  await queryInterface.removeIndex("customers", "idx_customers_type_active");
  await queryInterface.removeIndex("raw_material_movements", "idx_raw_mat_movements_date");
  await queryInterface.removeIndex("stock_transfer_items", "idx_transfer_items_transfer_id");
  await queryInterface.removeIndex("stock_transfers", "idx_transfers_to_store_status");
  await queryInterface.removeIndex("stock_transfers", "idx_transfers_from_store_status");
  await queryInterface.removeIndex("pos_transactions", "idx_pos_tx_store_status");
  await queryInterface.removeIndex("pos_transactions", "idx_pos_tx_customer_id");
  await queryInterface.removeIndex("pos_transactions", "idx_pos_tx_cashier_date");
  await queryInterface.removeIndex("product_batches", "idx_product_batches_fefo");
  await queryInterface.removeIndex("store_stocks", "idx_store_stocks_store_prod_qty");
  await queryInterface.removeIndex("pos_payments", "idx_pos_payments_tx_id");
  await queryInterface.removeIndex("pos_transaction_items", "idx_pos_items_batch_id");
  await queryInterface.removeIndex("pos_transaction_items", "idx_pos_items_prod_id");
  await queryInterface.removeIndex("pos_transaction_items", "idx_pos_items_tx_id");
}
