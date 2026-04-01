const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const { initializeSchema } = require("./schema");

function createDatabase(config) {
  const databasePath = config.databasePath;
  if (databasePath !== ":memory:") {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  initializeSchema(db);
  return db;
}

module.exports = { createDatabase };
