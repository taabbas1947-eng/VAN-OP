/* PRODUCTION SCREEN — rendered, not just read.
   25 August 2026.

   Every other check on the Production authorisation conversion reads source. That
   is how a real crash got through: when the six shared `ed` flags were split into
   one flag per button, one reader of `ed` was left behind on the Follow QC button,
   and `ed` no longer existed. Opening the "Waiting QC" tab threw a ReferenceError
   out of render(), froze the screen on whatever was drawn before, and — because
   prodFilter is module state — kept throwing on every later render until the page
   was reloaded. No suite caught it: the 16-July snapshot happens to hold zero lots
   awaiting a COA, so the function returned two lines above the throwing one.

   This file loads the WHOLE app into a sandbox and actually calls the renderers,
   with data shaped so every filter tab has something in it.

   Run: node prodrender.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;
const BLOCKS = [...H.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
// 2026-09-04: a 6th inline block was added on purpose — a one-line BUILD_ID
// stamp placed first in <head> so the stale-tab checker can read it from just
// the first few KB of the page instead of the whole 1.5MB file.
ok('the app has its six script blocks', BLOCKS.filter(b => b.trim()).length === 6,
   BLOCKS.map(b => b.length).join(','));

/* ---- a sandbox with just enough browser for the renderers ---- */
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
  vm.runInContext('state = __st; state.screen = "prod";', c);
  return c;
}
const run = (c, src) => vm.runInContext(src, c);

/* ================= 1. every tab, every role, with data in every tab ================= */
const TABS = ['all', 'tomake', 'producing', 'qc', 'pack', 'recon', 'call',
              'toclose', 'attention', 'completed'];
{
  const c = app();
  /* Shape the data so no tab can early-return past a fault. The QC one is the
     case that actually bit: a lot logged, no COA approved yet. */
  run(c, `
    state.batches = state.batches || [];
    state.batches.push(
      { id:'T-QC', batchNo:'TQC1', base:'Test Base', kind:'bulk', status:'open',
        plannedKg:1000, producedKg:1000, packedKg:0, disposedKg:0, openedDate:'2026-08-01',
        lots:[{id:'L1',lotNo:'TQC1-L1',qty:1000,date:'2026-08-01',shift:'A',incharge:'x',
               coa:{status:'draft'}}] },
      { id:'T-RUN', batchNo:'TRUN1', base:'Test Base', kind:'bulk', status:'open',
        plannedKg:2000, producedKg:500, packedKg:0, disposedKg:0, openedDate:'2026-07-01',
        lots:[{id:'L2',lotNo:'TRUN1-L1',qty:500,date:'2026-07-01',shift:'A',incharge:'x',
               coa:{status:'approved',certifiedKg:500}}] },
      { id:'T-PACK', batchNo:'TPK1', base:'Test Base', kind:'bulk', status:'open',
        plannedKg:1000, producedKg:1000, packedKg:0, disposedKg:0, openedDate:'2026-08-05',
        lots:[{id:'L3',lotNo:'TPK1-L1',qty:1000,date:'2026-08-05',shift:'A',incharge:'x',
               coa:{status:'approved',certifiedKg:1000}}] },
      { id:'T-BP', batchNo:'TBP1', base:'Test Base', kind:'bulk', status:'open', pool:true,
        disposition:'byproduct', plannedKg:800, producedKg:0, packedKg:0, openedDate:'2026-08-02',
        sources:[{id:'T-RUN'}], lots:[] },
      { id:'T-DV', batchNo:'TDV1', base:'Test Base', kind:'bulk', status:'open', pool:true,
        disposition:'divert', plannedKg:600, producedKg:0, packedKg:0, openedDate:'2026-08-02',
        sources:[{id:'T-RUN'}], lots:[] },
      { id:'T-RW', batchNo:'TRW1', base:'Test Base', kind:'bulk', status:'open', pool:true,
        disposition:'rework', plannedKg:400, producedKg:0, packedKg:0, openedDate:'2026-08-02',
        sources:[{id:'T-RUN'}], lots:[] });
  `);
  const ROLES = (STATE.masters.roles || []).map(r => r.name);
  ok('there are roles to sweep', ROLES.length > 3, ROLES.join(','));

  let threw = [];
  ROLES.forEach(role => {
    run(c, 'state.role = ' + JSON.stringify(role) + ';');
    TABS.forEach(t => {
      run(c, 'prodFilter = ' + JSON.stringify(t) + ';');
      ['prodStageList', 'renderProdLifecycleBatch', 'prodPoolsStrip',
       'prodSettledStrip', 'prodHeader', 'screenProd', 'renderOpenBatch'].forEach(fn => {
        try { c[fn](); } catch (e) { threw.push(role + '/' + t + '/' + fn + ': ' + e.message); }
      });
    });
  });
  ok('no Production renderer throws for any role on any tab',
     threw.length === 0, threw.slice(0, 6).join(' || '));
  eq('...that is ' + (ROLES.length * TABS.length * 7) + ' renders', threw.length, 0);

  /* the specific tab that broke, with the specific data that broke it */
  run(c, 'state.role="COO"; prodFilter="qc";');
  let qcHtml = null, qcErr = null;
  try { qcHtml = c.prodStageList(); } catch (e) { qcErr = e.message; }
  ok('the Waiting QC tab renders at all', qcErr === null, qcErr || '');
  ok('...and it actually has the waiting lot in it (not an early return)',
     !!qcHtml && /TQC1/.test(qcHtml), (qcHtml || '').slice(0, 160));
}

/* ================= 2. no renderer reads an ed-flag it does not declare ================= */
/* The cheap, general form of the fault above. A flag renamed or removed leaves a
   reader behind, and a reader of an undeclared identifier throws.
   WHAT THIS DOES NOT CATCH, measured rather than assumed: it only knows the eleven
   flag names in KNOWN. An orphan read of a name outside that list is invisible
   here — it dies in section 1 instead, which renders for real and does not care
   what the identifier is called. Both sections are needed; neither is the whole
   answer, and a reviewer proved that by planting one of each. */
{
  const KNOWN = /^(ed|edAny|edLog|edOpen|edPack|edQty|edRecon|edClose|edBp|edDv|edRw)$/;
  ['prodStageList', '_pcLifeAction', 'renderProdLifecycleBatch', 'prodPoolsStrip',
   'screenProd', 'prodKanban', 'prodHeader', 'prodSettledStrip', 'renderOpenBatch'].forEach(fn => {
    let body = ''; try { body = H.grab(fn); } catch (e) { }
    ok(fn + ' was found', !!body, fn);
    if (!body) return;
    const decl = new Set();
    [...body.matchAll(/(?:var|const|let)\s+([^;]{0,400}?);/g)].forEach(m =>
      m[1].split(',').forEach(part => {
        const n = (part.trim().match(/^([A-Za-z_$][\w$]*)\s*=/) || [])[1];
        if (n) decl.add(n);
      }));
    const used = [...new Set([...body.matchAll(/(?<![\w$.'"])(ed[A-Za-z]*)(?![\w$])/g)]
                   .map(m => m[1]))].filter(u => KNOWN.test(u));
    const orphan = used.filter(u => !decl.has(u));
    ok(fn + ' declares every edit flag it reads', orphan.length === 0,
       'reads without declaring: ' + orphan.join(', '));
  });
}

/* ================= 2b. the harness itself ================= */
/* grab() is the foundation every source check stands on, and it was quietly
   broken for one function: matchBlock's brace counter does not understand regex
   literals or nested template literals, so on renderOpenBatch — which contains
   .replace(/"/g, ...) — it ran past the end and returned 728 KB of app instead of
   a 39-line function. Every assertion written against that body passed against
   the whole file and could never fail. grab() now detects the overrun and slices
   to the next top-level declaration instead. */
{
  const SANE = { renderOpenBatch: 400, prodStageList: 400, screenProd: 400,
                 renderProdLifecycleBatch: 400, _pcLifeAction: 60, prodPoolsStrip: 80,
                 applyCorrect: 200, openBatch: 120, archiveRole: 60, setDeptLead: 60,
                 authCard: 400 };
  Object.keys(SANE).forEach(fn => {
    let body = ''; try { body = H.grab(fn); } catch (e) { }
    ok('grab(' + fn + ') returns something', !!body, fn);
    if (!body) return;
    const lines = body.split('\n').length;
    ok('grab(' + fn + ') is a function, not a slab of the app: ' + lines + ' lines',
       lines <= SANE[fn], lines + ' lines, ' + body.length + ' bytes');
    /* the real tell: a second top-level function inside the body */
    const extra = (body.slice(1).match(/\n(?:function\s+\w+\s*\()/g) || []).length;
    eq('grab(' + fn + ') contains no second top-level function', extra, 0);
    ok('grab(' + fn + ') starts at the function it was asked for',
       body.indexOf('function ' + fn) === 0, body.slice(0, 60));
    /* TRUNCATION, the other direction. The overrun fallback cuts at the next
       top-level function OR var/let/const at column 0. A function whose OWN body
       has such a line — renderProdLifecycleBatch has `var _stp={...}` at column 0
       — would be cut there and lose everything after it, and a short body passes
       every check above while making "does it NOT contain X?" pass wrongly.
       Not triggerable today; this makes it loud the day it is. */
    ok('grab(' + fn + ') ends at a closing brace, not mid-statement',
       body.trim().slice(-1) === '}', JSON.stringify(body.trim().slice(-60)));
    const cut = body.slice(1).search(/\n(?:const|let|var)\s+\w+\s*=/);
    ok('grab(' + fn + ') has no column-0 declaration the fallback could cut at',
       cut < 0, cut < 0 ? '' : 'would cut at ' + cut + ' of ' + body.length
                              + ': ' + JSON.stringify(body.slice(cut, cut + 60)));
  });
}

/* ================= 3. the head/floor split, on prodStageList ================= */
/* Section 36 of authmodel.test.js does this for the batch action row. This does it
   for the list — the six flags there had no behavioural test at all, which is
   exactly the gap the crash fell through. */
{
  const c = app();
  run(c, `
    state.masters.roles.push(
      {id:'floor-officer',name:'Floor Officer',deptId:'production',builtin:false,archived:false},
      {id:'prod-mgr',name:'Production Manager',deptId:'production',builtin:false,archived:false});
    seedDeptRightsV1(state);
    state.batches = state.batches || [];
    state.batches.push(
      { id:'S-RUN', batchNo:'SRUN', base:'Split Base', kind:'bulk', status:'open',
        plannedKg:2000, producedKg:500, packedKg:0, disposedKg:0, openedDate:'2026-08-01', lots:[] },
      { id:'S-PACK', batchNo:'SPK', base:'Split Base', kind:'bulk', status:'open',
        plannedKg:1000, producedKg:1000, packedKg:0, disposedKg:0, openedDate:'2026-08-05',
        lots:[{id:'SL1',lotNo:'SPK-L1',qty:1000,date:'2026-08-05',shift:'A',incharge:'x',
               coa:{status:'approved',certifiedKg:1000}}] },
      /* closed, 400 of 1000 certified and packed — remainder 600, nothing packable:
         batchStage() calls that 'recon', which is the tab the Reconcile button is on */
      { id:'S-REC', batchNo:'SRC', base:'Split Base', kind:'bulk', status:'closed',
        plannedKg:1000, producedKg:1000, packedKg:400, disposedKg:0, openedDate:'2026-07-20',
        closedDate:'2026-08-06', actualYield:1000,
        lots:[{id:'SL2',lotNo:'SRC-L1',qty:400,date:'2026-07-21',shift:'A',incharge:'x',
               coa:{status:'approved',certifiedKg:400}},
              {id:'SL3',lotNo:'SRC-L2',qty:600,date:'2026-07-22',shift:'B',incharge:'x',
               coa:{status:'draft'}}] });
    __codes = RIGHTS.filter(function(r){return r.dept==='production';}).map(function(r){return r.code;});
    __codes.forEach(function(code){
      RIGHTS_LIVE[code] = true;
      state.masters.roleRights['floor-officer'][code] = (code==='shift.log');
      state.masters.roleRights['prod-mgr'][code] = (code==='batch.close'||code==='packing.reconcile');
    });
  `);
  const draw = (role, tab) => { run(c, 'state.role=' + JSON.stringify(role)
                                     + '; prodFilter=' + JSON.stringify(tab) + ';');
    try { return c.prodStageList() || ''; } catch (e) { return 'THREW:' + e.message; } };

  const fProducing = draw('Floor Officer', 'producing');
  ok('floor officer: the running list renders', !/^THREW/.test(fProducing), fProducing.slice(0, 120));
  ok('floor officer sees Log output', />Log output</.test(fProducing), fProducing.slice(0, 200));
  const fPack = draw('Floor Officer', 'pack');
  ok('floor officer: the pack list renders', !/^THREW/.test(fPack), fPack.slice(0, 120));
  ok('...and he is offered no Pack button', !/>Pack</.test(fPack), 'Pack offered to a role without packing.pack');
  const fRecon = draw('Floor Officer', 'recon');
  ok('...and no Reconcile button', !/>Reconcile</.test(fRecon), 'Reconcile offered without packing.reconcile');
  const fClose = draw('Floor Officer', 'toclose');
  ok('...and no Close batch button', !/>Close batch</.test(fClose), 'Close offered without batch.close');

  const mProducing = draw('Production Manager', 'producing');
  ok('the head is offered no Log output', !/>Log output</.test(mProducing),
     'Log output offered to a role without shift.log');
  const mRecon = draw('Production Manager', 'recon');
  ok('...and IS offered Reconcile', />Reconcile</.test(mRecon), mRecon.slice(0, 200));
  const mPack = draw('Production Manager', 'pack');
  ok('...and no Pack button', !/>Pack</.test(mPack), 'Pack offered without packing.pack');

  /* freeze it again and the single Production role must still see everything */
  run(c, '__codes.forEach(function(code){ delete RIGHTS_LIVE[code]; });');
  const pProducing = draw('Production', 'producing');
  ok('frozen, Production still sees Log output', />Log output</.test(pProducing), pProducing.slice(0, 200));
  ok('frozen, Production still sees Reconcile', />Reconcile</.test(draw('Production', 'recon')));
  ok('a role outside Production is offered no button on the running list',
     !/>Log output</.test(draw('KAM', 'producing')));
}

console.log('\nProduction screen — rendered: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
