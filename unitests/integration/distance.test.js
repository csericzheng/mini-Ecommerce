const test = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, createBoatViaAdmin, registerUser } = require('../helpers/app-harness');

let app;
let adminCookie;

test.before(async () => {
  app = createTestApp();
  ({ cookie: adminCookie } = await registerUser(app.baseUrl, { firstName: 'Admin', lastName: 'User', phone: '5550700001' }));
});
test.after(() => app.close());

test('the homepage has no distances and shows the "use my location" button before a location is set', async () => {
  await createBoatViaAdmin(app.baseUrl, adminCookie, { name: 'Toronto Test Boat', city: 'Toronto', province: 'Ontario' });

  const res = await fetch(`${app.baseUrl}/`);
  const body = await res.text();
  assert.ok(body.includes('useMyLocationBtn'));
  assert.ok(!body.includes('km away'));
});

test('POST /location saves coordinates in the session and redirects back', async () => {
  const res = await fetch(`${app.baseUrl}/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: adminCookie },
    body: new URLSearchParams({ lat: '43.6532', lng: '-79.3832' }), // Toronto
    redirect: 'manual',
  });
  assert.equal(res.status, 302);
});

test('after a location is set, the homepage shows a distance for boats with a known city and hides the button', async () => {
  const res = await fetch(`${app.baseUrl}/`, { headers: { Cookie: adminCookie } });
  const body = await res.text();
  assert.ok(!body.includes('useMyLocationBtn'));

  // The boat could also be the hero's "Featured Listing" (most-viewed), so
  // search from the boat-grid section, not the first match in the whole page.
  const gridStart = body.indexOf('boat-grid');
  const idx = body.indexOf('Toronto Test Boat', gridStart);
  const cardSnippet = body.slice(idx, idx + 800);
  assert.ok(cardSnippet.includes('0 km away'), 'distance from Toronto to a Toronto boat should be ~0km');
});

test('a boat in a different city shows a non-zero distance', async () => {
  await createBoatViaAdmin(app.baseUrl, adminCookie, { name: 'Vancouver Test Boat', city: 'Vancouver', province: 'British Columbia' });

  const res = await fetch(`${app.baseUrl}/`, { headers: { Cookie: adminCookie } });
  const body = await res.text();
  const gridStart = body.indexOf('boat-grid');
  const idx = body.indexOf('Vancouver Test Boat', gridStart);
  const cardSnippet = body.slice(idx, idx + 800);
  const match = cardSnippet.match(/(\d+) km away/);
  assert.ok(match, 'expected a "N km away" distance');
  assert.ok(Number(match[1]) > 3000, `expected Toronto-Vancouver to be a few thousand km, got ${match[1]}`);
});
