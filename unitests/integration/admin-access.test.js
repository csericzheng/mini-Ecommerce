const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, registerUser } = require('../helpers/app-harness');

let app;
let adminCookie;
let userCookie;
let userId;

test.before(async () => {
  app = createTestApp();
  // First registrant becomes admin (see auth.test.js for that behavior itself).
  ({ cookie: adminCookie } = await registerUser(app.baseUrl, { firstName: 'Admin', lastName: 'User', phone: '5550100001' }));
  ({ cookie: userCookie } = await registerUser(app.baseUrl, { firstName: 'Regular', lastName: 'User', phone: '5550100002' }));

  const db = require('../../db/database');
  userId = db.prepare('SELECT id FROM users WHERE phone = ?').get('5550100002').id;
});
test.after(() => app.close());

test('an anonymous request to /admin redirects to /login', async () => {
  const res = await fetch(`${app.baseUrl}/admin`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').startsWith('/login'));
});

test('a logged-in non-admin gets 403 from /admin', async () => {
  const res = await fetch(`${app.baseUrl}/admin`, { headers: { Cookie: userCookie } });
  assert.equal(res.status, 403);
});

test('a logged-in non-admin gets 403 from /admin/users', async () => {
  const res = await fetch(`${app.baseUrl}/admin/users`, { headers: { Cookie: userCookie } });
  assert.equal(res.status, 403);
});

test('the admin can reach /admin and /admin/users', async () => {
  const boatsRes = await fetch(`${app.baseUrl}/admin`, { headers: { Cookie: adminCookie } });
  assert.equal(boatsRes.status, 200);

  const usersRes = await fetch(`${app.baseUrl}/admin/users`, { headers: { Cookie: adminCookie } });
  assert.equal(usersRes.status, 200);
});

test('the admin can promote another user to admin', async () => {
  const res = await fetch(`${app.baseUrl}/admin/users/${userId}/role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: adminCookie },
    body: new URLSearchParams({ role: 'admin' }),
    redirect: 'manual',
  });
  assert.equal(res.status, 302);

  const db = require('../../db/database');
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
  assert.equal(user.role, 'admin');

  // Revert so later tests in this file keep their expected roles.
  db.prepare("UPDATE users SET role = 'user' WHERE id = ?").run(userId);
});

test('an admin cannot change their own role (self-lockout guard)', async () => {
  const db = require('../../db/database');
  const adminId = db.prepare('SELECT id FROM users WHERE phone = ?').get('5550100001').id;

  await fetch(`${app.baseUrl}/admin/users/${adminId}/role`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: adminCookie },
    body: new URLSearchParams({ role: 'user' }),
    redirect: 'manual',
  });

  const admin = db.prepare('SELECT role FROM users WHERE id = ?').get(adminId);
  assert.equal(admin.role, 'admin');
});
