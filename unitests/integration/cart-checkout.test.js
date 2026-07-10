const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, registerUser, createBoatViaSell } = require('../helpers/app-harness');

let app;
let ownerCookie;
let buyerCookie;
let otherBuyerCookie;
let boatId;

test.before(async () => {
  app = createTestApp();
  ({ cookie: ownerCookie } = await registerUser(app.baseUrl, { firstName: 'Owner', lastName: 'User', phone: '5550300001' }));
  ({ cookie: buyerCookie } = await registerUser(app.baseUrl, {
    firstName: 'Buyer', lastName: 'NoEmail', phone: '5550300002',
  }));
  ({ cookie: otherBuyerCookie } = await registerUser(app.baseUrl, { firstName: 'Other', lastName: 'Buyer', phone: '5550300003' }));

  boatId = await createBoatViaSell(app.baseUrl, ownerCookie, { name: 'Cart Test Boat', stock: '2' });
});
test.after(() => app.close());

test('the owner cannot add their own boat to their cart', async () => {
  const res = await fetch(`${app.baseUrl}/cart/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: ownerCookie },
    body: new URLSearchParams({ boatId: String(boatId) }),
  });
  assert.equal(res.status, 403);
});

test('a different user can add the boat to their cart', async () => {
  await fetch(`${app.baseUrl}/cart/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: buyerCookie },
    body: new URLSearchParams({ boatId: String(boatId) }),
    redirect: 'manual',
  });

  const cartRes = await fetch(`${app.baseUrl}/cart`, { headers: { Cookie: buyerCookie } });
  const body = await cartRes.text();
  assert.ok(body.includes('Cart Test Boat'));
});

test('checkout succeeds even when the buyer has no email on file, and empties the cart', async () => {
  const res = await fetch(`${app.baseUrl}/cart/checkout`, {
    method: 'POST',
    headers: { Cookie: buyerCookie },
  });
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('Cart Test Boat'));

  const cartRes = await fetch(`${app.baseUrl}/cart`, { headers: { Cookie: buyerCookie } });
  const cartBody = await cartRes.text();
  assert.ok(cartBody.includes('Your cart is empty'));
});

test('checkout marks the boat pending, decrements stock by 1, and records the order', async () => {
  const db = require('../../db/database');
  const boat = db.prepare('SELECT status, stock FROM boats WHERE id = ?').get(boatId);
  assert.equal(boat.status, 'pending');
  assert.equal(boat.stock, 1);

  const order = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 1').get();
  assert.equal(order.customer_name, 'Buyer NoEmail');
  assert.equal(order.customer_email, null);

  const orderItem = db.prepare('SELECT * FROM order_items WHERE order_id = ?').get(order.id);
  assert.equal(orderItem.boat_id, boatId);
  assert.equal(orderItem.quantity, 1);
});

test('a pending boat cannot be added to a second buyer\'s cart', async () => {
  await fetch(`${app.baseUrl}/cart/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: otherBuyerCookie },
    body: new URLSearchParams({ boatId: String(boatId) }),
    redirect: 'manual',
  });

  const cartRes = await fetch(`${app.baseUrl}/cart`, { headers: { Cookie: otherBuyerCookie } });
  const body = await cartRes.text();
  assert.ok(body.includes('Your cart is empty'));
});
