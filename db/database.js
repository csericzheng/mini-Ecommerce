const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'miniecommerce.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(DB_PATH);
// Deliberately not WAL mode: this is a single-process app and the DB file
// is committed to git as-is for deployment. WAL mode splits committed data
// across a separate .db-wal file that isn't flushed into the main file
// until a checkpoint occurs — committing the main file alone then ships a
// stale/incomplete snapshot (this bit us once already).
db.exec('PRAGMA journal_mode = DELETE');
db.exec('PRAGMA foreign_keys = ON');

db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

// Lightweight migration for DBs created before the `views` column existed.
// CREATE TABLE IF NOT EXISTS above is a no-op on an existing boats table.
const boatColumns = db.prepare("PRAGMA table_info(boats)").all().map((c) => c.name);
if (!boatColumns.includes('views')) {
  db.exec('ALTER TABLE boats ADD COLUMN views INTEGER NOT NULL DEFAULT 0');
}

// node:sqlite has no built-in transaction helper (unlike better-sqlite3);
// wrap it so calling code can keep using db.transaction(fn)().
db.transaction = (fn) => (...args) => {
  db.exec('BEGIN');
  try {
    const result = fn(...args);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
};

module.exports = db;
