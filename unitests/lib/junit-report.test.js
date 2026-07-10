const test = require('node:test');
const assert = require('node:assert/strict');
const { parseJUnitReport } = require('../../lib/junit-report');

const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
	<testcase name="a passing test" time="0.194781" classname="test" file="C:\\project\\unitests\\lib\\example.test.js"/>
	<testcase name="a failing test" time="0.001030" classname="test" file="C:\\project\\unitests\\lib\\example.test.js" failure="one is not two&#10;&#10;1 !== 2&#10;">
		<failure type="testCodeFailure" message="one is not two&#10;&#10;1 !== 2">stack trace here</failure>
	</testcase>
	<!-- tests 2 -->
	<!-- suites 0 -->
	<!-- pass 1 -->
	<!-- fail 1 -->
	<!-- cancelled 0 -->
	<!-- skipped 0 -->
	<!-- todo 0 -->
	<!-- duration_ms 98.8628 -->
</testsuites>
`;

test('parseJUnitReport extracts each testcase with name, file, and pass/fail', () => {
  const { tests } = parseJUnitReport(SAMPLE_XML);
  assert.equal(tests.length, 2);

  assert.equal(tests[0].name, 'a passing test');
  assert.equal(tests[0].passed, true);
  assert.equal(tests[0].failureMessage, null);
  assert.equal(tests[0].file, 'lib/example.test.js');
  assert.equal(tests[0].time_ms, 195);

  assert.equal(tests[1].name, 'a failing test');
  assert.equal(tests[1].passed, false);
  assert.ok(tests[1].failureMessage.includes('one is not two'));
});

test('parseJUnitReport extracts the summary counts from the trailing comments', () => {
  const { summary } = parseJUnitReport(SAMPLE_XML);
  assert.deepEqual(summary, {
    tests: 2, suites: 0, pass: 1, fail: 1, cancelled: 0, skipped: 0, todo: 0, duration_ms: 98.8628,
  });
});

test('parseJUnitReport returns an empty result for XML with no testcases', () => {
  const { tests, summary } = parseJUnitReport('<testsuites></testsuites>');
  assert.deepEqual(tests, []);
  assert.deepEqual(summary, {});
});

// Regression test: Node's junit reporter does not escape a literal '>'
// inside an attribute value (e.g. a test named "...price->price_cents"),
// which previously broke the naive `[^>]*` attribute scanning and silently
// dropped that testcase (and shifted every one after it).
test('parseJUnitReport handles a test name containing a literal ">" character', () => {
  const xmlWithGreaterThan = `<testsuites>
	<testcase name="minus price->price_cents should still parse" time="0.000502" classname="test" file="C:\\project\\unitests\\lib\\example.test.js"/>
	<testcase name="a test after the tricky one" time="0.001" classname="test" file="C:\\project\\unitests\\lib\\example.test.js"/>
	<!-- tests 2 -->
	<!-- pass 2 -->
	<!-- fail 0 -->
</testsuites>`;

  const { tests } = parseJUnitReport(xmlWithGreaterThan);
  assert.equal(tests.length, 2);
  assert.equal(tests[0].name, 'minus price->price_cents should still parse');
  assert.equal(tests[1].name, 'a test after the tricky one');
});
