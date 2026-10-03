/* CUSTOMER MASTER FIX -- 2026-08-27.
   Covers the design-artifact-approved fixes shipped this round:
   1. Every customer/dealer row gets a stable `id` (= its own code), so merge3's
      per-record merge (_arrId) applies to state.customers/state.dealers instead of
      falling back to whole-array replace on a save conflict.
   2. custCode('Dealer', ...) now takes the region/city actually picked in the form
      and uses them directly -- it no longer routes through the orphaned dlrForm
      global via suggestCode(), which silently stamped every dealer with the same
      wrong region/city regardless of what was selected.
   3. The dead pre-unification dealer-onboarding path (dlrForm, suggestCode,
      onDlrRegion, onDlrCity, addDealer) is removed outright.
   4. state.dealers is retired as a write target in custSave -- state.customers
      (segment==='Dealer') is the single source of truth going forward.
   5. A Status field (Active/Inactive) is addable on the Customer Master form, and
      a Deactivate/Reactivate action exists per row -- there was previously no way
      to retire a customer record at all.

   NOT in this round: the name-vs-code join-key issue (order entry and DC printing
   still resolve a customer by name, not by the code this screen assigns) -- that
   is a separate, larger change across New PO Entry and Shipments, flagged but not
   built here.

   Run: node customermaster.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;
const BLOCKS = [...H.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

/* ================= 1. source-level: the dead dealer-onboarding path is really gone ================= */
{
  ['dlrForm', 'suggestCode', 'onDlrRegion', 'onDlrCity', 'addDealer'].forEach(name => {
    ok(name + ' no longer defined anywhere in the app',
       !new RegExp('\\b(function\\s+' + name + '\\s*\\(|let\\s+' + name + '\\s*=|var\\s+' + name + '\\s*=)').test(H.html));
  });
}

/* ================= 2. source-level: custCode takes region/city and uses them for Dealer ================= */
{
  const codeBody = H.grab('custCode');
  ok('custCode signature accepts region and city', /function custCode\(seg,name,inducted,outlet,region,city\)/.test(codeBody), codeBody.slice(0, 60));
  ok('the Dealer branch reads the passed-in region, not a dlrForm global', /regAbbr\(region\|\|''\)/.test(codeBody), codeBody);
  ok('the Dealer branch reads the passed-in city, not a dlrForm global', /cityAbbr\(city\)/.test(codeBody), codeBody);
  ok('the Dealer branch no longer mentions dlrForm at all', !/dlrForm/.test(codeBody));
  const callSite = H.grab('custSave');
  ok('custSave passes the form\'s own region/city into custCode', /custCode\(f\.segment,f\.name,f\.inducted,f\.outlet,f\.region,f\.city\)/.test(callSite), callSite.slice(0, 260));
}

/* ================= 3. source-level: merge-safety ids ================= */
{
  const ensureBody = H.grab('ensureRecordIds');
  ok('ensureRecordIds backfills customer ids from code', /s\.customers\|\|\[\]\)\.forEach.*c\.id=c\.code/.test(ensureBody.replace(/\s+/g, ' ')), ensureBody);
  ok('ensureRecordIds backfills dealer ids from code', /s\.dealers\|\|\[\]\)\.forEach.*d\.id=d\.code/.test(ensureBody.replace(/\s+/g, ' ')), ensureBody);
  const saveBody = H.grab('custSave');
  ok('custSave stamps id:code on the record it saves', /var rec=\{id:code,code:code/.test(saveBody), saveBody.slice(0, 80));
  const initBody = H.grab('custInit');
  ok('custInit\'s seed helper also stamps id on first-time records', /if\(c\.id==null\)\s*c\.id=c\.code/.test(initBody.replace(/\s+/g, ' ')), initBody);
}

/* ================= 4. source-level: state.dealers retired as a write target ================= */
{
  const saveBody = H.grab('custSave');
  ok('custSave no longer pushes into state.dealers', !/state\.dealers\.push/.test(saveBody), saveBody);
  ok('custSave no longer syncs into state.dealers at all', !/state\.dealers=state\.dealers\|\|\[\]/.test(saveBody));
}

/* ================= 5. source-level: Status field + Deactivate/Reactivate action ================= */
{
  const formBody = H.grab('custFormHTML');
  ok('the Add/Edit form now has a Status field', /fld\('Status'/.test(formBody), formBody.slice(-400));
  ok('the Status field offers Active and Inactive', /\['Active','Inactive'\]/.test(formBody));
  ok('custToggleStatus exists', H.html.includes('function custToggleStatus('));
  const toggleBody = H.grab('custToggleStatus');
  ok('custToggleStatus is gated the same way custSave amends are', /may\('customer\.amend'\)/.test(toggleBody), toggleBody);
  ok('custToggleStatus flips Active<->Inactive', /'Active'\)\?'Inactive':'Active'/.test(toggleBody.replace(/\s+/g, '')));
  const dealersScreen = H.grab('screenDealers');
  ok('the customer list wires up custToggleStatus on every row', (dealersScreen.match(/custToggleStatus\(/g) || []).length >= 2, 'occurrences: ' + (dealersScreen.match(/custToggleStatus\(/g) || []).length);
  ok('the toggle button label switches between Deactivate and Reactivate', /'Deactivate':'Reactivate'/.test(dealersScreen.replace(/\s+/g, '')));
}

/* ---- a sandbox with just enough browser to actually run the Customer Master
   functions -- same shape as poentry.test.js's app(), reused rather than
   reinvented. Loads every real <script> block, so SEED/regAbbr/cityAbbr/may/
   the real rights model are all the genuine ones, not stand-ins. ---- */
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
    document: doc, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch() { return Promise.resolve({ json: () => ({}) }); },
    alert() {}, confirm() { return true; }, prompt() { return ''; },
    location: { href: '', search: '', reload() {} }, navigator: { userAgent: 'node' },
    history: { pushState() {} }, requestAnimationFrame() {}, performance: { now() { return 0; } },
    Blob: function () {}, btoa: s => s, atob: s => s };
  c.window = c; c.globalThis = c; c.self = c;
  vm.createContext(c);
  BLOCKS.forEach(b => vm.runInContext(b, c));
  c.__st = JSON.parse(JSON.stringify(STATE));
  vm.runInContext('state = __st; state.screen = "dealers"; state.role = "COO";', c);
  /* render() drives the whole app's screen dispatch off state.screen -- none of
     that is what these checks are about, so it is neutered to a no-op the same
     way a unit test stubs out a paint call it does not care about. */
  vm.runInContext('render = function(){};', c);
  return c;
}
const run = (c, src) => vm.runInContext(src, c);

/* ================= 6. custCode('Dealer', ...) really uses the region/city passed in ================= */
{
  const c = app();
  const codeLahore = run(c, "custCode('Dealer','Al-Barkat Traders',2026,'','Punjab','Lahore')");
  const codeKarachi = run(c, "custCode('Dealer','Sadiq Agro',2026,'','Sindh','Karachi')");
  ok('a Lahore, Punjab dealer gets a Punjab/Lahore code', /^DLR-PB-LAH-\d{3}$/.test(codeLahore), codeLahore);
  ok('a Karachi, Sindh dealer gets a Sindh/Karachi code -- not the same region/city as the one above',
     /^DLR-SN-KAR-\d{3}$/.test(codeKarachi) && codeKarachi !== codeLahore, codeKarachi + ' vs ' + codeLahore);
  const codeNoCity = run(c, "custCode('Dealer','No City Yet',2026,'','Punjab','')");
  ok('with no city chosen yet, the city segment is the XXX placeholder, not silently wrong', /^DLR-PB-XXX-\d{3}$/.test(codeNoCity), codeNoCity);
}

/* ================= 7. custSave really persists id===code, and never touches state.dealers ================= */
{
  const c = app();
  run(c, "state.customers = state.customers || []; state.dealers = state.dealers || [];");
  const dealersBefore = run(c, 'state.dealers.length');
  run(c, `custForm = {editing:null, segment:'Dealer', name:'Green Valley Agro', region:'Sindh', city:'Hyderabad',
           contact:'', phone:'', creditDays:0, fed:'Exclusive', kam:'', introducedBy:'', destination:'', ntn:'',
           inducted:2026, status:'Active'};`);
  run(c, 'custSave()');
  const rec = run(c, "state.customers.find(function(x){return x.name==='Green Valley Agro';})");
  ok('the newly-saved customer exists', !!rec);
  ok('its id equals its own code (the merge-safety key)', !!rec && rec.id === rec.code, JSON.stringify(rec));
  ok('its code reflects the region/city that was actually picked', !!rec && /^DLR-SN-HYD-\d{3}$/.test(rec.code), rec && rec.code);
  const dealersAfter = run(c, 'state.dealers.length');
  eq('state.dealers was not touched by the save (retired as a write target)', dealersAfter, dealersBefore);
}

/* ================= 8. custToggleStatus flips status and is gated ================= */
{
  const c = app();
  run(c, "state.customers = [{id:'DLR-TEST-001', code:'DLR-TEST-001', name:'Test Dealer', segment:'Dealer', status:'Active'}];");
  run(c, "custToggleStatus('DLR-TEST-001')");
  eq('Active flips to Inactive', run(c, "state.customers[0].status"), 'Inactive');
  run(c, "custToggleStatus('DLR-TEST-001')");
  eq('and back to Active on a second toggle', run(c, "state.customers[0].status"), 'Active');

  /* now deny the right and confirm the toggle is refused, matching custSave's own gate */
  const c2 = app();
  run(c2, "state.customers = [{id:'DLR-TEST-002', code:'DLR-TEST-002', name:'Test Dealer 2', segment:'Dealer', status:'Active'}];");
  run(c2, "may = function(){ return false; };");
  run(c2, "var _toastMsg=''; toast = function(m){ _toastMsg = m; };");
  run(c2, "custToggleStatus('DLR-TEST-002')");
  eq('status is unchanged when the right is denied', run(c2, "state.customers[0].status"), 'Active');
  ok('and the refusal explains why', /held back until customer records carry ids/.test(run(c2, '_toastMsg')), run(c2, '_toastMsg'));
}

/* ================= 9. ensureRecordIds backfills ids on legacy records missing them ================= */
{
  const c = app();
  run(c, "var s = { customers: [{code:'WL-ABC-26-100', name:'Legacy Co', segment:'White-label'}], dealers: [{code:'DLR-OLD-001', name:'Old Dealer'}] };");
  run(c, 'ensureRecordIds(s)');
  eq('a pre-existing customer without an id gets one backfilled from its code', run(c, 's.customers[0].id'), 'WL-ABC-26-100');
  eq('a pre-existing dealer without an id gets one backfilled from its code', run(c, 's.dealers[0].id'), 'DLR-OLD-001');
}

console.log('\nCustomer Master fix: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
if (fail > 0) process.exit(1);
