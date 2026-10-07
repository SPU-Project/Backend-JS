require("tsx/cjs");
const { app } = require("./src/app");
const { startServer } = require("./src/server");
const db = require("./config/Database");

if (require.main === module) {
  startServer();
}

module.exports = { app, db, startServer };
