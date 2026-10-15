/* Stuck batches, rebuilt 12 Oct 2026 (Tahir): last move counts packing, a base held for
   orders is not stuck, and every row says what / why / when / who.
   15f (Tahir, 15 Oct): orders of any age count; stuck is judged per ORDER LINE -
   nothing packed for the line, from any batch, for 7 days; base batches behind the
   oldest are queued, not stuck; cleared base with no order is held for orders. */
const vm = require('vm');
const H = require('./harness.js');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));
const html = H.html;

const consts = (html.match(/var PL_STUCK_NO_OUTPUT_DAYS=[^;]+;/) || [''])[0];
const SRC = consts + '\n' + ['calDays','lineShortClosed','_plPackedOf','plBatchMove','_plDay','plBatchFacts','_plLineOf','plLineWantsBase','plOpenLines','plOpenDemandKg','_plFirstOk','_plM','plBaseReady','_plBaseReady0','plLinePack','packLineOwes','_plCarrier','plBatchClass','_plRow','plStuckBatches','plHeldBatches','_plOpenBtn'].map(n => H.grab(n)).join('\n') + '\nvar _plMemo=null; function poReturnOpen(){ return false; }';

function make(state) {
  const s = { console, Date, Math, JSON, Object, Array, String,
    fmt: n => Math.round(n).toLocaleString('en-US'),
    localDateOf: d => String(d).slice(0, 10), evToday: () => '2026-10-12',
    lineBucket: (o, l) => (l.delivered >= l.ordered - 0.5 ? 'Delivered' : 'Production'),
    batchStage: b => b._stage || 'pack',
    batchPackableKg: b => Math.max(0, (+b.producedKg || 0) - (+b.packedKg || 0) - (+b.disposedKg || 0)),
    batchPackNow: b => !b.voided && !b.pool && (b.status !== 'closed' || !!b.stockKept) && (b._stage || 'pack') === 'pack' && ((+b.producedKg || 0) - (+b.packedKg || 0) - (+b.disposedKg || 0)) > 0.5,
    plCanAct: () => true, may: () => true, canView: () => true };
  s.state = Object.assign({ batches: [], orders: [], shiftEntries: [], packingLog: [] }, state || {});
  s.globalThis = s; vm.createContext(s); vm.runInContext(SRC, s); return s;
}
const B = (o) => Object.assign({ id: 'B1', batchNo: 'X1', status: 'open', kind: 'bulk', base: 'NPK', plannedKg: 500, producedKg: 500, packedKg: 0, disposedKg: 0, openedDate: '2026-07-28' }, o || {});
const ord = (o) => Object.assign({ po: 'P1', client: 'C', received: '2026-10-01', acknowledged: true, lines: [{ id: 'L1', base: 'NPK', ordered: 1000, packed: 0, delivered: 0 }] }, o || {});
const run = (b, st) => { const s = make(Object.assign({ batches: [b] }, st)); return s.plBatchClass(b); };

/* 1. the case on Tahir's screen: 372 of 500 packed, last pack 26 Sep, 348 shipped, an order waiting */
{ const b = B({ packedKg: 372 });
  const st = { shiftEntries: [{ batchId: 'B1', date: '2026-07-01' }],
    packingLog: [{ baseBatchId: 'B1', date: '2026-09-26', shipKg: 348 }], orders: [ord()] };
  const c = run(b, st);
  eq('packing counts as movement: last move is the pack day', c.f.last, '2026-09-26');
  eq('...and says packed', c.f.lastWhat, 'packed');
  eq('...16 days ago', c.f.days, 16);
  eq('stock left is 128', Math.round(c.f.left), 128);
  eq('shipped is read from the pack records', Math.round(c.f.shipped), 348);
  eq('with an order line waiting and nothing packed for it for 11 d it is stuck', c.k, 'stuck');
  ok('...and the reason names the line, the PO and the days', /waiting for NPK/.test(c.why) && /P1 11 d/.test(c.why), c.why);
  eq('...the line clock is 11 d (from the PO arriving)', c.days, 11);
  const s = make(Object.assign({ batches: [b] }, st)); const row = s.plStuckBatches()[0];
  ok('row says what was made, packed, left, shipped', /Made 500 of 500 . packed 372 . 128 left . shipped 348/.test(row.says), row.says);
  ok('row says when it last moved', /last packed 26 Sep \(16 d ago\)/.test(row.lastTxt), row.lastTxt);
  eq('row names who is next: Production, a real team', row.who, 'Production');
  eq('row days are the line days', row.days, 11);
  ok('row opens the batch page, not the Close sheet', /prodBatchSel='B1'/.test(row.act) && !/openCloseBatch/.test(row.act), row.act);
}
/* 2. the LINE was packed 3 days ago: moving, not on the list at all, even if this batch is idle */
{ const b = B({ packedKg: 372 });
  const c = run(b, { packingLog: [{ baseBatchId: 'B9', po: 'P1', lid: 'L1', date: '2026-10-09' }], orders: [ord()] });
  eq('line packed 3 d ago (from another batch) is moving: not on any list', c, null);
  const old = run(b, { packingLog: [{ po: 'P1', lid: 'L1', date: '2026-10-10' }], orders: [ord({ received: '2026-07-01' })] });
  eq('a long PO (received in July) still moving is never stuck for its age', old, null);
}
/* 3. held for orders: no order waiting */
{ const b = B({ packedKg: 73.5, plannedKg: 700, producedKg: 700 });
  const c = run(b, { packingLog: [{ baseBatchId: 'B1', date: '2026-08-21' }], orders: [] });
  eq('stock left and no order waiting is HELD', c.k, 'held');
  ok('...with the plain reason', /No open order is waiting/.test(c.why) && /Held for orders/.test(c.why), c.why);
  eq('...not flagged at 52 d', c.flag, false);
  const c2 = run(Object.assign({}, b, { openedDate: '2026-02-01' }), { packingLog: [{ baseBatchId: 'B1', date: '2026-03-01' }], orders: [] });
  eq('flagged after 180 d', c2.flag, true);
  ok('...and says to review', /Time to review/.test(c2.why), c2.why);
  const s = make({ batches: [b], packingLog: [{ baseBatchId: 'B1', date: '2026-08-21' }] });
  eq('held rows are not in the stuck list', s.plStuckBatches().length, 0);
  eq('...they are in the held list', s.plHeldBatches().length, 1);
}
/* 4. what is NOT demand */
{ const b = B({ packedKg: 100 }); const pk = [{ baseBatchId: 'B1', date: '2026-09-01' }];
  const old = ord({ received: '2026-07-01' });
  eq('an order older than 60 d IS demand now (no age limit)', run(b, { packingLog: pk, orders: [old] }).k, 'stuck');
  eq('a cancelled order is not demand', run(b, { packingLog: pk, orders: [ord({ cancelled: true })] }).k, 'held');
  eq('a closed order is not demand', run(b, { packingLog: pk, orders: [ord({ closed: true })] }).k, 'held');
  const done = ord(); done.lines[0].delivered = 1000;
  eq('a delivered line is not demand', run(b, { packingLog: pk, orders: [done] }).k, 'held');
  const full = ord(); full.lines[0].packed = 1000;
  eq('a fully packed line is not demand', run(b, { packingLog: pk, orders: [full] }).k, 'held');
  const sc = ord(); sc.lines[0].shortClose = { approvedAt: '2026-10-02' };
  eq('a short-closed line is not demand', run(b, { packingLog: pk, orders: [sc] }).k, 'held');
  eq('15f: a PO not yet acknowledged is not demand (Today does not offer it either)', run(b, { packingLog: pk, orders: [ord({ acknowledged: false })] }).k, 'held');
  const other = ord(); other.lines[0].base = 'Zinc';
  eq('another product is not demand', run(b, { packingLog: pk, orders: [other] }).k, 'held');
  eq('a recent short order IS demand', run(b, { packingLog: pk, orders: [ord()] }).k, 'stuck');
}
/* 5. made, nothing packed */
{ const b = B({ openedDate: '2026-10-04' });
  const c = run(b, { shiftEntries: [{ batchId: 'B1', date: '2026-10-04' }] });
  eq('made and cleared, nothing packed, no order: held for orders (15f)', c.k, 'held');
  const q = run(Object.assign(B({ openedDate: '2026-10-04' }), { _stage: 'qc' }), { shiftEntries: [{ batchId: 'B1', date: '2026-10-04' }] });
  ok('...waiting for the lab when not cleared', /lab to clear/.test(q.why) && q.who === 'Lab', q.why);
  const p = run(Object.assign(B({ openedDate: '2026-10-04' }), { _stage: 'pack' }), { shiftEntries: [{ batchId: 'B1', date: '2026-10-04' }] });
  eq('...cleared, nothing packed, no order waiting: held for orders (LBS26001)', p.k, 'held');
  const p2 = run(Object.assign(B({ openedDate: '2026-10-04' }), { _stage: 'pack' }), { shiftEntries: [{ batchId: 'B1', date: '2026-10-04' }], orders: [ord()] });
  ok('...cleared, an order line waiting 11 d with nothing packed: stuck, Production next', p2.k === 'stuck' && p2.who === 'Production', p2 && p2.why);
  const n = run(B({ openedDate: '2026-10-11' }), { shiftEntries: [{ batchId: 'B1', date: '2026-10-11' }] });
  ok('made yesterday is not stuck', !n || n.k !== 'stuck', n && n.k);
  const noDem = run(B({ openedDate: '2026-09-28' }), { shiftEntries: [{ batchId: 'B1', date: '2026-09-28' }], orders: [] });
  eq('made, cleared, nothing packed, no order: held for orders, not stuck', noDem.k, 'held');
}
/* 5b. output on the day it opened reads as output, not opened */
{ const c = run(B({ openedDate: '2026-10-04' }), { shiftEntries: [{ batchId: 'B1', date: '2026-10-04' }] });
  eq('a shift on the opening day says output logged', c.f.lastWhat, 'output');
}
/* 6. all packed and open */
{ const c = run(B({ packedKg: 500 }), { packingLog: [{ baseBatchId: 'B1', date: '2026-10-01' }] });
  eq('all packed, still open: stuck', c.k, 'stuck'); ok('...says close it', /Close it/.test(c.why));
  eq('...Production closes it (same name on every screen)', c.who, 'Production');
  const s = make({ batches: [B({ packedKg: 500 })], packingLog: [{ baseBatchId: 'B1', date: '2026-10-01' }] });
  ok('...and the row opens the Close sheet', /openCloseBatch/.test(s.plStuckBatches()[0].act));
  eq('disposed stock counts as not left', run(B({ packedKg: 400, disposedKg: 100 }), { packingLog: [{ baseBatchId: 'B1', date: '2026-10-01' }] }).f.left, 0);
}
/* 7. a batch still being made */
{ const c = run(B({ producedKg: 200 }), { shiftEntries: [{ batchId: 'B1', date: '2026-10-05' }] });
  eq('not made, no output 7 d: stuck', c.k, 'stuck'); ok('...says no output', /No output logged for 7 d/.test(c.why), c.why);
  eq('...Production is next', c.who, 'Production');
  eq('not made, output yesterday: not stuck', run(B({ producedKg: 200 }), { shiftEntries: [{ batchId: 'B1', date: '2026-10-11' }] }), null);
}
/* 8. who never appears */
{ eq('a pool is never listed', run(B({ pool: true }), {}), null);
  eq('a closed batch is never listed', run(B({ status: 'closed' }), {}), null);
  eq('a voided batch is never listed', run(B({ voided: true }), {}), null);
  eq('a by-product is never listed', run(B({ disposition: 'byproduct' }), {}), null);
}
/* 9. PO batch row opens the run sheet; a pack record matches by batch number too */
{ const b = B({ kind: 'po', po: 'P1', lineId: 'L1', batchNo: 'ZZ9', packedKg: 100 });
  const o = ord(); o.id = 'O1';
  const s = make({ batches: [b], orders: [o], packingLog: [{ baseBatchNo: 'ZZ9', date: '2026-09-01' }] });
  const r = s.plStuckBatches()[0];
  ok('a pack record found by batch number counts as the batch moving', s.plBatchClass(b).f.days === 41, s.plBatchClass(b).f.days);
  ok('...the row clock is the LINE (never packed since the PO came on 1 Oct: 11 d)', r && r.days === 11, r && r.days);
  ok('a PO batch opens its run sheet', r && /openRun\('O1','L1'\)/.test(r.act), r && r.act);
}
/* 10. today's live shape: 24 made batches are split, none vanish */
{ const bs = []; for (let i = 0; i < 6; i++) bs.push(B({ id: 'S' + i, batchNo: 'S' + i, packedKg: 0, openedDate: '2026-09-20' }));
  for (let i = 0; i < 6; i++) bs.push(B({ id: 'H' + i, batchNo: 'H' + i, base: 'Z' + i, packedKg: 50 }));
  const s = make({ batches: bs, shiftEntries: bs.map(b => ({ batchId: b.id, date: b.openedDate })), packingLog: bs.map(b => ({ baseBatchId: b.id, date: '2026-09-01' })) });
  eq('every open made batch is in exactly one list', s.plStuckBatches().length + s.plHeldBatches().length, 12);
}
/* 10a. 15f: queued behind the oldest base batch; any-age line clock */
{ const old = B({ id: 'A1', batchNo: 'A1', lots: [{ coa: { status: 'approved', approvedDate: '2026-09-01' } }] });
  const nw = B({ id: 'A2', batchNo: 'A2', lots: [{ coa: { status: 'approved', approvedDate: '2026-09-20' } }] });
  const s = make({ batches: [nw, old], orders: [ord({ received: '2026-08-01' })] });
  eq('the oldest base batch carries the stuck line', s.plBatchClass(old).k, 'stuck');
  eq('a newer base batch is queued behind it, not stuck', s.plBatchClass(nw).k, 'queued');
  eq('only 1 stuck row for the base, not 1 per batch', s.plStuckBatches().length, 1);
  eq('a queued batch is not on the held list either', s.plHeldBatches().length, 0);
  eq('never packed: the line clock runs from base ready (1 Sep), not the PO (1 Aug)', s.plBatchClass(old).days, 41);
  const ready = s.plBaseReady('NPK');
  eq('base ready lists oldest first', ready.batches.map(b => b.id).join(','), 'A1,A2');
  eq('...and adds up what is packable', Math.round(ready.kg), 1000);
  const two = make({ batches: [old], orders: [ord(), ord({ po: 'P2', received: '2026-10-01' })] });
  ok('2 stuck lines say "2 order lines" and "1 more"', /2 order lines/.test(two.plBatchClass(old).why) && /1 more/.test(two.plBatchClass(old).why), two.plBatchClass(old).why);
  eq('demand adds up every waiting line of any age', Math.round(two.plOpenDemandKg('NPK')), 2000);
}
/* 10b. review fixes: reversed packs, Open button rights and landing page */
{ const b = B({ packedKg: 100 });
  const c = run(b, { packingLog: [{ baseBatchId: 'B1', date: '2026-10-10', reversed: true, shipKg: 90 }, { baseBatchId: 'B1', date: '2026-09-01', shipKg: 10 }], orders: [] });
  eq('a reversed pack does not count as a move', c.f.last, '2026-09-01');
  eq('...nor as shipped', Math.round(c.f.shipped), 10);
  eq('a voided pack does not count either', run(b, { packingLog: [{ baseBatchId: 'B1', date: '2026-10-10', void: true }, { baseBatchId: 'B1', date: '2026-09-01' }] }).f.last, '2026-09-01');
  const s = make({ batches: [b], packingLog: [{ baseBatchId: 'B1', date: '2026-09-01' }], orders: [ord()] });
  const row = s.plStuckBatches()[0];
  ok('the batch-page link also sets the Production view', /prodView='lifecycle';prodLifeSub='batch';prodHome=false;prodBatchSel='B1'/.test(row.act), row.act);
  ok('Open shows when the role may open the batch page', /Open/.test(s._plOpenBtn(row)));
  s.canView = () => false; ok('no Open without access to Production', s._plOpenBtn(row) === '');
  s.canView = () => true; s.plCanAct = () => false; ok('no Open for a read-only role', s._plOpenBtn(row) === '');
  const s2 = make({ batches: [B({ packedKg: 500 })], packingLog: [{ baseBatchId: 'B1', date: '2026-10-01' }] });
  const r2 = s2.plStuckBatches()[0]; s2.may = c => c !== 'batch.close';
  ok('no Open on a Close batch row without batch.close', s2._plOpenBtn(r2) === '');
  const s3 = make({ batches: [B({ producedKg: 100 })], shiftEntries: [{ batchId: 'B1', date: '2026-10-01' }] });
  const r3 = s3.plStuckBatches()[0]; s3.may = c => c !== 'shift.log';
  ok('no Open on a shift-log row without shift.log', s3._plOpenBtn(r3) === '');
}
/* 11. screen and docs */
{ const pl = H.grab('screenPlant');
  ok('the stuck rows show says, why, last move and who', /r\.says/.test(pl) && /r\.lastTxt/.test(pl) && /next: /.test(pl));
  ok('Held for orders is shown under the stuck rows', /Held for orders/.test(pl) && /plHeldBatches\(\)/.test(pl));
  ok('Held rows are calm unless 180 d', /r\.flag\?'st-late':'st-ok'/.test(pl));
  ok('the held list stays reachable when nothing is stuck', /x\.k==='stuck'&&plHeldBatches\(\)\.length/.test(pl));
  ok('nothing is written', !/save\(\)/.test(H.grab('plBatchClass') + H.grab('plStuckBatches') + H.grab('plHeldBatches')));
  ok('Guide rule present', /<h3>What the Stuck batches list means<\/h3>/.test(html) && /Held for orders/.test(H.grab('guideRules')));
  ok('changelog entry present', /Stuck batches now show what is really packed/.test(html));
  ok('old wording gone from the tile', !/made and not closed/.test(pl));
}
console.log('\nStuck batches: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
