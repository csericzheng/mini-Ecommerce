const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, registerUser, createBoatViaSell } = require('../helpers/app-harness');

let app;
let ownerCookie;
let otherCookie;
let adminCookie;
let boatId;

test.before(async () => {
  app = createTestApp();
  // First registrant becomes admin; register them first so later "regular
  // user" accounts don't accidentally pick up the admin role.
  ({ cookie: adminCookie } = await registerUser(app.baseUrl, { firstName: 'Admin', lastName: 'User', phone: '5550200001' }));
  ({ cookie: ownerCookie } = await registerUser(app.baseUrl, { firstName: 'Owner', lastName: 'User', phone: '5550200002' }));
  ({ cookie: otherCookie } = await registerUser(app.baseUrl, { firstName: 'Other', lastName: 'User', phone: '5550200003' }));

  boatId = await createBoatViaSell(app.baseUrl, ownerCookie, { name: 'Owner Boat' });
});
test.after(() => app.close());

test('the owner can view their own boat edit form', async () => {
  const res = await fetch(`${app.baseUrl}/sell/${boatId}/edit`, { headers: { Cookie: ownerCookie } });
  assert.equal(res.status, 200);
});

test('a different logged-in user gets 403 viewing the edit form', async () => {
  const res = await fetch(`${app.baseUrl}/sell/${boatId}/edit`, { headers: { Cookie: otherCookie } });
  assert.equal(res.status, 403);
});

test('a different logged-in user gets 403 submitting an edit', async () => {
  const res = await fetch(`${app.baseUrl}/sell/${boatId}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: otherCookie },
    body: new URLSearchParams({
      name: 'Hacked Name', type: 'Sailboat', manufacturer: 'X', year: '2020',
      length_ft: '10', capacity: '2', engine_hours: '0', price: '1', stock: '1', description: 'x',
    }),
  });
  assert.equal(res.status, 403);

  const db = require('../../db/database');
  const boat = db.prepare('SELECT name FROM boats WHERE id = ?').get(boatId);
  assert.equal(boat.name, 'Owner Boat');
});

test('the owner can successfully edit their own boat', async () => {
  const res = await fetch(`${app.baseUrl}/sell/${boatId}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: ownerCookie },
    body: new URLSearchParams({
      name: 'Renamed By Owner', type: 'Sailboat', manufacturer: 'Beneteau', year: '2021',
      length_ft: '31', capacity: '6', engine_hours: '55', price: '51000', stock: '1',
      city: 'Halifax', province: 'Nova Scotia', description: 'Updated',
    }),
    redirect: 'manual',
  });
  assert.equal(res.status, 302);

  const db = require('../../db/database');
  const boat = db.prepare('SELECT name, owner_id FROM boats WHERE id = ?').get(boatId);
  assert.equal(boat.name, 'Renamed By Owner');
});

test('an admin can edit a boat they do not own', async () => {
  const res = await fetch(`${app.baseUrl}/sell/${boatId}/edit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: adminCookie },
    body: new URLSearchParams({
      name: 'Renamed By Admin', type: 'Sailboat', manufacturer: 'Beneteau', year: '2021',
      length_ft: '31', capacity: '6', engine_hours: '55', price: '51000', stock: '1',
      city: 'Halifax', province: 'Nova Scotia', description: 'Updated by admin',
    }),
    redirect: 'manual',
  });
  assert.equal(res.status, 302);

  const db = require('../../db/database');
  const boat = db.prepare('SELECT name, owner_id FROM boats WHERE id = ?').get(boatId);
  assert.equal(boat.name, 'Renamed By Admin');
  // Editing through /sell/:id/edit must not silently reassign ownership.
  const owner = db.prepare('SELECT phone FROM users WHERE id = ?').get(boat.owner_id);
  assert.equal(owner.phone, '5550200002');
});

test('"My Listings" only shows boats the logged-in user owns', async () => {
  const res = await fetch(`${app.baseUrl}/sell`, { headers: { Cookie: otherCookie } });
  const body = await res.text();
  assert.ok(!body.includes('Renamed By Admin'));
});
