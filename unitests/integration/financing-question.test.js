const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, registerUser, createBoatViaSell } = require('../helpers/app-harness');

let app;
let adminCookie;
let buyerCookie;

test.before(async () => {
  app = createTestApp();
  ({ cookie: adminCookie } = await registerUser(app.baseUrl, { firstName: 'Admin', lastName: 'User', phone: '5550600001' }));
  ({ cookie: buyerCookie } = await registerUser(app.baseUrl, { firstName: 'Finance', lastName: 'Buyer', phone: '5550600002' }));
});
test.after(() => app.close());

async function checkout(cookie, financingNeeded) {
  const boatId = await createBoatViaSell(app.baseUrl, adminCookie, { name: `Financing Test Boat ${financingNeeded}` });
  await fetch(`${app.baseUrl}/cart/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
    body: new URLSearchParams({ boatId: String(boatId) }),
  });
  const body = financingNeeded === undefined ? undefined : new URLSearchParams({ financingNeeded });
  await fetch(`${app.baseUrl}/cart/checkout`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie } : { Cookie: cookie },
    body,
  });
  const db = require('../../db/database');
  return db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1').get();
}

test('answering "yes" records financing_needed = 1', async () => {
  const order = await checkout(buyerCookie, 'yes');
  assert.equal(order.financing_needed, 1);
});

test('answering "no" records financing_needed = 0', async () => {
  const order = await checkout(buyerCookie, 'no');
  assert.equal(order.financing_needed, 0);
});

test('omitting the field defaults to financing_needed = 0', async () => {
  const order = await checkout(buyerCookie, undefined);
  assert.equal(order.financing_needed, 0);
});

test('the admin orders page shows Yes/No for the financing answer', async () => {
  const yesOrder = await checkout(buyerCookie, 'yes');
  const noOrder = await checkout(buyerCookie, 'no');

  const res = await fetch(`${app.baseUrl}/admin/orders`, { headers: { Cookie: adminCookie } });
  assert.equal(res.status, 200);
  const body = await res.text();

  const rowFor = (orderId) => {
    const idx = body.indexOf(`#${orderId}<`);
    return body.slice(idx, idx + 600);
  };
  assert.ok(rowFor(yesOrder.id).includes('<td>Yes</td>'));
  assert.ok(rowFor(noOrder.id).includes('<td>No</td>'));
});
