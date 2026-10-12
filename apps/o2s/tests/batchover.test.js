/* A batch may run 15% over its plan, and the way to log it is back.
   Tahir, 12 Oct 2026: batch NP26009 made its plan and the screen offered only Close batch.
   Rule: ceiling = 115% of plan, upper side only; closing short is unchanged. */
const vm = require('vm');
const H = require('./harness.js');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));

const SRC = ['batchOverPct','batchCeilingKg','batchLogRoom','batchReopenHeadroom','_logMoreRoom','_logMoreNote','_logMoreBtn','_at','renderCloseBatch','submitShiftLog']
  .map(n => H.grab(n)).join('\n');

function make(opts) {
  opts = opts || {};
  let out = ''; const toasts = [];
  const modal = { className: '', set innerHTML(v) { out = v; }, get innerHTML() { return out; } };
  const s = { console, Date, Math, JSON, Object, Array, String,
    fmt: n => Math.round(n).toLocaleString('en-US'), _pe: v => String(v), _tx: v => String(v == null ? '' : v),
    $: () => modal, closeModal() {}, toast: m => toasts.push(m), denyRight: () => 'denied',
    may: c => opts.may === undefined ? true : !!opts.may[c], nid: () => 'X', save() {}, render() {}, logAction() {},
    evStamp: () => ({}), _uid: () => 'U', batchPOsLabel: () => '', TODAY: new Date('2026-10-12'),
    coaItemOf: () => null, prodSkin: v => v, prodTiles: () => '', openShiftLog() {} };
  s.state = { role: 'Plant Manager', batches: [], orders: [], shiftEntries: [], productionLog: [], masters: { varianceReasons: ['Wastage'] } };
  s.shiftForm = { batchId: 'B1', shift: 'A', incharge: 'Ali', qty: 0, reason: '' };
  s.closeForm = { bid: 'B1', reason: '', note: '' };
  s.globalThis = s; vm.createContext(s);
  vm.runInContext(SRC, s);
  s._out = () => out; s._toasts = toasts;
  return s;
}
const B = (o) => Object.assign({ id: 'B1', batchNo: 'NP26009', status: 'open', kind: 'bulk', base: 'NP', plannedKg: 28000, producedKg: 28000, packedKg: 0, lots: [] }, o || {});
function log(s, b, q) { s.state.batches = [b]; s.shiftForm.qty = q; const n = s.state.shiftEntries.length; s._toasts.length = 0; s.submitShiftLog(); return s.state.shiftEntries.length > n; }

{ const s = make();
  eq('the over-plan allowance is 15', s.batchOverPct(), 15);
  eq('ceiling of 28,000 is 32,200', Math.round(s.batchCeilingKg(28000)), 32200);
  eq('ceiling of nothing is 0', s.batchCeilingKg(0), 0);
  eq('room at plan is 4,200', Math.round(s.batchLogRoom(B())), 4200);
  eq('room at 32,200 is 0', s.batchLogRoom(B({ producedKg: 32200 })), 0);
  eq('room past ceiling is 0', s.batchLogRoom(B({ producedKg: 33000 })), 0);
  eq('closed batch has no room', s.batchLogRoom(B({ status: 'closed' })), 0);
  eq('pool batch has no room', s.batchLogRoom(B({ pool: true })), 0);
  eq('no plan, no room', s.batchLogRoom(B({ plannedKg: 0 })), 0);
  eq('short batch has more room', Math.round(s.batchLogRoom(B({ producedKg: 10000 }))), 22200);
}
/* entry check */
{ const s = make();
  ok('a batch at plan accepts 1,000 more', log(s, B(), 1000), s._toasts.join());
  ok('exactly up to 32,200 is allowed', log(make(), B({ producedKg: 28000 }), 4200));
  const s2 = make();
  ok('1 Kg past 32,200 is refused', !log(s2, B({ producedKg: 28000 }), 4201));
  ok('...and the refusal names 115%', /115%/.test(s2._toasts.join()), s2._toasts.join());
  ok('...and what is left', /4,200/.test(s2._toasts.join()), s2._toasts.join());
  const s3 = make();
  ok('a closed batch refuses', !log(s3, B({ status: 'closed' }), 10));
  /* PO line cap still holds */
  const s4 = make();
  s4.state.orders = [{ po: 'P1', lines: [{ id: 'L1', brand: 'X', base: 'NP', ordered: 28000, produced: 28000 }] }];
  ok('PO line cap still refuses beyond the PO', !log(s4, B({ kind: 'po', po: 'P1', lineId: 'L1' }), 500), s4._toasts.join());
  ok('...with the PO message', /PO over-run/.test(s4._toasts.join()), s4._toasts.join());
  eq('room on a PO batch is limited by the PO', s4.batchLogRoom(B({ kind: 'po', po: 'P1', lineId: 'L1' })), 0);
}
/* close sheet */
{ const s = make(); s.state.batches = [B()]; s.renderCloseBatch();
  ok('close sheet shows the note', /still log up to <b>4,200 Kg\/L<\/b>/.test(s._out()), s._out().slice(0, 300));
  ok('...and a Log more output button', /Log more output \(up to 4,200\)/.test(s._out()));
  ok('...that opens the shift log on this batch', /openShiftLog\('B1'\)/.test(s._out()));
  const s2 = make(); s2.state.batches = [B({ producedKg: 32200 })]; s2.renderCloseBatch();
  ok('at the ceiling the sheet has no button', !/Log more output/.test(s2._out()));
  const s3 = make({ may: { 'shift.log': false, 'batch.close': true } }); s3.state.batches = [B()]; s3.renderCloseBatch();
  ok('without the right to log, no button', !/Log more output/.test(s3._out()));
}
/* Guide and changelog */
{ const html = H.html;
  ok('Guide has the rule', /How much a batch may make/.test(html));
  ok('Guide row for a batch at plan', /A batch at its plan shows only Close batch/.test(html));
  ok('changelog entry present', /A batch may run 15% over its plan/.test(html));
  ok('no 5% cap left in the entry check', !/plan\*1\.05/.test(H.grab('submitShiftLog')) && !/plan\*1\.05/.test(H.grab('batchReopenHeadroom')));
}
console.log('\nBatch over-plan tolerance: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
