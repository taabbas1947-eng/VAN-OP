/* SPEC-06 check harness — pulls the real function sources out of o2s.html and
   runs them in a sandbox with minimal stubs. No copies of the logic. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

/* Resolved from this file, so the suite runs from anywhere. Layout: o2s/tests/ */
const APP   = path.join(__dirname, '..', 'o2s.html');
const STATE = path.join(__dirname, '..', '..', 'data', 'state.json');

const html = fs.readFileSync(APP, 'utf8');

function grab(name) {
  const re = new RegExp('(^|\\n)(function\\s+' + name + '\\s*\\()');
  const m = re.exec(html);
  if (!m) throw new Error('not found: ' + name);
  let i = html.indexOf('function ' + name, m.index);
  let j = html.indexOf('{', i);
  let depth = 0, inS = null, prev = '';
  for (let k = j; k < html.length; k++) {
    const c = html[k];
    if (inS) {
      if (c === inS && prev !== '\\') inS = null;
    } else if (c === '"' || c === "'" || c === '`') inS = c;
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return html.slice(i, k + 1); }
    prev = c;
  }
  throw new Error('unbalanced: ' + name);
}

function grabVar(name) {
  const re = new RegExp('\\nvar\\s+' + name + '\\s*=\\s*\\[[\\s\\S]*?\\];');
  const m = re.exec(html);
  if (!m) throw new Error('var not found: ' + name);
  return m[0];
}

const NAMES = [
  'printPolicyOL', 'mrpTag', 'qcExpect', 'qcNeedsSeenPrice', 'qcVerifyGate',
  'qcVerifyRecord', 'qcVerifyRows', 'qcVerifyTable', 'qcVerifyFailed',
  'packPriceGate', 'packPriceRecord', 'setPrintOn', 'entryPrintMode',
];

const src = NAMES.map(grab).join('\n\n') + '\n' + grabVar('QC_VERIFY');

const sandbox = {
  console,
  entryPrintOn: null,
  state: { role: 'COO', currentUser: { name: 'tahir' }, packingLog: [], orders: [] },
  fmt: n => String(n),
  _av: v => (v == null ? '' : String(v)),
  recallPrintPrice: () => 0,
  screenEntry: () => {},
  Date,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

/* ---- test runner ---- */
let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) pass++;
  else { fail++; fails.push(name + (extra ? '  [' + extra + ']' : '')); }
}
function eq(name, got, want) { ok(name, got === want, 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }

module.exports = { sandbox, ok, eq, report, grab, APP, STATE, html };
function report(label) {
  console.log('\n' + label + ': ' + pass + ' passed, ' + fail + ' failed');
  fails.forEach(f => console.log('  FAIL  ' + f));
  return fail;
}
