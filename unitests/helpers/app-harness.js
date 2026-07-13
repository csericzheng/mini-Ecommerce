const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Points db/database.js at a throwaway SQLite file so integration tests
// never touch the committed, pre-seeded db/miniecommerce.db.
function createTestApp() {
  const dbPath = path.join(os.tmpdir(), `miniecommerce-test-${crypto.randomUUID()}.db`);
  process.env.DB_PATH = dbPath;

  const app = require('../../server');
  const db = require('../../db/database');
  const server = app.listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  function close() {
    return new Promise((resolve) => {
      server.close(() => {
        db.close();
        for (const suffix of ['', '-journal', '-wal', '-shm']) {
          fs.rmSync(dbPath + suffix, { force: true });
        }
        resolve();
      });
    });
  }

  return { baseUrl, close };
}

// Pulls the cookie(s) a response set, formatted for use as a request's
// Cookie header on the next call — a minimal stand-in for a cookie jar.
function sessionCookieFrom(response) {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) return null;
  return setCookie.split(',').map((part) => part.split(';')[0].trim()).join('; ');
}

// Registers a new account and returns its session cookie plus the raw
// response (redirects manually so callers can assert on the outcome).
async function registerUser(baseUrl, { firstName, lastName, phone, password = 'secret123', email }) {
  const response = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      firstName, lastName, phone, password, confirmPassword: password, ...(email ? { email } : {}),
    }),
    redirect: 'manual',
  });
  return { response, cookie: sessionCookieFrom(response) };
}

async function loginUser(baseUrl, { phone, password }) {
  const response = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ phone, password }),
    redirect: 'manual',
  });
  return { response, cookie: sessionCookieFrom(response) };
}

// Creates a boat via the real /sell/new form submission (as the given
// session) and returns its id, extracted from the redirect Location.
async function createBoatViaSell(baseUrl, cookie, overrides = {}) {
  const fields = {
    name: 'Test Boat', type: 'Sailboat', manufacturer: 'Beneteau', year: '2020',
    length_ft: '30', capacity: '6', engine_hours: '50', price: '50000', stock: '1',
    city: 'Halifax', province: 'Nova Scotia',
    description: 'A boat for testing.', image_file: 'placeholder.svg', ...overrides,
  };
  const response = await fetch(`${baseUrl}/sell/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: new URLSearchParams(fields),
    redirect: 'manual',
  });
  const location = response.headers.get('location');
  const boatId = Number(location.split('/').pop());
  return boatId;
}

// Creates a boat via the real /admin/new form submission (as the given
// admin session), defaulting to dealer "new" inventory. Looks the id up by
// name since /admin/new redirects to the boat list, not the boat itself.
async function createBoatViaAdmin(baseUrl, adminCookie, overrides = {}) {
  const fields = {
    name: `Admin Boat ${crypto.randomUUID()}`, type: 'Sailboat', manufacturer: 'Beneteau', year: '2020',
    length_ft: '30', capacity: '6', engine_hours: '50', price: '50000', stock: '1',
    status: 'available', condition: 'new', city: 'Halifax', province: 'Nova Scotia',
    description: 'A dealer boat for testing.', image_file: 'placeholder.svg', ...overrides,
  };
  await fetch(`${baseUrl}/admin/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: adminCookie },
    body: new URLSearchParams(fields),
    redirect: 'manual',
  });
  const db = require('../../db/database');
  return db.prepare('SELECT id FROM boats WHERE name = ?').get(fields.name).id;
}

module.exports = { createTestApp, sessionCookieFrom, registerUser, loginUser, createBoatViaSell, createBoatViaAdmin };
