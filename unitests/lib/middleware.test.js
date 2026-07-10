const test = require('node:test');
const assert = require('node:assert/strict');
const { requireAuth, requireAdmin } = require('../../lib/middleware');

function mockRes() {
  const res = {
    statusCode: null,
    redirectedTo: null,
    rendered: null,
    locals: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    redirect(url) {
      this.redirectedTo = url;
    },
    render(view) {
      this.rendered = view;
    },
  };
  return res;
}

test('requireAuth redirects to /login with a next param when logged out', () => {
  const req = { session: {}, originalUrl: '/sell/new' };
  const res = mockRes();
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.redirectedTo, '/login?next=%2Fsell%2Fnew');
});

test('requireAuth calls next() when logged in', () => {
  const req = { session: { userId: 1 } };
  const res = mockRes();
  let nextCalled = false;
  requireAuth(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(res.redirectedTo, null);
});

test('requireAdmin redirects to /login when logged out', () => {
  const req = { session: {}, originalUrl: '/admin' };
  const res = mockRes();
  let nextCalled = false;
  requireAdmin(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.redirectedTo, '/login?next=%2Fadmin');
});

test('requireAdmin renders 403 for a logged-in non-admin', () => {
  const req = { session: { userId: 2 } };
  const res = mockRes();
  res.locals.currentUser = { id: 2, role: 'user' };
  let nextCalled = false;
  requireAdmin(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.rendered, '403');
});

test('requireAdmin calls next() for a logged-in admin', () => {
  const req = { session: { userId: 3 } };
  const res = mockRes();
  res.locals.currentUser = { id: 3, role: 'admin' };
  let nextCalled = false;
  requireAdmin(req, res, () => { nextCalled = true; });

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null);
});
