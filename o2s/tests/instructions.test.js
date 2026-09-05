/* INSTRUCTIONS (in-app manual) — screenInstructions().
   2026-09-05. The manual had drifted from reality: no Production Manager role,
   no Reconciliation tab, and a Shipments write-up from before the DC-approval /
   Gate-Pass-release / delivery-confirmation pipeline existed (it used to claim
   "recording sends & closes it — counts as delivered", which is no longer true
   for anything left "in transit"). This just guards that the refreshed content
   stays in place — it does not re-verify the underlying workflow, which the
   shipment/production-manager-split tests already cover.

   Run: node instructions.test.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }

const APP = path.join(__dirname, '..', 'o2s.html');
const STATE = path.join(__dirname, '..', '..', 'data', 'state.json');
const html = fs.readFileSync(APP, 'utf8');
const BLOCKS = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

function app() {
  const el = () => ({ innerHTML: '', textContent: '', value: '', style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, querySelector() { return el(); },
    querySelectorAll() { return []; }, focus() {}, click() {}, getAttribute() { return null; },
    setAttribute() {}, remove() {}, dataset: {}, children: [], parentNode: null, scrollIntoView() {} });
  const doc = { getElementById() { return el(); }, querySelector() { return el(); },
    querySelectorAll() { return []; }, createElement() { return el(); },
    body: el(), documentElement: el(), head: el(), addEventListener() {} };
  const c = { console, JSON, Math, Date, String, Number, Array, Object, Boolean, RegExp, Error,
    isNaN, parseInt, parseFloat, Promise, Intl, URL, encodeURIComponent, decodeURIComponent,
    document: doc,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch() { return Promise.resolve({ json: () => ({}) }); },
    alert() {}, confirm() { return true; }, prompt() { return ''; },
    location: { href: '', search: '', reload() {} }, navigator: { userAgent: 'node' },
    history: { pushState() {} }, requestAnimationFrame() {}, performance: { now() { return 0; } },
    Blob: function () {}, btoa: s => s, atob: s => s };
  c.window = c; c.globalThis = c; c.self = c;
  vm.createContext(c);
  BLOCKS.forEach(b => vm.runInContext(b, c));
  const real = JSON.parse(fs.readFileSync(STATE, 'utf8')).data;
  c.__st = JSON.parse(JSON.stringify(real));
  vm.runInContext('state = __st; state.currentUser = {name:"Test User", role:"COO"};', c);
  return c;
}
const run = (c, src) => vm.runInContext(src, c);

/* ================= 1. renders without throwing, for a couple of roles ================= */
for (const role of ['COO', 'Production Manager', 'Supply Chain']) {
  const c = app();
  run(c, `state.role='${role}';`);
  const res = run(c, "(function(){ try { screenInstructions(); return 'ok'; } catch(e) { return 'ERR: '+e.message; } })()");
  ok(`screenInstructions() renders for ${role} without throwing`, res === 'ok', res);
}

/* ================= 2. Production Manager is a documented role, not just Production ========= */
{
  ok("roleGuide includes a 'Production Manager' row", /role:'Production Manager'/.test(html));
  ok("Production Manager's write-up covers the shift-void / by-product-divert-rework calls",
     /Production Manager.{0,400}(by-product|wrongly-logged)/s.test(html));
}

/* ================= 3. Reconciliation is documented, not orphaned in the manual ============= */
{
  ok("tab reference lists 'Reconciliation'", /\['Reconciliation',/.test(html));
  ok("the monitor-and-report step mentions Reconciliation", /Reconciliation.{0,200}packing trail/s.test(html));
}

/* ================= 4. Shipments write-up matches the real DC-approval / delivery pipeline === */
{
  ok("step 8 mentions the Plant Manager approving the DC",
     /Plant Manager to approve the DC/.test(html));
  ok("step 8 mentions confirming delivery separately from recording the shipment",
     /confirm.{0,20}delivery.{0,200}Sent.{0,10}tab/is.test(html));
  ok("step 8 no longer claims recording a shipment always counts as delivered",
     !/Recording sends &amp; closes the shipment — it counts as delivered/.test(html));
  ok("the flow table has a DC-approval stage between Shipment and Delivered",
     /\['DC approval',/.test(html));
  ok("key rules no longer say a PO closes on 'shipped' alone",
     !/A PO <b>closes<\/b> only when every product has shipped/.test(html));
}

console.log(`\nInstructions manual: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILURES:'); fails.forEach(f => console.log('  FAIL  ' + f)); process.exit(1); }
