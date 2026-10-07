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
const STATE = path.join(__dirname, '..', '..', '..', 'data', 'state.json');
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

/* ================= 2. Production Manager (07h: in the Reference's stuck list) ========= */
{
  ok("the Production Manager or the Plant Manager removes a wrongly logged shift",
     /\['A shift was logged wrongly','Only the Production Manager or the Plant Manager can remove it, and not once the lab has the lot or it is packed\./.test(html));
}

/* ================= 3-4. 07h: the Reference is rebuilt from the app's own tables ===== */
{
  const c = app();
  const ref = run(c, "(function(){ state.role='COO'; return guideReference(); })()");
  ok('Reconcile packing is listed under Where things are', /Reconcile packing/.test(ref));
  ok('the truck steps are in order: load, inspect, gate pass, review, release, confirm delivery',
     /Truck to load[\s\S]*Inspect the truck before it leaves[\s\S]*Gate pass to issue[\s\S]*Truck to review before release[\s\S]*Truck to approve and release[\s\S]*Delivery to confirm/.test(ref));
  ok('no old screen names (My Actions, PO Tracker, New PO Entry, Data Fix, Sent tab)', !/My Actions|PO Tracker|New PO Entry|Data Fix|Sent tab/.test(ref));
  ok('a delivery left unconfirmed says who gets it and when', /for Supply Chain from day 1, for the Plant Manager from day 2/.test(ref));
}

console.log(`\nInstructions manual: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILURES:'); fails.forEach(f => console.log('  FAIL  ' + f)); process.exit(1); }
