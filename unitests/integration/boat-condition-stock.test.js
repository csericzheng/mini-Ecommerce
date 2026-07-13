const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, registerUser, createBoatViaSell, createBoatViaAdmin } = require('../helpers/app-harness');

let app;
let adminCookie;
let buyerCookie;

test.before(async () => {
  app = createTestApp();
  ({ cookie: adminCookie } = await registerUser(app.baseUrl, { firstName: 'Admin', lastName: 'User', phone: '5550500001' }));
  ({ cookie: buyerCookie } = await registerUser(app.baseUrl, { firstName: 'Buyer', lastName: 'User', phone: '5550500002' }));
});
test.after(() => app.close());

test('a new (dealer) boat with zero stock shows "Pending Sale" and cannot be added to cart', async () => {
  const boatId = await createBoatViaAdmin(app.baseUrl, adminCookie, { name: 'New Boat Zero Stock', stock: '0' });

  const detailRes = await fetch(`${app.baseUrl}/boats/${boatId}`);
  const detailBody = await detailRes.text();
  assert.ok(detailBody.includes('Pending Sale'));
  assert.ok(detailBody.includes('<strong>Condition:</strong> New'));

  const homeBody = await (await fetch(`${app.baseUrl}/`)).text();
  assert.ok(homeBody.includes('Pending Sale'));

  await fetch(`${app.baseUrl}/cart/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: buyerCookie },
    body: new URLSearchParams({ boatId: String(boatId) }),
    redirect: 'manual',
  });
  const cartBody = await (await fetch(`${app.baseUrl}/cart`, { headers: { Cookie: buyerCookie } })).text();
  assert.ok(!cartBody.includes('New Boat Zero Stock'));
});

test('a used boat with zero stock is still shown as available (no "Pending Sale")', async () => {
  const boatId = await createBoatViaSell(app.baseUrl, adminCookie, { name: 'Used Boat Zero Stock', stock: '1' });

  // Simulate a boat whose stock was already exhausted (e.g. an admin edit)
  // while status is still 'available' — used boats should ignore this.
  const db = require('../../db/database');
  db.prepare('UPDATE boats SET stock = 0 WHERE id = ?').run(boatId);

  const detailRes = await fetch(`${app.baseUrl}/boats/${boatId}`);
  const detailBody = await detailRes.text();
  assert.ok(!detailBody.includes('Pending Sale'));
  assert.ok(detailBody.includes('<strong>Condition:</strong> Used'));
  assert.ok(!detailBody.includes('<strong>Stock:</strong>'));

  const homeBody = await (await fetch(`${app.baseUrl}/`)).text();
  const cardIndex = homeBody.indexOf('Used Boat Zero Stock');
  const cardSnippet = homeBody.slice(cardIndex - 500, cardIndex);
  assert.ok(!cardSnippet.includes('Pending Sale'));

  const addRes = await fetch(`${app.baseUrl}/cart/add`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: buyerCookie },
    body: new URLSearchParams({ boatId: String(boatId) }),
    redirect: 'manual',
  });
  assert.equal(addRes.status, 302);
  const cartBody = await (await fetch(`${app.baseUrl}/cart`, { headers: { Cookie: buyerCookie } })).text();
  assert.ok(cartBody.includes('Used Boat Zero Stock'));
});
