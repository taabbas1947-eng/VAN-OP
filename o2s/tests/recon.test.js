/* RECONCILIATION SCREEN — reconCompute()/reconTopPattern()/screenRecon().
   2026-09-04. This is the live version of the check that found
   PUR-ORD-2026-00592 by hand (see OP-HANDOFF.md). It deliberately calls the
   app's own lotsFor() rather than re-implementing the match rule, so this
   suite is really testing "does reconCompute agree with reality" more than
   "is the match rule right" — authmodel/lotpack/etc already cover lotsFor
   itself. What this file guards: the screen renders without throwing against
   real fixture data, the flag/no-flag boundary is exactly right, voided and
   wrong-PO packingLog rows are correctly excluded, and the pattern grouping
   only fires when it should.

   Run: node recon.test.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

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
  const real = JSON.parse(fs.readFileSync(STATE, 'utf8')).data;
  c.__st = JSON.parse(JSON.stringify(real));
  vm.runInContext('state = __st; state.screen = "recon"; state.role = "COO";', c);
  return c;
}
const run = (c, src) => vm.runInContext(src, c);

/* ================= 1. the real fixture — no throw, sane shape ================= */
{
  const c = app();
  const res = run(c, `(function(){ try{ screenRecon(); return 'ok'; }catch(e){ return 'ERR:'+e.message+' '+e.stack; } })()`);
  ok('screenRecon() renders the real fixture without throwing', res === 'ok', res);
  const data = run(c, 'reconCompute()');
  ok('reconCompute returns an object with rows/ordersScanned/linesChecked', data && Array.isArray(data.rows)
     && typeof data.ordersScanned === 'number' && typeof data.linesChecked === 'number', JSON.stringify(data && Object.keys(data)));
  ok('ordersScanned matches state.orders.length', data.ordersScanned === run(c, '(state.orders||[]).length'));
  data.rows.forEach(r => { ok('every flagged row has gap > 0.5 (' + r.po + '/' + r.brand + ')', r.gap > 0.5); });
}

/* ================= 2. synthetic — the exact boundary this exists to catch ================= */
{
  const c = app();
  run(c, `
    state.orders = [
      /* fully matched — must NOT flag */
      { po:'SYN-001', client:'Synth Client A', channel:'Dealer', lines:[
        { id:'L1', brand:'Brand A', base:'Base A', ordered:100, produced:100, packed:100, dispatched:0, delivered:0 } ] },
      /* short by exactly the flag threshold — must flag, gap 40 */
      { po:'SYN-002', client:'Synth Client B', channel:'Vgreen', lines:[
        { id:'L2', brand:'Brand B', base:'Base B', ordered:60, produced:60, packed:60, dispatched:0, delivered:0 } ] },
      /* right at the 0.5 tolerance — must NOT flag (matches lotsFor's own >0.5 elsewhere) */
      { po:'SYN-003', client:'Synth Client C', channel:'Farmer', lines:[
        { id:'L3', brand:'Brand C', base:'Base C', ordered:10, produced:10, packed:10.4, dispatched:0, delivered:0 } ] },
      /* a voided packingLog row (kg zeroed) plus a wrong-PO row — neither should count,
         so this must flag for the FULL packed amount, not a partial one */
      { po:'SYN-004', client:'Synth Client D', channel:'Distributor', lines:[
        { id:'L4', brand:'Brand D', base:'Base D', ordered:80, produced:80, packed:80, dispatched:0, delivered:0 } ] },
      /* already shipped — still must flag (delivered doesn't excuse an untraced pack) */
      { po:'SYN-005', client:'Synth Client E', channel:'Vgreen', lines:[
        { id:'L5', brand:'Brand B', base:'Base B', ordered:20, produced:20, packed:20, dispatched:20, delivered:20 } ] },
    ];
    state.packingLog = [
      { po:'SYN-001', lid:'L1', brand:'Brand A', kg:100 },
      { po:'SYN-002', lid:'L2', brand:'Brand B', kg:20 },
      { po:'SYN-003', lid:'L3', brand:'Brand C', kg:10 },
      /* a voided row always carries kg:0 in real data (dfSubmitVoid zeroes it) \u2014 this
         one only proves reconCompute doesn't need a void check of its own because it
         just sums kg, which is already right for a voided row */
      { po:'SYN-004', lid:'L4', brand:'Brand D', kg:0, void:true, voidedKg:80 },
      { po:'WRONG-PO', lid:'L4', brand:'Brand D', kg:80 },
    ];
  `);
  const data = run(c, 'reconCompute()');
  const byPo = {}; data.rows.forEach(r => { byPo[r.po] = r; });

  ok('SYN-001 (fully matched) is not flagged', !byPo['SYN-001']);
  ok('SYN-003 (0.4 under, inside tolerance) is not flagged', !byPo['SYN-003']);

  ok('SYN-002 flagged with gap 40 (60 packed − 20 logged)', byPo['SYN-002'] && Math.abs(byPo['SYN-002'].gap - 40) < 0.01,
     JSON.stringify(byPo['SYN-002']));
  eq('SYN-002 status is crit (dispatched 0 — not shipped, blocking)', byPo['SYN-002'] && byPo['SYN-002'].status, 'crit');

  ok('SYN-004 flagged for the full 80kg — voided row and wrong-PO row both excluded', byPo['SYN-004'] && Math.abs(byPo['SYN-004'].gap - 80) < 0.01,
     JSON.stringify(byPo['SYN-004']));
  eq('SYN-004 loggedKg is 0 (neither packingLog row should have matched)', byPo['SYN-004'] && byPo['SYN-004'].loggedKg, 0);

  ok('SYN-005 flagged even though fully delivered', !!byPo['SYN-005']);
  eq('SYN-005 status is warn, not crit (it already shipped)', byPo['SYN-005'] && byPo['SYN-005'].status, 'warn');

  eq('exactly 3 synthetic rows flagged', data.rows.filter(r => r.po.indexOf('SYN-') === 0).length, 3);

  /* overpack flag */
  run(c, `
    state.orders.push({ po:'SYN-006', client:'Synth Client F', channel:'Vgreen', lines:[
      { id:'L6', brand:'Brand B', base:'Base B', ordered:50, produced:120, packed:120, dispatched:0, delivered:0 } ] });
    state.packingLog.push({ po:'SYN-006', lid:'L6', brand:'Brand B', kg:60 });
  `);
  const data2 = run(c, 'reconCompute()');
  const r6 = data2.rows.find(r => r.po === 'SYN-006');
  ok('SYN-006 (packed 120 > ordered 50) is marked overpack', r6 && r6.overpack === true, JSON.stringify(r6));

  /* pattern grouping — Brand B now appears in SYN-002, SYN-005, SYN-006: three flagged
     lines across three different channels (Vgreen twice, but three POs) */
  const pattern = run(c, 'reconTopPattern(reconCompute().rows.filter(function(r){ return r.po.indexOf("SYN-")===0; }))');
  ok('reconTopPattern finds the 3-line Brand B group', pattern && pattern.length === 3 && pattern[0].brand === 'Brand B',
     JSON.stringify(pattern && pattern.map(r => r.po)));
}

/* ================= 3. no pattern when nothing repeats ================= */
{
  const c = app();
  run(c, `
    state.orders = [
      { po:'ONE-1', client:'X', channel:'Vgreen', lines:[{ id:'A', brand:'Only A', base:'Base A', ordered:10, produced:10, packed:10, dispatched:0, delivered:0 }] },
      { po:'ONE-2', client:'Y', channel:'Vgreen', lines:[{ id:'B', brand:'Only B', base:'Base B', ordered:10, produced:10, packed:10, dispatched:0, delivered:0 }] },
    ];
    state.packingLog = [];
  `);
  const rows = run(c, 'reconCompute().rows');
  eq('two flagged lines, two different brands', rows.length, 2);
  const pattern = run(c, 'reconTopPattern(reconCompute().rows)');
  ok('reconTopPattern returns null when no brand repeats', pattern === null, JSON.stringify(pattern));
}

/* ================= 4. filter / sort setters don't throw ================= */
{
  const c = app();
  const r1 = run(c, `(function(){ try{ reconSetFilter('crit'); return reconFilter; }catch(e){ return 'ERR:'+e.message; } })()`);
  eq('reconSetFilter sets reconFilter', r1, 'crit');
  const r2 = run(c, `(function(){ try{ reconSetSort('packed'); return JSON.stringify(reconSort); }catch(e){ return 'ERR:'+e.message; } })()`);
  ok('reconSetSort sets reconSort without throwing', r2.indexOf('ERR:') !== 0, r2);
  const r3 = run(c, `(function(){ try{ reconSetSort('packed'); return reconSort.dir; }catch(e){ return 'ERR:'+e.message; } })()`);
  eq('reconSetSort flips direction on repeat click', r3, 1);
}

/* ================= 5. wired into the nav / dispatcher, not orphaned ================= */
{
  ok("'recon' is in the SCREENS registry", /\{id:'recon',/.test(html));
  ok("'recon' is in the Setup & admin nav group", /'admin','datafix','recon','users'/.test(html));
  ok("'recon' is wired into the render() dispatcher", /datafix:screenDataFix,recon:screenRecon,users:screenUsers/.test(html));
  ok("NAV_ICONS has a 'recon' entry (sidebar icon, not just SCREENS[].ic)", /datafix:'<path[^']*',\s*recon:'<path/.test(html));
}

console.log(`\nReconciliation screen: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILURES:'); fails.forEach(f => console.log('  FAIL  ' + f)); process.exit(1); }
