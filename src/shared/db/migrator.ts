import { Umzug, SequelizeStorage } from "umzug";
import path from "path";
const db = require("../../../config/Database");

export const migrator = new Umzug({
  migrations: {
    glob: [path.join(__dirname, "migrations/*.ts"), { cwd: __dirname }],
    resolve: ({ name, path: migrationPath, context }) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const migration = require(migrationPath!);
      return {
        name,
        up: async () => migration.up({ context }),
        down: async () => migration.down({ context }),
      };
    },
  },
  context: db.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize: db, tableName: "SequelizeMeta" }),
  logger: console,
});

export const seeder = new Umzug({
  migrations: {
    glob: [path.join(__dirname, "seeders/*.ts"), { cwd: __dirname }],
    resolve: ({ name, path: seederPath, context }) => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const migration = require(seederPath!);
      return {
        name,
        up: async () => migration.up({ context }),
        down: async () => migration.down({ context }),
      };
    },
  },
  context: db.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize: db, tableName: "SequelizeData" }),
  logger: console,
});

if (require.main === module) {
  const cmd = process.argv[2] || "up";
  (async () => {
    try {
      if (cmd === "up") {
        await migrator.up();
        console.log("All migrations executed successfully.");
      } else if (cmd === "down") {
        await migrator.down();
        console.log("Last migration reverted successfully.");
      } else if (cmd === "seed") {
        await seeder.up();
        console.log("All seeders executed successfully.");
      } else {
        console.error(`Unknown command: ${cmd}. Use 'up', 'down', or 'seed'.`);
        process.exit(1);
      }
      process.exit(0);
    } catch (err) {
      console.error("Migration error:", err);
      process.exit(1);
    }
  })();
}
