const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'miniecommerce.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));

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
