const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../../lib/password');

test('verifyPassword accepts the correct password', () => {
  const hash = hashPassword('correct-horse-battery-staple');
  assert.equal(verifyPassword('correct-horse-battery-staple', hash), true);
});

test('verifyPassword rejects an incorrect password', () => {
  const hash = hashPassword('correct-horse-battery-staple');
  assert.equal(verifyPassword('wrong-password', hash), false);
});

test('hashPassword salts each hash differently for the same input', () => {
  const first = hashPassword('same-password');
  const second = hashPassword('same-password');
  assert.notEqual(first, second);
  assert.equal(verifyPassword('same-password', first), true);
  assert.equal(verifyPassword('same-password', second), true);
});

test('hashPassword output stores salt and hash separated by a colon', () => {
  const hash = hashPassword('anything');
  const parts = hash.split(':');
  assert.equal(parts.length, 2);
  assert.ok(parts[0].length > 0);
  assert.ok(parts[1].length > 0);
});
