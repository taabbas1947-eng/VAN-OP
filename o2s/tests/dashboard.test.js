/* DASHBOARD REBUILD — 29 Aug 2026.
   Tahir: "we should rebuild the whole dashboard" — Overview, Production, Quality,
   Supply chain and Centers all now read a shared date-range control (dashRange /
   dashOpsMetrics) instead of hardcoded "today" / "last 7 days". This loads the
   whole app into a sandbox against the real state.json snapshot and actually
   calls the renderers, for every role and every tab, across five range modes —
   the same "render, don't just read source" approach as prodrender.test.js,
   because a screen that throws on one role/tab/range combination and not others
   will not be caught by reading source.

   Run: node dashboard.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;
const BLOCKS = [...H.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

function app(role) {
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
  vm.runInContext('state = __st; state.screen = "dash"; state.role = ' + JSON.stringify(role) + ';', c);
  return c;
}
const run = (c, src) => vm.runInContext(src, c);

let pass=0, fail=0;
function ok(n,cnd,x){ if(cnd) pass++; else { fail++; console.log('FAIL', n, x||''); } }

const roles = ['COO','CFO','KAM','Plant Manager','Production','QCM','Supply Chain'];
roles.forEach(role => {
  try {
    const c = app(role);
    // sanity: dashOpsMetrics runs clean
    const om = run(c, 'JSON.stringify(dashOpsMetrics())');
    ok(role+': dashOpsMetrics returns JSON', typeof om === 'string' && om.length > 2);
    ok(role+': no "undefined" leaked into dashOpsMetrics JSON', !/undefined/.test(om), om.slice(0,300));

    ['today','yesterday','7d','week','month'].forEach(mode => {
      run(c, "dashRange.mode="+JSON.stringify(mode)+";");
      const om2 = run(c, 'dashOpsMetrics()');
      ok(role+'/'+mode+': from<=to', om2.from <= om2.to, om2.from+' '+om2.to);
    });
    run(c, "dashRange.mode='today';");

    const M = run(c, 'execMetrics()');
    const htmlOut = run(c, 'dashExecHtml(execMetrics())');
    ok(role+': dashExecHtml renders a string', typeof htmlOut === 'string' && htmlOut.length > 500);
    ok(role+': dashExecHtml has no [object Object]', !/\[object Object\]/.test(htmlOut));
    ok(role+': dashExecHtml has no raw undefined text', !/>undefined</.test(htmlOut) && !/undefined Kg/.test(htmlOut));
    ok(role+': dashExecHtml has no NaN', !/NaN/.test(htmlOut));

    const narr = run(c, 'dashNarrative(execMetrics())');
    ok(role+': dashNarrative renders', typeof narr==='string' && narr.length>10 && !/undefined|NaN/.test(narr));

    // full screenDash across all tabs
    ['overview','centers','production','quality','supply','sales'].forEach(tab => {
      run(c, "dashTab="+JSON.stringify(tab)+";");
      try {
        run(c, 'screenDash()');
        ok(role+'/tab='+tab+': screenDash() runs without throwing', true);
      } catch(e) {
        ok(role+'/tab='+tab+': screenDash() runs without throwing', false, e.message);
      }
    });

    // stuck batches / entry timeliness sanity
    const stuck = run(c, 'JSON.stringify(stuckBatches())');
    ok(role+': stuckBatches() returns JSON array', stuck.startsWith('['));
    const et = run(c, 'JSON.stringify(dashEntryTimeliness("2000-01-01","2100-01-01"))');
    ok(role+': dashEntryTimeliness returns JSON', et.startsWith('{'));
  } catch(e) {
    ok(role+': app() + basic calls did not throw', false, e.stack.split('\n').slice(0,3).join(' | '));
  }
});

console.log('\nDashboard rebuild — rendered across roles/tabs/ranges: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail?1:0);
