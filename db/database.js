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

// Lightweight migrations for DBs created before these columns existed.
// CREATE TABLE IF NOT EXISTS above is a no-op on an already-existing table.
const boatColumns = db.prepare("PRAGMA table_info(boats)").all().map((c) => c.name);
if (!boatColumns.includes('views')) {
  db.exec('ALTER TABLE boats ADD COLUMN views INTEGER NOT NULL DEFAULT 0');
}
if (!boatColumns.includes('owner_id')) {
  db.exec('ALTER TABLE boats ADD COLUMN owner_id INTEGER REFERENCES users(id)');
}

const orderColumnInfo = db.prepare("PRAGMA table_info(orders)").all();
const orderColumns = orderColumnInfo.map((c) => c.name);
if (!orderColumns.includes('user_id')) {
  db.exec('ALTER TABLE orders ADD COLUMN user_id INTEGER REFERENCES users(id)');
}

// Older databases have customer_email as NOT NULL, which breaks checkout
// for any user without an email on file (email has always been optional at
// registration). SQLite can't drop a NOT NULL constraint with ALTER TABLE,
// so rebuild the table to match schema.sql's nullable definition.
const customerEmailCol = orderColumnInfo.find((c) => c.name === 'customer_email');
if (customerEmailCol && customerEmailCol.notnull) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec(`
    CREATE TABLE orders_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      total_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO orders_new (id, user_id, customer_name, customer_email, total_cents, created_at)
      SELECT id, user_id, customer_name, customer_email, total_cents, created_at FROM orders;
    DROP TABLE orders;
    ALTER TABLE orders_new RENAME TO orders;
  `);
  db.exec('PRAGMA foreign_keys = ON');
}

const userColumns = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!userColumns.includes('role')) {
  db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
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
