// One-off backfill: boats seeded before the owner_id column existed have
// no associated seller. Creates a distinct demo user account per
// ownerless boat so every boat has a real owner, matching the ownership
// model used for boats listed through /sell.
const db = require('../db/database');
const { hashPassword } = require('../lib/password');

// Seeded PRNG (mulberry32) so re-running this script yields the same names.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260709);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const FIRST_NAMES = ['James', 'Maria', 'Robert', 'Linda', 'Michael', 'Patricia', 'David', 'Jennifer', 'John', 'Susan', 'Carlos', 'Emma', 'Daniel', 'Olivia', 'Mark', 'Sophia', 'Paul', 'Grace', 'Steven', 'Natalie'];
const LAST_NAMES = ['Harbor', 'Nelson', 'Reed', 'Coleman', 'Foster', 'Blake', 'Sutton', 'Marsh', 'Hayes', 'Doyle', 'Winters', 'Shore', 'Vance', 'Pierce', 'Wade', 'Barrett', 'Cole', 'Drake', 'Ellis', 'Fenwick'];
const DEFAULT_PASSWORD = 'BoatSeller123';

const boats = db.prepare('SELECT id FROM boats WHERE owner_id IS NULL').all();
const passwordHash = hashPassword(DEFAULT_PASSWORD);

const insertUser = db.prepare(
  `INSERT INTO users (first_name, last_name, phone, password_hash, role) VALUES (?, ?, ?, ?, 'user')`
);
const setOwner = db.prepare('UPDATE boats SET owner_id = ? WHERE id = ?');

const assign = db.transaction(() => {
  boats.forEach((boat, i) => {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const phone = `555020${String(i).padStart(4, '0')}`;
    const info = insertUser.run(firstName, lastName, phone, passwordHash);
    setOwner.run(info.lastInsertRowid, boat.id);
  });
});

assign();
console.log(`Assigned owners to ${boats.length} boats.`);
console.log(`Demo seller accounts log in with their phone (555020xxxx) and password "${DEFAULT_PASSWORD}".`);

// The app auto-promotes the first-ever registered user to admin, which only
// works on a database with zero users. This DB ships pre-seeded with the
// sellers above, so that bootstrap can never fire — create a standing admin
// account here instead.
const ADMIN_PHONE = '5550009999';
const ADMIN_PASSWORD = 'AdminPass123';
const hasAdmin = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get().count > 0;
if (!hasAdmin) {
  db.prepare(
    `INSERT INTO users (first_name, last_name, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')`
  ).run('Site', 'Admin', ADMIN_PHONE, hashPassword(ADMIN_PASSWORD));
  console.log(`Created admin account: phone ${ADMIN_PHONE} / password "${ADMIN_PASSWORD}".`);
}
