const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");
dotenv.config();

const env = process.env.NODE_ENV || "development";

const config = {
  development: {
    username: process.env.PGUSER_DEV || process.env.DB_USER || "hasanabdurrahman",
    password: process.env.PGPASSWORD_DEV || process.env.DB_PASSWORD || "",
    database: process.env.PGDATABASE_DEV || process.env.DB_NAME || "spudev",
    host: process.env.PGHOST_DEV || process.env.DB_HOST || "localhost",
    dialect: process.env.PGDIALECT_DEV || process.env.DB_DIALECT || "postgres",
    port: parseInt(process.env.PGPORT_DEV || process.env.DB_PORT || "5432", 10),
  },
  test: {
    username: process.env.PGUSER_TEST || process.env.DB_USER_TEST || "hasanabdurrahman",
    password: process.env.PGPASSWORD_TEST || process.env.DB_PASSWORD_TEST || "",
    database: process.env.PGDATABASE_TEST || process.env.DB_NAME_TEST || "spudev_test",
    host: process.env.PGHOST_TEST || process.env.DB_HOST_TEST || "localhost",
    dialect: process.env.PGDIALECT_TEST || process.env.DB_DIALECT_TEST || "postgres",
    port: parseInt(process.env.PGPORT_TEST || process.env.DB_PORT_TEST || "5432", 10),
  },
  production: {
    username: process.env.PGUSER || process.env.DB_USER,
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD,
    database: process.env.PGDATABASE || process.env.DB_NAME,
    host: process.env.PGHOST || process.env.DB_HOST,
    dialect: process.env.PGDIALECT || process.env.DB_DIALECT || "postgres",
    port: parseInt(process.env.PGPORT || process.env.DB_PORT || "5432", 10),
  },
};

// Ambil konfigurasi berdasarkan environment
const currentConfig = config[env] || config.development;

const db = new Sequelize(
  currentConfig.database,
  currentConfig.username,
  currentConfig.password,
  {
    host: currentConfig.host,
    dialect: currentConfig.dialect,
    port: currentConfig.port,
    logging: false, // Matikan logging jika tidak diperlukan
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  },
);

module.exports = db;
