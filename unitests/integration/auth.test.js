const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, registerUser, loginUser } = require('../helpers/app-harness');

let app;
test.before(() => { app = createTestApp(); });
test.after(() => app.close());

test('the first account ever registered becomes admin', async () => {
  const { response } = await registerUser(app.baseUrl, { firstName: 'First', lastName: 'User', phone: '5550000001' });
  assert.equal(response.status, 302);

  const db = require('../../db/database');
  const user = db.prepare('SELECT role FROM users WHERE phone = ?').get('5550000001');
  assert.equal(user.role, 'admin');
});

test('subsequent accounts register as plain users', async () => {
  await registerUser(app.baseUrl, { firstName: 'Second', lastName: 'User', phone: '5550000002' });

  const db = require('../../db/database');
  const user = db.prepare('SELECT role FROM users WHERE phone = ?').get('5550000002');
  assert.equal(user.role, 'user');
});

test('login fails with the wrong password', async () => {
  await registerUser(app.baseUrl, { firstName: 'Pass', lastName: 'Check', phone: '5550000003', password: 'rightpass' });
  const { response, cookie } = await loginUser(app.baseUrl, { phone: '5550000003', password: 'wrongpass' });
  assert.equal(response.status, 400);
  assert.equal(cookie, null);
});

test('login succeeds with the right password and starts a session', async () => {
  await registerUser(app.baseUrl, { firstName: 'Pass', lastName: 'Ok', phone: '5550000004', password: 'rightpass' });
  const { response, cookie } = await loginUser(app.baseUrl, { phone: '5550000004', password: 'rightpass' });
  assert.equal(response.status, 302);
  assert.ok(cookie);
});

test('logout clears the session so protected pages redirect to login again', async () => {
  const { cookie } = await registerUser(app.baseUrl, { firstName: 'Logout', lastName: 'Test', phone: '5550000005' });

  const logoutRes = await fetch(`${app.baseUrl}/logout`, { method: 'POST', headers: { Cookie: cookie }, redirect: 'manual' });
  assert.equal(logoutRes.status, 302);

  const afterLogout = await fetch(`${app.baseUrl}/sell/new`, { headers: { Cookie: cookie }, redirect: 'manual' });
  assert.equal(afterLogout.status, 302);
  assert.ok(afterLogout.headers.get('location').startsWith('/login'));
});
