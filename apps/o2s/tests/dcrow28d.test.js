/* 28d - DC 5264 (Rudolf RUDP1026): the duplicate-truck clean-up cut a real row of a
   PO that has 2 lines of one product, and the DC printed 2,000 instead of 4,500.
   Run: node apps/o2s/tests/dcrow28d.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, html } = H;

function box(fns, extra) { const b = Object.assign({ console }, extra || {}); vm.createContext(b); vm.runInContext(fns.map(grab).join('\n'), b); return b; }
const clone = (x) => JSON.parse(JSON.stringify(x));

/* ---------- the clean-up works by LINE ---------- */
{ const b = box(['dedupeShipmentsV1']);
  const mk = () => ({
    orders: [{ po: 'P1', lines: [
      { id: 'L0', brand: 'GP', pack: 5, dispatched: 2500 },
      { id: 'L1', brand: 'GP', pack: 20, dispatched: 2000 }] }],
    shipments: [
      { id: 'S1', dispId: 'D1', po: 'P1', brand: 'GP', lid: 'L0', kg: 2500, dc: '5264', stage: 'in_transit', dispCounted: true },
      { id: 'S2', dispId: 'D1', po: 'P1', brand: 'GP', lid: 'L1', kg: 2000, dc: '5264', stage: 'in_transit', dispCounted: true }] });
  let s = mk(); b.dedupeShipmentsV1(s);
  eq('2 lines of one product on 1 truck: both rows stay (the DC 5264 case)', s.shipments.length, 2);
  eq('...with the same kg', s.shipments.map(x => x.kg).join(','), '2500,2000');
  /* run it again: nothing moves */
  b.dedupeShipmentsV1(s); eq('...and a second page load changes nothing', s.shipments.length, 2);

  /* a REAL duplicate on one line is still cleaned: the same row twice on the same DC */
  s = mk(); s.shipments.push({ id: 'S3', dispId: 'D1', po: 'P1', brand: 'GP', lid: 'L1', kg: 2000, dc: '5264', stage: 'in_transit', dispCounted: true });
  b.dedupeShipmentsV1(s);
  eq('a true duplicate of the 20 L row is still removed', s.shipments.filter(x => x.lid === 'L1').length, 1);
  eq('...and the 5 L row is not touched by it', s.shipments.filter(x => x.lid === 'L0').length, 1);
  eq('...so the ledger of each line equals its dispatched', s.shipments.reduce((a, x) => a + x.kg, 0), 4500);

  /* the same duplicate on the FIRST line */
  s = mk(); s.shipments.push({ id: 'S4', dispId: 'D1', po: 'P1', brand: 'GP', lid: 'L0', kg: 2500, dc: '5264', stage: 'in_transit', dispCounted: true });
  b.dedupeShipmentsV1(s);
  eq('a true duplicate of the 5 L row is removed (one copy left)', s.shipments.filter(x => x.lid === 'L0').length, 1);
  eq('...and the 20 L row stays', s.shipments.filter(x => x.lid === 'L1').length, 1);

  /* trucks that have not left are never looked at (25m) */
  s = mk(); s.shipments.forEach(x => { x.dispCounted = false; x.stage = 'loading'; });
  s.shipments.push({ id: 'S5', dispId: 'D1', po: 'P1', brand: 'GP', lid: 'L1', kg: 2000, dc: '5264', stage: 'loading', dispCounted: false });
  b.dedupeShipmentsV1(s); eq('a truck still loading is left alone', s.shipments.length, 3);

  /* older rows with no line id: compared with the SUM of the lines of that product, so they can only cut less */
  s = { orders: [{ po: 'P2', lines: [{ id: 'A', brand: 'X', pack: 5, dispatched: 300 }, { id: 'B', brand: 'X', pack: 20, dispatched: 200 }] }],
    shipments: [{ id: 'T1', po: 'P2', brand: 'X', kg: 300, dc: '9', dispCounted: true }, { id: 'T2', po: 'P2', brand: 'X', kg: 200, dc: '9', dispCounted: true }] };
  b.dedupeShipmentsV1(s); eq('old rows without a line id on a 2 line PO: both stay', s.shipments.length, 2);
  s = { orders: [{ po: 'P3', lines: [{ id: 'A', brand: 'X', pack: 5, dispatched: 300 }] }],
    shipments: [{ id: 'T1', po: 'P3', brand: 'X', kg: 300, dc: '9', dispCounted: true }, { id: 'T2', po: 'P3', brand: 'X', kg: 300, dc: '9', dispCounted: true }] };
  b.dedupeShipmentsV1(s); eq('old rows without a line id, a true duplicate on a 1 line PO: still cleaned', s.shipments.length, 1);

  /* REVIEW: a 1 line PO with some rows carrying the line id and some not: a true duplicate must still be cleaned */
  s = { orders: [{ po: 'P5', lines: [{ id: 'A', brand: 'X', pack: 5, dispatched: 300 }] }],
    shipments: [{ id: 'T1', po: 'P5', brand: 'X', lid: 'A', kg: 300, dc: '9', dispCounted: true }, { id: 'T2', po: 'P5', brand: 'X', kg: 300, dc: '9', dispCounted: true }] };
  b.dedupeShipmentsV1(s); eq('1 line PO, one row with a line id and its copy without: cleaned to 1', s.shipments.length, 1);
  /* every removal leaves a trace in the audit */
  ok('the removal is written in the audit with a fixed id', s.audit && s.audit.length === 1 && /^AUdup-/.test(s.audit[0].id) && s.audit[0].po === 'P5');
  /* a row whose line id is not on the PO falls back to the product, and never throws */
  s = { orders: [{ po: 'P4', lines: [{ id: 'A', brand: 'X', pack: 5, dispatched: 100 }] }],
    shipments: [{ id: 'T1', po: 'P4', brand: 'X', lid: 'GONE', kg: 100, dc: '1', dispCounted: true }] };
  b.dedupeShipmentsV1(s); eq('a row naming a line that is gone is kept', s.shipments.length, 1);
  s = { orders: [], shipments: [{ id: 'T', po: 'Z', brand: 'X', kg: 5, dispCounted: true }] };
  b.dedupeShipmentsV1(s); eq('a row of a PO that no longer exists is kept', s.shipments.length, 1);
  ok('the cleaner still looks only at trucks already counted (25m)', /x\.dispCounted\|\|!\(x\.stage\|\|x\.dispId\)/.test(grab('dedupeShipmentsV1')));
}

/* ---------- the pack size on the DC, gate pass and inspection report comes from the LINE ---------- */
{ const b = box(['linePackSize'], { state: { orders: [{ po: 'P1', lines: [{ id: 'L0', brand: 'GP', pack: 5 }, { id: 'L1', brand: 'GP', pack: 20 }] }] }, seedPackForBrand: () => 0 });
  eq('by line: the 20 L line is 20', b.linePackSize('P1', 'GP', 'L1'), 20);
  eq('by line: the 5 L line is 5', b.linePackSize('P1', 'GP', 'L0'), 5);
  eq('no line id (older rows): the first line of the product, as before', b.linePackSize('P1', 'GP'), 5);
  eq('a line id that is gone falls back to the product', b.linePackSize('P1', 'GP', 'NOPE'), 5);
  const calls = html.match(/linePackSize\(r\.po\|\|po1,r\.brand(,r\.lid)?\)/g) || [];
  eq('the DC, the gate pass and the inspection report all pass the line id', calls.filter(x => /r\.lid/.test(x)).length, 3);
  eq('...and none still asks by product name alone', calls.filter(x => !/r\.lid/.test(x)).length, 0);
}

/* ---------- the DC 5264 row is put back, once, and only if everything is as found ---------- */
{ const b = box(['restoreDC5264V1', 'dedupeShipmentsV1']);
  const mk = () => ({
    orders: [{ po: 'RUDP1026', lines: [
      { id: 'O66_4573-023yL0', brand: 'V Germinator Pro', pack: 5, dispatched: 2500 },
      { id: 'O66_4573-023yL1', brand: 'V Germinator Pro', pack: 20, dispatched: 2000 }] }],
    packingLog: [
      { id: 'PK5662-3e9b', po: 'RUDP1026', lid: 'O66_4573-023yL0', kg: 500, insKg: 500, shipKg: 500, baseBatchNo: 'VG26004', brandBatchNo: 'VG  26002' },
      { id: 'PK5664-v0gv', po: 'RUDP1026', lid: 'O66_4573-023yL0', kg: 500, insKg: 500, shipKg: 500, baseBatchNo: 'VG26005', brandBatchNo: 'VG  26002' },
      { id: 'PK5749-s9d1', po: 'RUDP1026', lid: 'O66_4573-023yL0', kg: 1500, insKg: 1500, shipKg: 1500, baseBatchNo: 'VG26005', brandBatchNo: 'VG 26002' }],
    batches: [], audit: [], actionLog: [],
    shipments: [{ id: 'SHmvsbbyduxgvxgf', dispId: 'DSPmvsbbyds6djsp7', po: 'RUDP1026', brand: 'V Germinator Pro', lid: 'O66_4573-023yL1', kg: 2000, pack: 20, dc: '5264', stage: 'in_transit', dispCounted: true, gatePass: 'GP-0188', qa: { pass: true }, batches: [{ lotId: 'PK5478-dans', batch: 'VG26002', brand: 'VG26001', kg: 640 }, { lotId: 'PK5660-roze', batch: 'VG26004', brand: 'VG 26002', kg: 1360 }], batchChanges: [{ x: 1 }], qaHistory: [{ y: 1 }] }] });
  let s = mk(); b.restoreDC5264V1(s);
  eq('the row comes back: 2 rows on DC 5264', s.shipments.filter(x => x.dc === '5264').length, 2);
  const r = s.shipments.find(x => x.id === 'SHrestored5264L0');
  ok('it is the 5 L line', !!r && r.lid === 'O66_4573-023yL0' && r.pack === 5);
  eq('2,500 Kg/L', r && r.kg, 2500);
  eq('the 3 runs, 500 + 500 + 1,500', r && r.batches.map(x => x.kg).join('+'), '500+500+1500');
  eq('the bag number is the one printed on the bag', r && r.batches.map(x => x.brand).join('|'), 'VG  26002|VG  26002|VG 26002');
  ok('same truck, same DC, same gate pass', r && r.dispId === 'DSPmvsbbyds6djsp7' && r.dc === '5264' && r.gatePass === 'GP-0188');
  ok('counted, exact, and marked revised', r && r.dispCounted === true && r.lotExact === true && r.dcRevised === 1);
  ok('it does not carry the other row\'s batch changes or inspection history', r && !r.batchChanges && !r.qaHistory);
  eq('the whole truck is 4,500', s.shipments.reduce((a, x) => a + x.kg, 0), 4500);
  ok('it is written in the audit and on the action log, each with a fixed id', s.audit.length === 1 && s.actionLog.length === 1 && /4,500/.test(s.audit[0].val) && s.audit[0].id === 'AU5264-restore' && s.actionLog[0].id === 'AL5264-restore');
  ok('the log line says to print the gate pass too', /gate pass/.test(s.actionLog[0].what));
  ok('it is NOT marked done: it checks again on every load', s._restoreDC5264V1 === undefined);
  /* once */
  b.restoreDC5264V1(s); eq('a second run adds nothing', s.shipments.length, 2);
  /* the clean-up no longer eats it on the next page load */
  b.dedupeShipmentsV1(s); eq('the clean-up keeps the restored row', s.shipments.length, 2);
  /* the source row is not changed */
  eq('the 20 L row is untouched', s.shipments.find(x => x.id === 'SHmvsbbyduxgvxgf').kg, 2000);
  eq('...and keeps its own batch changes', (s.shipments.find(x => x.id === 'SHmvsbbyduxgvxgf').batchChanges || []).length, 1);

  /* guards: any difference from what was found, and nothing is added */
  s = mk(); s.orders[0].lines[0].dispatched = 2000; b.restoreDC5264V1(s); eq('dispatched not 2,500: nothing added', s.shipments.length, 1);
  s = mk(); s.packingLog[2].shipKg = 0; b.restoreDC5264V1(s); eq('a run no longer marked shipped: nothing added', s.shipments.length, 1);
  s = mk(); s.packingLog[0].shipKg = 400; b.restoreDC5264V1(s); eq('the runs do not add to 2,500: nothing added', s.shipments.length, 1);
  s = mk(); s.packingLog.pop(); b.restoreDC5264V1(s); eq('a run is missing: nothing added', s.shipments.length, 1);
  s = mk(); s.shipments = []; b.restoreDC5264V1(s); eq('the truck itself is gone: nothing added', s.shipments.length, 0);
  s = mk(); s.shipments[0].voided = true; b.restoreDC5264V1(s); eq('the truck was cancelled: nothing added', s.shipments.length, 1);
  s = mk(); s.shipments[0].dc = '5270'; b.restoreDC5264V1(s); eq('a different DC: nothing added', s.shipments.length, 1);
  s = mk(); s.orders = []; b.restoreDC5264V1(s); eq('the PO is not there: nothing added, no error', s.shipments.length, 1);
  s = mk(); s.shipments.unshift(Object.assign(clone(s.shipments[0]), { id: 'OTHER', lid: 'O66_4573-023yL0', kg: 2500 })); b.restoreDC5264V1(s);
  eq('the row is already there (someone put it back): nothing added', s.shipments.length, 2);
  b.restoreDC5264V1(s); eq('...and a later run still adds nothing', s.shipments.length, 2);
  b.restoreDC5264V1(null); b.restoreDC5264V1({}); ok('null and empty data do not throw', true);
  /* a truck already delivered is left alone */
  s = mk(); s.shipments[0].delivered = '2026-10-29'; b.restoreDC5264V1(s); eq('a delivered truck is not cloned', s.shipments.length, 1);
  s = mk(); s.shipments[0].deliveryIssue = { kg: 5 }; b.restoreDC5264V1(s); eq('a truck with a delivery claim is not cloned', s.shipments.length, 1);
  /* THE REVIEW FINDING: the page keeps its merge baseline AFTER the restore ran. A save that clashes with someone else's
     must not drop the row for good. Measured with the real merge3. */
  { const m = box(['merge3', '_arrId', '_eq', 'restoreDC5264V1']);
    const server = mk();                                    /* what the server holds: the row is missing */
    const local = clone(server); m.restoreDC5264V1(local);  /* this page, after ensureState */
    const base = clone(local);                              /* the baseline is taken AFTER ensureState (the page does this) */
    const server2 = clone(server); server2.actionLog.push({ id: 'ALother', t: '2026-10-28T17:00:00Z', what: 'someone else saved' });
    let merged = m.merge3(base, local, server2);
    m.restoreDC5264V1(merged);                               /* ensureState runs on the merged data (the 409 path) */
    eq('after a clashing save the restored row is still there (1 row of the 5 L line)', merged.shipments.filter(x => x.lid === 'O66_4573-023yL0').length, 1);
    eq('...the whole truck is 4,500', merged.shipments.reduce((a, x) => a + x.kg, 0), 4500);
    eq('...the action log line is there once, and the other person\'s line is kept', merged.actionLog.map(x => x.id).sort().join(','), 'AL5264-restore,ALother');
    eq('...and the audit line once', merged.audit.filter(x => x.id === 'AU5264-restore').length, 1);
    /* and a second clash on top of it */
    const again = m.merge3(clone(merged), clone(merged), clone(server2)); m.restoreDC5264V1(again);
    eq('after a second clash it is still 1 row, 4,500', again.shipments.filter(x => x.lid === 'O66_4573-023yL0').length + again.shipments.filter(x => x.lid === 'O66_4573-023yL1').length, 2);
    eq('...and no second action log line', again.actionLog.filter(x => x.id === 'AL5264-restore').length, 1);
    /* 2 pages restoring at the same moment */
    const a = clone(server), c = clone(server); m.restoreDC5264V1(a); m.restoreDC5264V1(c);
    const both = m.merge3(clone(server), a, c);
    eq('2 pages restoring at once: 1 row', both.shipments.filter(x => x.lid === 'O66_4573-023yL0').length, 1);
    eq('...1 action log line, 1 audit line', both.actionLog.filter(x => x.id === 'AL5264-restore').length + both.audit.filter(x => x.id === 'AU5264-restore').length, 2);
  }
}

/* ---------- wiring ---------- */
ok('the restore runs on load, right after the clean-up', /dedupeShipmentsV1\(s\); restoreDC5264V1\(s\); healPRFlags\(s\);/.test(html));
ok('the restore has a fixed row id, so 2 people opening O2S together cannot add it twice', /row\.id='SHrestored5264L0'/.test(grab('restoreDC5264V1')));
ok('the clean-up compares by line id', /'L\|'\+o\.po\+'\|'\+l\.id/.test(grab('dedupeShipmentsV1')));

process.exitCode = report('DC 5264: the clean-up by line, the pack by line, the row put back (28d)') ? 1 : 0;
