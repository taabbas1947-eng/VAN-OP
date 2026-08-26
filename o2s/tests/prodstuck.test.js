/* PRODUCTION'S STUCK LIST — role safety on the 'attention' tab. 26 August 2026.

   Companion to authmodel.test.js's CLOSED_GAP (rm.check) and section 30
   (alsoOn derived from PROD_STUCK_CAT). Those prove the catalogue and the
   guard functions are correct. This proves the THIRD thing: that the render
   people actually look at — prodStageList('attention') — no longer draws a
   live button for an item outside the viewer's own department, for any role,
   and that Production's own stalled items still get one.

   Before this session: grpS drew every stuck/deferred item through acRowHTML,
   which embeds `it.act` in an onclick with no regard for who is looking or
   which category the item is in. rowS existed, already did the right thing
   (a button only for _cat==='produce'), and was never called — flagged in the
   25->26 Aug conversion as "wants a decision of its own". This is that
   decision, rendered for real rather than read from source.

   Run: node prodstuck.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }

const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;
const BLOCKS = [...H.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

/* Same minimal DOM/browser stub prodrender.test.js uses — these renderers touch
   $()/document but never read anything back out of it for the strings we check. */
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
  vm.runInContext('state = __st; state.screen = "prod"; state.orders = []; state.batches = state.batches || [];', c);
  return c;
}
const run = (c, src) => vm.runInContext(src, c);
const iso = d => d.toISOString().slice(0, 10);
const daysAgo = n => iso(new Date(Date.now() - n * 86400000));

function fixtures(c) {
  run(c, `
    state.orders.push({
      id:'STK-RM', po:'PO-STK-RM', client:'Stuck Client', acknowledged:true,
      received:${JSON.stringify(daysAgo(10))}, priority:'Normal',
      lines:[{ id:'L-RM', brand:'Stalled RM Brand', ordered:1000, produced:0, rmStatus:null }]
    });
    state.orders.push({
      id:'STK-PROD', po:'PO-STK-PROD', client:'Stuck Client 2', acknowledged:true,
      received:${JSON.stringify(daysAgo(10))}, priority:'Normal',
      lines:[{ id:'L-PROD', brand:'Stalled Prod Brand', ordered:1000, produced:0,
                rmStatus:'full', rmReady:${JSON.stringify(daysAgo(6))} }]
    });
  `);
}

/* ================= 1. the fixtures really land in the categories meant ================= */
{
  const c = app();
  fixtures(c);
  run(c, 'state.role="COO";');
  const stuck = run(c, 'prodStuckItems()');
  const byCat = { produce: 0, rm: 0, qc: 0 };
  stuck.forEach(it => byCat[it._cat]++);
  ok('the RM Check item is stuck, category rm', byCat.rm >= 1, JSON.stringify(byCat));
  ok('the Open Production item is stuck, category produce', byCat.produce >= 1, JSON.stringify(byCat));
  ok('exactly these two, nothing else invented by the fixture', stuck.length === 2, JSON.stringify(stuck.map(x => [x.label, x._cat])));
}

/* ================= 2. nobody outside Production gets a live button for 'rm' ================= */
{
  ['QA Inspector', 'KAM', 'Sales', 'Lab Rep', 'Finance', 'Supply Chain', 'CFO', 'Production', 'COO']
    .forEach(role => {
      const c = app();
      fixtures(c);
      run(c, 'state.role=' + JSON.stringify(role) + '; prodFilter="attention";');
      let html = null, err = null;
      try { html = c.prodStageList(); } catch (e) { err = e.message; }
      ok(role + ': the attention tab renders at all', err === null, err || '');
      if (html == null) return;
      ok(role + ': RM Check is not clickable from Production', !/openRMCheck\(/.test(html), html.slice(0, 4000));
      ok(role + ': shows who actually owns it instead', /owner: Supply Chain/.test(html), html.slice(0, 4000));
    });
}

/* ================= 3. Production's OWN stalled item still gets a live button ================= */
{
  const c = app();
  fixtures(c);
  run(c, 'state.role="Production"; prodFilter="attention";');
  const html = c.prodStageList();
  ok('Production sees a Resolve button for its own stalled item', />Resolve</.test(html), html.slice(0, 4000));
  ok('...wired to the real navigation, not a stub', /gotoProduce\('STK-PROD'\)/.test(html), html.slice(0, 4000));
  ok('...and a Defer button beside it', />Defer</.test(html), html.slice(0, 4000));
  ok('and still no button for the rm-category item next to it', !/openRMCheck\(/.test(html));
}
{
  /* COO holds edAny too (COO shortcut in mayRole); pin that COO still cannot
     Resolve someone else's category from here — only sees the owner text —
     while COO CAN Resolve the produce item, same as Production can. */
  const c = app();
  fixtures(c);
  run(c, 'state.role="COO"; prodFilter="attention";');
  const html = c.prodStageList();
  ok('COO also gets owner text for the rm item, not a live RM Check button', !/openRMCheck\(/.test(html));
  ok('COO DOES get to Resolve the produce item (edAny is true for COO)', />Resolve</.test(html), html.slice(0, 4000));
}

/* ================= 4. deferred items render read-only, whoever is looking ================= */
{
  const c = app();
  fixtures(c);
  run(c, 'state.role="COO";');
  const stuck = run(c, 'prodStuckItems()');
  const rmItem = stuck.filter(it => it._cat === 'rm')[0];
  ok('found the rm item to defer', !!rmItem);
  if (rmItem) {
    const key = c.acKey(rmItem);
    run(c, `state.acDefer = state.acDefer || {}; state.acDefer[${JSON.stringify(key)}] =
             { until: ${JSON.stringify(daysAgo(-3))}, reason: 'Awaiting approval', by: 'tahir', at: ${JSON.stringify(daysAgo(0))} };`);
    ['Supply Chain', 'QA Inspector', 'COO'].forEach(role => {
      run(c, 'state.role=' + JSON.stringify(role) + '; prodFilter="attention";');
      let html = null, err = null;
      try { html = c.prodStageList(); } catch (e) { err = e.message; }
      ok(role + ': attention tab renders with a deferred item present', err === null, err || '');
      if (html == null) return;
      ok(role + ': the deferred RM Check item is not clickable either', !/openRMCheck\(/.test(html));
      ok(role + ': it reads as deferred, not as an open stall', /deferred to/.test(html), html.slice(0, 4000));
    });
  }
}

console.log('\nProduction stuck list — role safety: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
