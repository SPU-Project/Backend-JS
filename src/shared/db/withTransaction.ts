import { Transaction } from "sequelize";
const db = require("../../../config/Database");

export type TransactionCallback<T> = (t: Transaction) => Promise<T>;

export interface TransactionOptions {
  isolationLevel?: Transaction.ISOLATION_LEVELS;
}

/**
 * Helper to execute database operations inside an ACID transaction.
 * Automatically commits on return and rolls back on exception.
 */
export async function withTransaction<T>(
  callback: TransactionCallback<T>,
  options?: TransactionOptions
): Promise<T> {
  return await db.transaction(
    {
      ...(options?.isolationLevel ? { isolationLevel: options.isolationLevel } : {}),
    },
    async (t: Transaction) => {
      return await callback(t);
    }
  );
}
