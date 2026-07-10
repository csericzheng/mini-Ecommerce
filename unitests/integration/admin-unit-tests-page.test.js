const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('child_process');
const { createTestApp, registerUser } = require('../helpers/app-harness');

const SAMPLE_JUNIT_XML = `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
	<testcase name="a sample passing test" time="0.05" classname="test" file="C:\\project\\unitests\\lib\\example.test.js"/>
	<!-- tests 1 -->
	<!-- pass 1 -->
	<!-- fail 0 -->
	<!-- duration_ms 50 -->
</testsuites>
`;

let app;
let adminCookie;
let userCookie;

test.before(async () => {
  app = createTestApp();
  ({ cookie: adminCookie } = await registerUser(app.baseUrl, { firstName: 'Admin', lastName: 'User', phone: '5550400001' }));
  ({ cookie: userCookie } = await registerUser(app.baseUrl, { firstName: 'Regular', lastName: 'User', phone: '5550400002' }));
});
test.after(() => app.close());

test('an anonymous request to /admin/tests redirects to /login', async () => {
  const res = await fetch(`${app.baseUrl}/admin/tests`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.ok(res.headers.get('location').startsWith('/login'));
});

test('a logged-in non-admin gets 403 from /admin/tests', async () => {
  const res = await fetch(`${app.baseUrl}/admin/tests`, { headers: { Cookie: userCookie } });
  assert.equal(res.status, 403);
});

// /admin/tests shells out to `node --test` to run the whole suite, which
// would include this very file — actually letting that happen here would
// recurse. Stub execFile so we exercise the route's own parsing/rendering
// logic (already unit-tested for parseJUnitReport itself) without spawning
// a real nested test run; the real end-to-end behavior was verified
// manually against a running server.
test('the admin sees a rendered report with a pass/fail summary', async (t) => {
  t.mock.method(childProcess, 'execFile', (file, args, options, callback) => {
    callback(null, SAMPLE_JUNIT_XML, '');
  });

  const res = await fetch(`${app.baseUrl}/admin/tests`, { headers: { Cookie: adminCookie } });
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.ok(body.includes('Unit Test Report'));
  assert.ok(body.includes('a sample passing test'));
  assert.ok(/class="test-status pass"/.test(body));
});

test('a test run that produces no output renders an error instead of crashing', async (t) => {
  t.mock.method(childProcess, 'execFile', (file, args, options, callback) => {
    callback(new Error('spawn failed'), '', '');
  });

  const res = await fetch(`${app.baseUrl}/admin/tests`, { headers: { Cookie: adminCookie } });
  assert.equal(res.status, 500);
  const body = await res.text();
  assert.ok(body.includes('spawn failed'));
});
