const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'miniecommerce.db');
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
if (!boatColumns.includes('engine_hours')) {
  db.exec('ALTER TABLE boats ADD COLUMN engine_hours INTEGER NOT NULL DEFAULT 0');
  // Backfill existing listings with a rough estimate (40 engine hours per
  // year of age) rather than leaving them all at 0.
  db.exec(`UPDATE boats SET engine_hours = 40 * MAX(0, CAST(strftime('%Y', 'now') AS INTEGER) - year)`);
}
if (!boatColumns.includes('status')) {
  db.exec("ALTER TABLE boats ADD COLUMN status TEXT NOT NULL DEFAULT 'available'");
}
if (!boatColumns.includes('condition')) {
  db.exec("ALTER TABLE boats ADD COLUMN condition TEXT NOT NULL DEFAULT 'used'");
  // Every boat that existed before this column was added is part of the
  // original dealer/seed catalog (new-boat inventory tracked by quantity),
  // not an individual seller's used-boat listing.
  db.exec("UPDATE boats SET condition = 'new'");
}
if (!boatColumns.includes('location')) {
  db.exec("ALTER TABLE boats ADD COLUMN location TEXT NOT NULL DEFAULT ''");
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

// Checked after the possible rebuild above (rather than against the earlier
// orderColumnInfo snapshot) so this doesn't get silently dropped by that
// rebuild's hardcoded column list if both migrations were ever needed at once.
const orderColumnsNow = db.prepare("PRAGMA table_info(orders)").all().map((c) => c.name);
if (!orderColumnsNow.includes('financing_needed')) {
  db.exec('ALTER TABLE orders ADD COLUMN financing_needed INTEGER NOT NULL DEFAULT 0');
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
