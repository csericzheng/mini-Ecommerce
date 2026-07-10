// Parses the XML produced by `node --test --test-reporter=junit`. Node's
// test runner has no built-in JSON reporter, and junit's flat structure is
// simple enough to pull apart without a full XML parser.
function decodeEntities(str) {
  return str
    .replace(/&#10;/g, '\n')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function shortFile(file) {
  if (!file) return '';
  const parts = file.split(/[\\/]/);
  return parts.slice(-2).join('/');
}

function parseJUnitReport(xml) {
  const tests = [];
  // Only the opening tag is matched (self-closing or not) — every field we
  // need, including the failure message, is an attribute on <testcase>
  // itself, so the element body (a redundant nested <failure>) can be
  // ignored entirely. Attribute values are scoped by their quotes rather
  // than by excluding '>', since test names can legitimately contain a
  // literal '>' (e.g. "minus price->price_cents") that Node's junit
  // reporter does not escape.
  const testcaseRegex = /<testcase\b((?:\s+[\w-]+="[^"]*")*)\s*\/?>/g;
  const attrRegex = /([\w-]+)="([^"]*)"/g;

  let match;
  while ((match = testcaseRegex.exec(xml))) {
    const attrs = {};
    let attrMatch;
    attrRegex.lastIndex = 0;
    while ((attrMatch = attrRegex.exec(match[1]))) {
      attrs[attrMatch[1]] = decodeEntities(attrMatch[2]);
    }
    tests.push({
      name: attrs.name || '(unnamed test)',
      file: shortFile(attrs.file),
      time_ms: Math.round(parseFloat(attrs.time || '0') * 1000),
      passed: !attrs.failure,
      failureMessage: attrs.failure || null,
    });
  }

  const summary = {};
  const summaryRegex = /<!--\s*(\w+)\s+([\d.]+)\s*-->/g;
  let summaryMatch;
  while ((summaryMatch = summaryRegex.exec(xml))) {
    summary[summaryMatch[1]] = Number(summaryMatch[2]);
  }

  return { tests, summary };
}

module.exports = { parseJUnitReport };
