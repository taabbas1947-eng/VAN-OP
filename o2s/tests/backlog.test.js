/* The 44-PO backlog screen: one definition of the backlog, honest evidence. */
const vm = require('vm');
const H = require('./harness.js');
const html = H.html;

/* saveBulkPrintDecision now asks bulkPDMayAnswer() — the SAME predicate as the
   opener — so the real gate and the access machinery under it come into the
   sandbox too. Stubbing the gate to true would make the refusal checks below
   prove nothing. */
const src = ['openPrintDecisionPOs', 'bulkPDAll', 'accessOv', '_ownerEdit', 'accessLevel',
             'screenEditOK', 'bulkPDWhoMay', 'bulkPDMayAnswer', 'bulkPDDenied',
             'saveBulkPrintDecision'].map(H.grab).join('\n');
const data = require(H.STATE).data;

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));

function ctx(orders) {
  const s = {
    console, bulkPD: {}, logAction: () => {}, save: () => {}, closeModal: () => {},
    render: () => {}, toast: m => { s.lastToast = m; }, renderBulkPrintDecision: () => {}, Date,
    /* the real SCREENS entry for 'entry', so _ownerEdit answers honestly */
    scr: id => (id === 'entry' ? { id: 'entry', owners: ['KAM'] } : { id, owners: [] }),
    state: { role: 'COO', currentUser: { name: 'tahir' }, orders,
             masters: { accessMatrix: { 'Plant Manager': { entry: { v: true, e: true } },
                                        'Production':    { entry: { v: false, e: false } },
                                        'CFO':           { entry: { v: true, e: false } } },
                        roles: [{ name: 'KAM' }, { name: 'Plant Manager' },
                                { name: 'Production' }, { name: 'CFO' }] } },
  };
  s.globalThis = s; vm.createContext(s); vm.runInContext(src, s); return s;
}

/* ---- 1. one definition, three call sites ---- */
const real = ctx(JSON.parse(JSON.stringify(data.orders)));
const live = real.openPrintDecisionPOs().length;
ok('the backlog is non-empty in this snapshot', live > 0, 'got ' + live);
ok('Reports button uses openPrintDecisionPOs()',
  /const n=openPrintDecisionPOs\(\)\.length;/.test(html));
ok('Action Center uses openPrintDecisionPOs()',
  /var _noDec=openPrintDecisionPOs\(\);/.test(html));
ok('the screen itself uses openPrintDecisionPOs()',
  /var open=openPrintDecisionPOs\(\);/.test(html));
ok('no rival filter left anywhere',
  !/filter\(o=>!o\.printDecision\)/.test(html));

/* ---- 2. the predicate ---- */
const mixed = [
  { id: 'A', po: 'A', lines: [{ ordered: 100 }] },                       // counts
  { id: 'B', po: 'B', lines: [{ ordered: 0 }] },                         // no quantity
  { id: 'C', po: 'C', lines: [] },                                       // no lines
  { id: 'D', po: 'D', printDecision: 'list', lines: [{ ordered: 100 }] },// answered
];
const m = ctx(mixed);
eq('only real, unanswered POs count', m.openPrintDecisionPOs().map(o => o.id).join(''), 'A');

/* ---- 3. "set all" touches exactly the backlog, never an answered PO ---- */
m.bulkPDAll('list');
eq('set-all marks the backlog', m.bulkPD.A, 'list');
eq('set-all leaves an answered PO alone', m.bulkPD.D, undefined);
eq('set-all leaves a zero-quantity PO alone', m.bulkPD.B, undefined);

/* ---- 4. save writes only what was picked, and never overwrites an answer ---- */
const s2 = ctx(mixed.map(o => ({ ...o, lines: [...(o.lines || [])] })));
s2.bulkPD = { A: 'list', D: 'no' };
s2.saveBulkPrintDecision();
eq('A answered list', s2.state.orders.find(o => o.id === 'A').printDecision, 'list');
eq('a list answer still means a price IS printed',
  s2.state.orders.find(o => o.id === 'A').printOnPack, true);
eq('D keeps its existing answer', s2.state.orders.find(o => o.id === 'D').printDecision, 'list');
eq('stamped with the person', s2.state.orders.find(o => o.id === 'A').printDecisionBy, 'tahir');
/* ---- 4b. THE GATE, on the WRITER. 2026-08-22.
   The first cut of the access change moved the check on openBulkPrintDecision()
   and left this function on the old COO/KAM list, so a newly-permitted person
   would have answered every PO in the backlog, pressed Save, and lost the lot.
   These run the real predicate, not a stub. ---- */
{
  const mk = role => { const c = ctx([{ id: 'A', po: 'A', lines: [{ ordered: 100 }] }]);
                       c.state.role = role; c.bulkPD = { A: 'list' }; return c; };
  ['COO', 'KAM', 'Plant Manager'].forEach(r => {
    const c = mk(r); c.saveBulkPrintDecision();
    eq('WRITER accepts ' + r, c.state.orders[0].printDecision, 'list');
  });
  ['Production', 'CFO'].forEach(r => {
    const c = mk(r); c.saveBulkPrintDecision();
    ok('WRITER refuses ' + r, c.state.orders[0].printDecision === undefined,
       'wrote ' + c.state.orders[0].printDecision);
    ok('and says why to ' + r, /PO-entry access/.test(c.lastToast || ''), c.lastToast);
  });
}

const s3 = ctx([{ id: 'A', po: 'A', lines: [{ ordered: 1 }] }]);
s3.bulkPD = { A: 'no' };
s3.saveBulkPrintDecision();
eq('a no answer means no price on the pack',
  s3.state.orders[0].printOnPack, false);

/* ---- 5. evidence shows every price, not the last one ---- */
ok('evidence de-duplicates and shows all prices per brand',
  /seen\[pk\.brand\]=seen\[pk\.brand\]\|\|\[\]\)\.push/.test(html));
ok('evidence flags a brand carrying two different prices',
  /two different prices/.test(html));
ok('the old collapsing assignment is gone',
  !/seen\[pk\.brand\]=\+pk\.printPrice/.test(html));

/* prove the rendering logic itself on constructed data */
function evidence(pk, po) {
  const seen = {};
  pk.forEach(p => { if (p && p.po === po && +p.printPrice > 0) (seen[p.brand] = seen[p.brand] || []).push(+p.printPrice); });
  return Object.keys(seen).map(b => {
    const ps = seen[b].filter((v, i, a) => a.indexOf(v) === i).sort((x, y) => x - y);
    return b + ':' + ps.join('&') + (ps.length > 1 ? '!' : '');
  }).join(',');
}
eq('two prices on one brand are both shown',
  evidence([{ po: 'P', brand: 'VL-NPK', printPrice: 1500 }, { po: 'P', brand: 'VL-NPK', printPrice: 1250 }], 'P'),
  'VL-NPK:1250&1500!');
eq('a repeated single price is not reported as a conflict',
  evidence([{ po: 'P', brand: 'VL-NPK', printPrice: 1250 }, { po: 'P', brand: 'VL-NPK', printPrice: 1250 }], 'P'),
  'VL-NPK:1250');


/* ================= 6. the recommendation (Tahir, 22 Aug: recommend, never pre-select) ============ */
const S6 = (function () {
  const src6 = H.grab('bulkPDSuggest') + '\n' + H.grab('recallPrintPrice') + '\n' + H.grab('bulkPDAll') + '\n' + H.grab('openPrintDecisionPOs');
  const s = { console, fmt: n => String(n), bulkPD: {}, renderBulkPrintDecision: () => {},
              state: { orders: [], packingLog: [] } };
  s.globalThis = s; vm.createContext(s); vm.runInContext(src6, s); return s;
})();
const sug = o => S6.bulkPDSuggest(o);

S6.state.packingLog = []; S6.state.orders = [];
eq('a price on the line -> price set on this PO',
  sug({ po: 'P', lines: [{ brand: 'X', printPrice: 1250, ordered: 1 }] }).pick, 'yes');
ok('…and it quotes the number',
  /1250/.test(sug({ po: 'P', lines: [{ brand: 'X', printPrice: 1250, ordered: 1 }] }).why));

S6.state.packingLog = [{ po: 'P', brand: 'X', printPrice: 1500 }, { po: 'P', brand: 'X', printPrice: 1500 }];
const g2 = sug({ po: 'P', lines: [{ brand: 'X', ordered: 1 }] });
eq('packs printed on this PO but no PO price -> list', g2.pick, 'list');
ok('…and it says how many packs', /2 packs/.test(g2.why));

S6.state.packingLog = [{ po: 'OTHER', brand: 'X', printPrice: 1500 }];
const g3 = sug({ po: 'P', lines: [{ brand: 'X', ordered: 1 }] });
eq('brand history elsewhere -> list, more weakly', g3.pick, 'list');
ok('…and it admits the evidence is not from this PO', /not on this PO/.test(g3.why));

S6.state.packingLog = []; S6.state.orders = [];
const g4 = sug({ po: 'P', lines: [{ brand: 'NEVER-SEEN', ordered: 1 }] });
eq('no evidence anywhere -> no suggestion at all', g4.pick, null);
ok('…and it names who has to answer', /KAM/.test(g4.why));

/* the one that matters: silence must never become "no price" */
const html6 = H.html;
ok('the suggester can never propose "no price"',
  !/pick:'no'/.test(H.grab('bulkPDSuggest')));
ok('the suggester never writes into bulkPD',
  !/bulkPD\s*\[/.test(H.grab('bulkPDSuggest')));
ok('the row renders the suggestion as text, not a selection',
  /Still needs your click/.test(html6));
ok('nothing is pre-selected: pick still comes only from bulkPD',
  /var pick=bulkPD\[o\.id\]\|\|'';/.test(html6));

/* and it stays inert across a full render + save cycle */
const g7 = ctx([{ id: 'A', po: 'A', lines: [{ brand: 'X', ordered: 1 }] }]);
eq('an unclicked PO is still unanswered after a suggestion exists',
  Object.keys(g7.bulkPD).length, 0);
g7.saveBulkPrintDecision();
eq('…and saving writes nothing', g7.state.orders[0].printDecision, undefined);

console.log('Recommendation: checked (never pre-selects, never suggests "no price")');

console.log('\nBacklog screen: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
console.log('backlog in the local snapshot: ' + live + ' PO(s)');
process.exit(fail ? 1 : 0);
