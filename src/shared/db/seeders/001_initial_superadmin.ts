import { QueryInterface } from "sequelize";
import argon2 from "argon2";
import crypto from "crypto";

export async function up({ context: queryInterface }: { context: QueryInterface }) {
  // Check if admin already exists
  const [existing]: any = await queryInterface.sequelize.query(
    'SELECT count(*) as count FROM "Admin"'
  );

  const count = parseInt(existing[0]?.count || "0", 10);
  if (count === 0) {
    const hashedPassword = await argon2.hash("Superadmin@123");
    const now = new Date();
    await queryInterface.bulkInsert("Admin", [
      {
        uuid: crypto.randomUUID(),
        email: "superadmin@sukarajapangan.com",
        password: hashedPassword,
        username: "superadmin",
        role: "superadmin",
        createdAt: now,
        updatedAt: now,
      },
    ]);
    console.log("Seeded initial default superadmin: superadmin@sukarajapangan.com / Superadmin@123");
  }
}

export async function down({ context: queryInterface }: { context: QueryInterface }) {
  await queryInterface.bulkDelete("Admin", { email: "superadmin@sukarajapangan.com" });
}
