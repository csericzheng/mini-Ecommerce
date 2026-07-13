const test = require('node:test');
const assert = require('node:assert/strict');
const { distanceKm } = require('../../lib/geo');

test('distanceKm returns 0 for identical coordinates', () => {
  assert.equal(distanceKm(43.6532, -79.3832, 43.6532, -79.3832), 0);
});

test('distanceKm computes the known distance between Toronto and Montreal (~500km)', () => {
  const km = distanceKm(43.6532, -79.3832, 45.5019, -73.5674);
  assert.ok(km > 470 && km < 550, `expected ~500km, got ${km}`);
});

test('distanceKm computes the known distance between Vancouver and Halifax (~4400km)', () => {
  const km = distanceKm(49.2827, -123.1207, 44.6488, -63.5752);
  assert.ok(km > 4300 && km < 4600, `expected ~4400km, got ${km}`);
});

test('distanceKm is symmetric', () => {
  const a = distanceKm(43.6532, -79.3832, 45.5019, -73.5674);
  const b = distanceKm(45.5019, -73.5674, 43.6532, -79.3832);
  assert.ok(Math.abs(a - b) < 1e-9);
});
