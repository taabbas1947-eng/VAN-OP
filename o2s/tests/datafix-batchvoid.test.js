/* Batch # on backfilled packing, and Void an entry (Packing) - 27 Aug 2026.

   Two real live-data bugs, both traced through the running app before being
   fixed here:

   1. VITAL UREA (COBO-2608-4613): a 2,500 Kg pack from batch VU26190 updated
      the batch and order-line totals but was never logged - no packingLog
      entry at all. It was backfilled with "Add missing packing", which had no
      way to link a batch #. The new record cleared production accounting but
      carried no baseBatchId/baseBatchNo, so Pre-shipment QA could not verify
      it: "No batch # - set batch # first", with no UI path to fix it. Fix:
      dfSubmitPacking() now requires a QC-approved batch (dfBatchSelect,
      filtered to the product's base material) and derives baseBatchId,
      baseBatchNo, brandBatchNo, mfgDate and expDate exactly as doPack() does
      (same packDates() call), and adds the quantity to the batch's packedKg.

   2. RUD26824 / Tervalis Plus: 3,000 Kg was packed against the wrong batch
      (VB26004, a "Vibrant" base-material batch). The order line was corrected
      back to 0 via Correct values (CR2166-5p20) - but that tool only sets
      order-line numbers, so the stray packingLog record (PK2132-wpn7) was
      never removed, and kept counting toward "Awaiting QA" (13,000 shown
      instead of the real 10,000), while batch VB26004's packedKg stayed at
      5,000 instead of freeing the 3,000 Kg back up. There already exists a
      generic Reverse (openCorrect -> CORRECT_ENTITY.packingLot.doReverse),
      but it ALSO re-subtracts from the order line - which here would double-
      count, since the line's 3,000 was already zeroed separately. Fix:
      dfSubmitVoid() - a new, narrower tool - zeroes just the stray record
      (so it drops out of lotsFor()'s kg>0.0001 filter) and, unless the
      "restore batch capacity" box is unchecked, reduces the batch's packedKg
      by the same amount. It deliberately never touches the order line.

   Run: node datafix-batchvoid.test.js */
const H = require('./harness.js');
const vm = require('vm');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

/* ============ 0. both writers are still gated ============ */
['dfSubmitPacking', 'dfSubmitVoid'].forEach(fn => {
  const body = H.grab(fn);
  ok('GUARD: ' + fn + " asks screenEditOK('datafix')",
     /screenEditOK\('datafix'\)/.test(body));
});

/* ============ 1. the sandbox: real writers + their real dependencies ============ */
const FNS = ['dfSubmitPacking', 'dfSubmitVoid', 'dfBatchSelect', 'dfVoidEntrySelect',
             '_batchApprovedDate', 'batchLabApproved', 'batchPackableKg',
             'packDates', 'packMfgFor', 'batchProdDate', 'addMonthsISO',
             'recordBackfill', 'recordCorrection', 'correctTypeLabel', 'correctReasonText'];
const src = FNS.map(H.grab).join('\n\n') + '\n'
  + H.grabObj('CORRECT_ENTITY') + '\n'
  + H.grabObj('CORRECT_TYPE_LABEL') + '\n'
  + H.grabObj('CORRECT_REASONS') + '\n'
  + 'var SHELF_DEFAULT_MONTHS=24, SHELF_MAX_MONTHS=36;\n';

function box(state, dfForm) {
  const b = {
    console, Date, JSON,
    state, dfForm,
    TODAY: new Date('2026-08-27T00:00:00.000Z'),
    fmt: n => (n == null ? '' : String(n)),
    _uid: p => p + 'TEST1',
    nid: p => p + 'N1',
    screenEditOK: () => true,
    dfReasonOk: () => !!(dfForm.reason && String(dfForm.reason).trim()),
    toasts: [], toast: m => b.toasts.push(m),
    saved: false, save: () => { b.saved = true; },
    backCalled: false, dfBack: () => { b.backCalled = true; },
    render: () => {}, closeModal: () => {}, logAction: () => {},
  };
  b.globalThis = b; vm.createContext(b); vm.runInContext(src, b); return b;
}

function baseState() {
  return {
    role: 'COO', currentUser: { name: 'tahir' },
    orders: [{ id: 'O43', po: 'COBO-2608-4613', client: 'COBO',
               lines: [{ id: 'O43L0', brand: 'Vital Urea', base: 'Sulfur Coated Urea',
                         ordered: 2500, produced: 0, packed: 0 }] }],
    batches: [
      { id: 'B2193', batchNo: 'VU26190', base: 'Sulfur Coated Urea',
        producedKg: 7000, packedKg: 3875,
        lots: [{ id: 'L1', qty: 3500, date: '2026-08-20', coa: { status: 'approved', certifiedKg: 3500, approvedDate: '2026-08-26' } },
               { id: 'L2', qty: 3500, date: '2026-08-20', coa: { status: 'approved', certifiedKg: 3500, approvedDate: '2026-08-26' } }] },
      { id: 'B9', batchNo: 'UNAPPROVED9', base: 'Sulfur Coated Urea',
        producedKg: 1000, packedKg: 0, lots: [{ id: 'L9', qty: 1000, date: '2026-08-20', coa: { status: 'pending' } }] },
    ],
    packingLog: [],
  };
}

/* ============ 2. dfSubmitPacking: batch # is now required ============ */
{
  const st = baseState();
  const b = box(st, { oid: 'O43', lid: 'O43L0', qty: '2500', date: '2026-08-26', reason: 'backfilled', bid: '' });
  b.dfSubmitPacking();
  eq('no batch picked -> nothing written', st.packingLog.length, 0);
  ok('...and says to pick one', b.toasts.some(t => /Pick a batch/.test(t)), JSON.stringify(b.toasts));
}
{
  const st = baseState();
  const b = box(st, { oid: 'O43', lid: 'O43L0', qty: '2500', date: '2026-08-26', reason: 'backfilled', bid: 'B9' });
  b.dfSubmitPacking();
  eq('an un-approved batch -> nothing written', st.packingLog.length, 0);
  ok('...and says why', b.toasts.some(t => /QC-approved/.test(t)), JSON.stringify(b.toasts));
}
{
  const st = baseState();
  const b = box(st, { oid: 'O43', lid: 'O43L0', qty: '2500', date: '2026-08-26', reason: 'Ali Raza packed from VU26190, never logged', bid: 'B2193' });
  b.dfSubmitPacking();
  eq('a QC-approved batch -> one record written', st.packingLog.length, 1);
  const p = st.packingLog[0];
  eq('...carries the base batch id (this is the Vital Urea fix)', p.baseBatchId, 'B2193');
  eq('...and the base batch #', p.baseBatchNo, 'VU26190');
  eq('...brand batch # defaults to the base batch #', p.brandBatchNo, 'VU26190');
  ok('...and a derived mfg date (never left blank)', !!p.mfgDate, JSON.stringify(p));
  ok('...and a derived expiry', !!p.expDate, JSON.stringify(p));
  eq('the batch’s own packedKg absorbs the backfilled qty (3875 -> 6375)', st.batches[0].packedKg, 6375);
  eq('the order line catches up', st.orders[0].lines[0].packed, 2500);
  eq('...produced too', st.orders[0].lines[0].produced, 2500);
  ok('a BACKFILL correction is on record', st.corrections.some(c => c.op === 'BACKFILL' && c.entityType === 'packingLot'), JSON.stringify(st.corrections));
  ok('...and it names the batch #', st.corrections.some(c => (c.changes || []).some(ch => ch.field === 'baseBatchNo' && ch.after === 'VU26190')));
  ok('it says so', b.toasts.some(t => /batch # linked/.test(t)));
}

/* ============ 3. dfSubmitVoid: RUD26824-shaped case ============ */
function voidState() {
  return {
    role: 'COO', currentUser: { name: 'tahir' },
    orders: [{ id: 'O45', po: 'RUD26824', client: 'RUDOLF',
               lines: [{ id: 'O45L0', brand: 'Tervalis Plus', base: 'Potassium Humate Liquid',
                         ordered: 10000, produced: 10000, packed: 10000 }] }],
    batches: [{ id: 'B1116', batchNo: 'VB26004', base: 'Potassium Humate Liquid', packedKg: 5000 }],
    packingLog: [
      { id: 'PK2132', po: 'RUD26824', lid: 'O45L0', brand: 'Tervalis Plus', date: '2026-08-25',
        kg: 3000, baseBatchId: 'B1116', baseBatchNo: 'VB26004', insKg: 0 },
      { id: 'PK2276', po: 'RUD26824', lid: 'O45L0', brand: 'Tervalis Plus', date: '2026-08-26',
        kg: 10000, baseBatchId: 'B2170', baseBatchNo: 'RUHLS26005', insKg: 0 },
    ],
  };
}
{
  const st = voidState();
  const b = box(st, { pid: '', reason: 'wrong batch keyed', restoreBatch: true });
  b.dfSubmitVoid();
  ok('no record picked -> refused', b.toasts.some(t => /Pick the record/.test(t)));
}
{
  const st = voidState();
  const b = box(st, { pid: 'PK2132', reason: '', restoreBatch: true });
  b.dfSubmitVoid();
  eq('no reason -> nothing changes', st.packingLog[0].kg, 3000);
}
{
  const st = voidState();
  st.packingLog[0].insKg = 3000; // already QA-inspected
  const b = box(st, { pid: 'PK2132', reason: 'wrong batch keyed', restoreBatch: true });
  b.dfSubmitVoid();
  eq('already-inspected record -> refused, kg untouched', st.packingLog[0].kg, 3000);
  ok('...and says why', b.toasts.some(t => /already been QA-inspected|withdraw the inspection/i.test(t)), JSON.stringify(b.toasts));
}
{
  const st = voidState();
  const b = box(st, { pid: 'PK2132', reason: 'Mistakenly selected VB26004 (Vibrant) instead of the Tervalis Plus batch', restoreBatch: true });
  b.dfSubmitVoid();
  eq('the stray record is zeroed (drops out of the Awaiting QA queue)', st.packingLog[0].kg, 0);
  eq('...and flagged void', st.packingLog[0].void, true);
  eq('...remembering what it used to be, for the audit trail', st.packingLog[0].voidedKg, 3000);
  eq('the OTHER (correct) record is untouched', st.packingLog[1].kg, 10000);
  eq('batch VB26004’s capacity is restored: 5,000 -> 2,000', st.batches[0].packedKg, 2000);
  eq('the order line is NOT touched — it was already corrected separately',
     st.orders[0].lines[0].packed, 10000);
  eq('...produced too', st.orders[0].lines[0].produced, 10000);
  ok('a VOID correction is on record', st.corrections.some(c => c.op === 'VOID' && c.entityType === 'packingLot'));
  ok('...and it names the batch cascade', st.corrections.some(c => (c.cascade || []).some(x => /VB26004/.test(x))));
}
{
  const st = voidState();
  const b = box(st, { pid: 'PK2132', reason: 'wrong batch keyed, but keep it counted against VB26004', restoreBatch: false });
  b.dfSubmitVoid();
  eq('unchecking "restore batch capacity" leaves the batch untouched', st.batches[0].packedKg, 5000);
  eq('but the stray record is still voided out of the queue', st.packingLog[0].kg, 0);
}
{
  const st = voidState();
  const b1 = box(st, { pid: 'PK2132', reason: 'first void', restoreBatch: true });
  b1.dfSubmitVoid();
  const b2 = box(st, { pid: 'PK2132', reason: 'second attempt', restoreBatch: true });
  b2.dfSubmitVoid();
  eq('voiding an already-voided record a second time changes nothing further',
     st.batches[0].packedKg, 2000);
  ok('...and says so', b2.toasts.some(t => /already been voided/.test(t)));
}

/* ============ 4. the Data Fix card is really switched on ============ */
ok('GUARD: "Void an entry" card now starts a real op (not the greyed-out placeholder)',
   /dfStart\('void'\)/.test(H.html));
ok('GUARD: the placeholder card’s dead onclick is gone',
   !/card\('Void an entry','',false\)/.test(H.html));

console.log('\nBatch # + Void an entry (packing): ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
