/* HG26025, 25 August 2026. Production said they made 38,800 Kg; the app offered
   35,400 for packing and said nothing about the other 3,400.

   Cause, found in the code and confirmed by the arithmetic: a production entry
   of 3,400 Kg was voided AFTER the lab had certified its lot. _voidReverseBatch
   removes the matching lot only when it is NOT approved — but it reduced
   producedKg either way. The batch kept eight certified lots totalling 38,800
   while its produced total read 35,400, and packable stock is capped at
   produced. 3,400 Kg of good, certified material became unpackable.

   Two fixes, both the COO's decision of 25 Aug:
     1. Correcting a batch's produced quantity is now a proper correction —
        reason required, written to the register, Plant Manager or COO.
     2. A production entry whose lot the lab has certified can no longer be
        voided at all. Certified material exists; removing it is a disposal.

   Run: node batchqty.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

/* ---- the real batch, as the screen showed it ---- */
const LOTS = [4600, 2000, 6400, 6000, 5000, 6400, 3400, 5000];
const HG = () => ({
  id: 'B-HG26025', batchNo: 'HG26025', base: 'Potassium Humate', kind: 'bulk',
  status: 'closed', plannedKg: 50000, producedKg: 35400, packedKg: 0, disposedKg: 0,
  lots: LOTS.map((q, i) => ({ id: 'LOT' + i, lotNo: 'HG26025-L' + (i + 1), qty: q,
                              coa: { status: 'approved', certifiedKg: q } })),
});

/* ================= 1. the arithmetic that started it ================= */
{
  const b0 = { console, Math, JSON }; b0.globalThis = b0; vm.createContext(b0);
  vm.runInContext(['batchClearedKg', 'batchPackableKg', 'batchStage'].map(H.grab).join('\n\n'), b0);
  const b = HG();
  eq('the eight lots total 38,800', LOTS.reduce((a, c) => a + c, 0), 38800);
  eq('the lab certified all of it', b0.batchClearedKg(b), 38800);
  eq('but the batch says it produced 35,400', b.producedKg, 35400);
  eq('so only 35,400 can be packed — capped at produced', b0.batchPackableKg(b), 35400);
  eq('the shortfall is exactly one lot', 38800 - 35400, 3400);
  ok('...and that lot is L7, which the lab certified',
     b.lots[6].qty === 3400 && b.lots[6].coa.status === 'approved');
  /* with the total corrected, the certified material becomes packable */
  const fixed = Object.assign(HG(), { producedKg: 38800 });
  eq('corrected to 38,800, all of it is packable', b0.batchPackableKg(fixed), 38800);
  eq('and the batch reads Ready to pack', b0.batchStage(fixed), 'pack');
}

/* ================= 2. correcting the produced total ================= */
{
  const src = ['batchClearedKg', 'batchPackableKg', 'recordCorrection', 'correctTypeLabel',
               'correctReasonText', 'correctTarget', 'correctFieldOK', 'correctCanAmend',
               'correctAllowed', 'correctAnyField', 'applyCorrect', 'nid', 'logAction', 'hardRole', 'canEdit']
              .map(H.grab).join('\n\n')
            + '\n' + H.grabObj('CORRECT_REASONS') + '\n' + H.grabObj('CORRECT_ENTITY');
  function box(role, batch) {
    const b = { console, Math, JSON, Date,
      state: { role, currentUser: { name: 'A Person', username: 'ap' }, seq: 1,
               screen: 'prod', corrections: [], audit: [], actionLog: [],
               batches: [batch], orders: [], packingLog: [], shipments: [] },
      toasts: [], logs: [], saved: 0,
      toast: m => b.toasts.push(m), logAction: m => b.logs.push(m),
      save: () => { b.saved++; }, closeModal: () => {}, render: () => {},
      fmt: n => String(n), shortClient: c => String(c || ''),
      _pe: v => String(v == null ? '' : v),
    };
    b.globalThis = b; vm.createContext(b); vm.runInContext(src, b);
    return b;
  }
  const form = (vals, over) => Object.assign({ type: 'batch', id: 'B-HG26025', op: 'AMEND',
    reasonCode: 'keying', reason: 'Void of a certified lot took 3,400 Kg off the produced total.',
    vals }, over || {});

  /* THE REPAIR */
  {
    const b = box('Plant Manager', HG());
    b.correctForm = form({ producedKg: 38800 });
    b.applyCorrect();
    eq('the Plant Manager can put the produced total right', b.state.batches[0].producedKg, 38800);
    eq('and the certified material becomes packable', b.batchPackableKg(b.state.batches[0]), 38800);
    eq('one entry is written to the register', b.state.corrections.length, 1);
    const c = b.state.corrections[0];
    eq('...as an amendment to the batch', c.op + '/' + c.entityType, 'AMEND/batch');
    eq('...naming the batch', c.entityLabel.indexOf('HG26025'), 0);
    eq('...recording what it was and what it became',
       c.changes[0].before + '->' + c.changes[0].after, '35400->38800');
    ok('...who did it', c.by === 'A Person' && c.byRole === 'Plant Manager');
    ok('...and why, in their words', /3,400 Kg off the produced total/.test(c.reason));
    ok('the register says what it did to packable stock',
       (c.cascade || []).some(x => /Ready to pack is now 38800/.test(x)), JSON.stringify(c.cascade));
    ok('and it is saved', b.saved > 0);
  }
  /* WHO MAY. Raising your own produced figure is a quantity claim. */
  {
    const b = box('Production', HG());
    b.correctForm = form({ producedKg: 38800 });
    b.applyCorrect();
    eq('Production cannot raise its own produced figure', b.state.batches[0].producedKg, 35400);
    eq('and nothing is written to the register', b.state.corrections.length, 0);
    const c = box('COO', HG());
    c.correctForm = form({ producedKg: 38800 });
    c.applyCorrect();
    eq('the COO can', c.state.batches[0].producedKg, 38800);
  }
  /* A REASON IS REQUIRED, like every other correction */
  {
    const b = box('Plant Manager', HG());
    b.correctForm = form({ producedKg: 38800 }, { reason: 'oops' });
    b.applyCorrect();
    eq('a one-word reason is refused', b.state.batches[0].producedKg, 35400);
    ok('...and says so', b.toasts.some(t => /a sentence, not a word/.test(t)), JSON.stringify(b.toasts));
    const c = box('Plant Manager', HG());
    c.correctForm = form({ producedKg: 38800 }, { reasonCode: '' });
    c.applyCorrect();
    eq('no reason code is refused', c.state.batches[0].producedKg, 35400);
  }
  /* IT CANNOT BE USED TO INVENT MATERIAL */
  {
    const b = box('Plant Manager', HG());
    b.correctForm = form({ producedKg: 45000 });
    b.applyCorrect();
    eq('it cannot be set above what the lots account for', b.state.batches[0].producedKg, 35400);
    ok('...and it says where the material would have to come from',
       b.toasts.some(t => /log the missing shift/.test(t)), JSON.stringify(b.toasts));
    eq('nothing reaches the register', b.state.corrections.length, 0);
  }
  /* NOR TO UN-PRODUCE WHAT HAS LEFT THE BATCH */
  {
    const packed = Object.assign(HG(), { packedKg: 20000, producedKg: 35400 });
    const b = box('Plant Manager', packed);
    b.correctForm = form({ producedKg: 10000 });
    b.applyCorrect();
    eq('it cannot go below what is already packed', b.state.batches[0].producedKg, 35400);
    ok('...naming the quantity that has gone', b.toasts.some(t => /20000 Kg packed/.test(t)),
       JSON.stringify(b.toasts));
    /* Down to exactly what is packed is allowed — but only where the lab has not
       certified more than that. On a certified batch the certified floor bites
       first, which is the stronger rule. */
    const un = Object.assign(HG(), { packedKg: 20000 });
    un.lots = un.lots.map(l => Object.assign({}, l, { coa: null }));
    const c = box('Plant Manager', un);
    c.correctForm = form({ producedKg: 20000 });
    c.applyCorrect();
    eq('down to exactly what is packed is allowed when nothing is certified',
       c.state.batches[0].producedKg, 20000);
  }
  /* THE FLOOR THAT MATTERS: certified material exists, so produced can never be
     less than it. Without this the field could recreate HG26025 in two clicks —
     and an empty box reads as 0, so it would be one slip away. */
  {
    const b = box('Plant Manager', HG());
    b.correctForm = form({ producedKg: 20000 });
    b.applyCorrect();
    eq('produced cannot go below what the lab certified', b.state.batches[0].producedKg, 35400);
    ok('...naming the certified quantity', b.toasts.some(t => /certified 38800 Kg/.test(t)),
       JSON.stringify(b.toasts));
    const z = box('Plant Manager', HG());
    z.correctForm = form({ producedKg: '' });
    z.applyCorrect();
    eq('and an empty box, which reads as zero, is refused too', z.state.batches[0].producedKg, 35400);
  }
  /* A batch with no lots has no shift output to correct against. */
  {
    const nolots = Object.assign(HG(), { lots: [], producedKg: 5000 });
    const b = box('Plant Manager', nolots);
    b.correctForm = form({ producedKg: 999999 });
    b.applyCorrect();
    eq('a batch with no lots cannot have its produced total raised', b.state.batches[0].producedKg, 5000);
    ok('...and is told to log the shift', b.toasts.some(t => /Log the shift that made the material/.test(t)),
       JSON.stringify(b.toasts));
  }
  /* disposed material counts as gone too */
  {
    const b = box('Plant Manager', Object.assign(HG(), { packedKg: 10000, disposedKg: 5000 }));
    b.correctForm = form({ producedKg: 12000 });
    b.applyCorrect();
    eq('packed plus disposed is the floor', b.state.batches[0].producedKg, 35400);
    ok('...and both are named', b.toasts.some(t => /10000 Kg packed/.test(t) && /5000 Kg disposed/.test(t)),
       JSON.stringify(b.toasts));
  }
  /* The other batch fields still behave. Note the batch record's own rule:
     amend is ['Production','COO'], so a field with no explicit roles list is
     Production's — the Plant Manager only reaches the two fields that name him
     (the batch number, and now the produced total). That asymmetry is deliberate
     and this pins it. */
  {
    /* The plan is the 105% over-production ceiling submitShiftLog enforces, so
       Production amending its own plan is Production raising its own limit —
       the same objection as the produced total. Plant Manager or COO. */
    const b = box('Production', HG());
    b.correctForm = form({ plannedKg: 40000 });
    b.applyCorrect();
    eq('Production cannot raise its own over-production ceiling',
       b.state.batches[0].plannedKg, 50000);
    const c = box('Plant Manager', HG());
    c.correctForm = form({ plannedKg: 40000 });
    c.applyCorrect();
    eq('the Plant Manager can correct the plan', c.state.batches[0].plannedKg, 40000);
    ok('and that does not report a packable change',
       !(c.state.corrections[0].cascade || []).some(x => /Ready to pack/.test(x)),
       JSON.stringify(c.state.corrections[0].cascade));
    /* Production keeps the one field that is genuinely its own record-keeping */
    const d = box('Production', HG());
    d.correctForm = form({ openedDate: '2026-08-02' });
    d.applyCorrect();
    eq('Production keeps the opened date', d.state.batches[0].openedDate, '2026-08-02');
  }
  ok('GUARD: the produced field is Plant Manager / COO, not Production',
     /k:'producedKg'[\s\S]{0,120}roles:\['Plant Manager','COO'\]/.test(H.html));
  ok('GUARD: and it carries a value check', /k:'producedKg'[\s\S]{0,200}checkIf:/.test(H.html));
  ok('GUARD: applyCorrect asks checkIf before it writes',
     /checkIf\?x\.checkIf\(tgt,after\)/.test(H.grab('applyCorrect'))
     && H.grab('applyCorrect').indexOf('checkIf') < H.grab('applyCorrect').indexOf('changes.push'));
}

/* ================= 3. the void that caused it, refused ================= */
{
  const src = ['_voidBlockedBy', '_voidReverseBatch'].map(H.grab).join('\n\n');
  function box(batch) {
    const b = { console, Math, JSON, state: { batches: [batch] } };
    b.globalThis = b; vm.createContext(b); vm.runInContext(src, b); return b;
  }
  const entry = (kg, over) => Object.assign({ batchNo: 'HG26025', base: 'Potassium Humate', kg }, over || {});

  {
    const b = box(HG());
    const msg = b._voidBlockedBy(entry(3400));
    ok('voiding output the lab has certified is refused', !!msg, String(msg));
    ok('...naming the lot', /HG26025-L7/.test(msg || ''), String(msg));
    ok('...and saying what to do instead', /dispose of it/.test(msg || ''), String(msg));
  }
  /* an uncertified lot of the same size may still be voided — the reversal is honest */
  {
    const withOpen = HG();
    withOpen.lots.push({ id: 'LOT9', lotNo: 'HG26025-L9', qty: 3400, coa: null });
    const b = box(withOpen);
    eq('an uncertified lot of the same size is still voidable', b._voidBlockedBy(entry(3400)), null);
  }
  /* a size nothing matches is not blocked by this rule */
  {
    const b = box(HG());
    eq('a quantity no lot matches is not blocked here', b._voidBlockedBy(entry(1234)), null);
  }
  /* and it survives a state with nothing in it */
  {
    const b = { console, Math, JSON, state: { batches: [] } };
    b.globalThis = b; vm.createContext(b); vm.runInContext(src, b);
    eq('no batch found — nothing to block', b._voidBlockedBy(entry(3400)), null);
    eq('no entry at all — nothing to block', b._voidBlockedBy(null), null);
  }
  /* THE OLD BEHAVIOUR, pinned so it cannot come back: the reversal leaves a
     certified lot alone but still takes the quantity off the total. That is why
     the refusal has to sit in front of it. */
  {
    const b = box(HG());
    b._voidReverseBatch(entry(3400));
    eq('unguarded, the reversal still leaves the certified lot', b.state.batches[0].lots.length, 8);
    eq('...while removing the quantity — the mismatch itself',
       b.state.batches[0].producedKg, 32000);
  }
  ok('GUARD: voidProdEntry asks before it writes anything',
     /_voidBlockedBy\(p\); if\(blocked\)/.test(H.grab('voidProdEntry'))
     && H.grab('voidProdEntry').indexOf('_voidBlockedBy') < H.grab('voidProdEntry').indexOf('typeNameToConfirm'));
}

/* ================= 4. a refusal must not leave half a write behind ================= */
/* applyCorrect writes each field as it goes and only asks about `refused` after
   the loop. A refusal on a later field used to leave the earlier ones changed in
   state and absent from the register — a silent edit, which is the one thing the
   correction module exists to make impossible. It is newly reachable because a
   checkIf field renders as an ordinary editable box, where a lockedIf field
   renders disabled and never reaches the loop. */
{
  const src = ['batchClearedKg', 'batchPackableKg', 'recordCorrection', 'correctTypeLabel',
               'correctReasonText', 'correctTarget', 'correctFieldOK', 'correctCanAmend',
               'correctAllowed', 'correctAnyField', 'applyCorrect', 'nid', 'logAction',
               'hardRole', 'canEdit'].map(H.grab).join('\n\n')
            + '\n' + H.grabObj('CORRECT_REASONS') + '\n' + H.grabObj('CORRECT_ENTITY');
  function box(role, batch) {
    const b = { console, Math, JSON, Date,
      state: { role, currentUser: { name: 'A Person', username: 'ap' }, seq: 1, screen: 'prod',
               corrections: [], audit: [], actionLog: [], batches: [batch],
               orders: [], packingLog: [], shipments: [] },
      toasts: [], saved: 0, toast: m => b.toasts.push(m), logAction: () => {},
      save: () => { b.saved++; }, closeModal: () => {}, render: () => {},
      fmt: n => String(n), shortClient: c => String(c || ''), _pe: v => String(v == null ? '' : v) };
    b.globalThis = b; vm.createContext(b); vm.runInContext(src, b); return b;
  }
  const b = box('COO', Object.assign(HG(), { openedDate: '2026-08-01' }));
  b.correctForm = { type: 'batch', id: 'B-HG26025', op: 'AMEND', reasonCode: 'keying',
    reason: 'Changing two things at once, and the second one is wrong.',
    vals: { openedDate: '2026-08-03', producedKg: 45000 } };
  b.applyCorrect();
  eq('the bad field is refused', b.state.batches[0].producedKg, 35400);
  eq('AND THE GOOD ONE IS PUT BACK — no silent edit', b.state.batches[0].openedDate, '2026-08-01');
  eq('nothing reaches the register', b.state.corrections.length, 0);
  eq('and nothing is saved', b.saved, 0);
  /* the same submit with both values sound writes both */
  const c = box('COO', Object.assign(HG(), { openedDate: '2026-08-01' }));
  c.correctForm = { type: 'batch', id: 'B-HG26025', op: 'AMEND', reasonCode: 'keying',
    reason: 'Both of these are right this time, so both should land.',
    vals: { openedDate: '2026-08-03', producedKg: 38800 } };
  c.applyCorrect();
  eq('a sound submit writes the date', c.state.batches[0].openedDate, '2026-08-03');
  eq('...and the quantity', c.state.batches[0].producedKg, 38800);
  eq('...and records both', c.state.corrections[0].changes.length, 2);
  ok('GUARD: applyCorrect puts earlier writes back on a refusal',
     /if\(refused\)\{[\s\S]{0,600}changes\.forEach\(function\(c\)\{ tgt\[c\.field\]=c\.before; \}\);/
       .test(H.grab('applyCorrect')), 'no rollback found');
}

/* ================= 5. a PO batch keeps its order line in step ================= */
/* submitShiftLog raises the batch and the line together; voidProdEntry lowers
   both. Correcting only the batch would leave the PO Tracker reporting the old
   figure — and would hand the over-run guard the wrong remaining quantity, so
   Production could log past the ordered amount without the app calling it one. */
{
  const src = ['batchClearedKg', 'batchPackableKg', 'recordCorrection', 'correctTypeLabel',
               'correctReasonText', 'correctTarget', 'correctFieldOK', 'correctCanAmend',
               'correctAllowed', 'correctAnyField', 'applyCorrect', 'nid', 'logAction',
               'hardRole', 'canEdit'].map(H.grab).join('\n\n')
            + '\n' + H.grabObj('CORRECT_REASONS') + '\n' + H.grabObj('CORRECT_ENTITY');
  function box(batch, order) {
    const b = { console, Math, JSON, Date,
      state: { role: 'COO', currentUser: { name: 'A Person' }, seq: 1, screen: 'prod',
               corrections: [], audit: [], actionLog: [], batches: [batch],
               orders: order ? [order] : [], packingLog: [], shipments: [] },
      toasts: [], toast: m => b.toasts.push(m), logAction: () => {}, save: () => {},
      closeModal: () => {}, render: () => {},
      fmt: n => String(n), shortClient: c => String(c || ''), _pe: v => String(v == null ? '' : v) };
    b.globalThis = b; vm.createContext(b); vm.runInContext(src, b); return b;
  }
  const poBatch = () => Object.assign(HG(), { kind: 'po', po: 'PO-1', lineId: 'L1',
    producedKg: 15000, lots: [{ id: 'x', lotNo: 'B-L1', qty: 18000, coa: { status: 'approved', certifiedKg: 18000 } }] });
  const order = () => ({ id: 'O1', po: 'PO-1', client: 'X',
    lines: [{ id: 'L1', brand: 'Humi Grow', ordered: 20000, produced: 15000, packed: 0, prodComplete: '' }] });

  const b = box(poBatch(), order());
  b.correctForm = { type: 'batch', id: 'B-HG26025', op: 'AMEND', reasonCode: 'keying',
    reason: 'The produced total lost 3,000 Kg to a void.', vals: { producedKg: 18000 } };
  b.applyCorrect();
  const line = b.state.orders[0].lines[0];
  eq('the batch is corrected', b.state.batches[0].producedKg, 18000);
  eq('AND THE ORDER LINE FOLLOWS', line.produced, 18000);
  ok('the register says the line moved too',
     (b.state.corrections[0].cascade || []).some(x => /PO-1.*15000 → 18000/.test(x)),
     JSON.stringify(b.state.corrections[0].cascade));
  /* the over-run guard now sees the truth: 2,000 left, not 5,000 */
  eq('so the remaining quantity the over-run guard uses is right',
     (line.ordered || 0) - (line.produced || 0), 2000);
  /* correcting downward moves it back, and never below what is packed */
  {
    const c = box(Object.assign(poBatch(), { producedKg: 18000 }),
                  Object.assign(order(), { lines: [{ id: 'L1', brand: 'Humi Grow', ordered: 20000, produced: 18000, packed: 16000, prodComplete: '2026-08-01' }] }));
    c.state.batches[0].packedKg = 16000;
    c.state.batches[0].lots = [{ id: 'x', lotNo: 'B-L1', qty: 18000, coa: { status: 'approved', certifiedKg: 17000 } }];
    c.correctForm = { type: 'batch', id: 'B-HG26025', op: 'AMEND', reasonCode: 'keying',
      reason: 'Overstated by a thousand kilos on the last shift.', vals: { producedKg: 17000 } };
    c.applyCorrect();
    eq('a downward correction follows too', c.state.orders[0].lines[0].produced, 17000);
    ok('and the completion flag is cleared when it is no longer complete',
       c.state.orders[0].lines[0].prodComplete === '');
  }
  /* a bulk batch has no line to move, and must not go looking for one */
  {
    const c = box(HG(), order());
    c.correctForm = { type: 'batch', id: 'B-HG26025', op: 'AMEND', reasonCode: 'keying',
      reason: 'A bulk batch, no PO line behind it at all.', vals: { producedKg: 38800 } };
    c.applyCorrect();
    eq('a bulk correction leaves every order line alone', c.state.orders[0].lines[0].produced, 15000);
    ok('...and says nothing about a PO',
       !(c.state.corrections[0].cascade || []).some(x => /PO-1/.test(x)),
       JSON.stringify(c.state.corrections[0].cascade));
  }
}

/* ================= 6. a multi batch is the same hole, one kind along ================= */
/* A multi batch splits one shift across several POs, so its productionLog rows
   carry a SHARE and no lot ever equals one. Matching on size finds nothing and
   waves the void through. */
{
  const src = ['_voidBlockedBy', '_voidReverseBatch'].map(H.grab).join('\n\n');
  function box(batch) {
    const b = { console, Math, JSON, state: { batches: [batch] } };
    b.globalThis = b; vm.createContext(b); vm.runInContext(src, b); return b;
  }
  const multi = () => ({ id: 'B-MB1', batchNo: 'MB1', base: 'Potassium Humate', kind: 'multi',
    status: 'open', plannedKg: 10000, producedKg: 5000, packedKg: 0, disposedKg: 0,
    lots: [{ id: 'L', lotNo: 'MB1-L1', qty: 5000, coa: { status: 'approved', certifiedKg: 5000 } }] });
  const b = box(multi());
  const msg = b._voidBlockedBy({ batchNo: 'MB1', base: 'Potassium Humate', kg: 3000 });
  ok('a share-sized entry on a certified multi batch is refused', !!msg, String(msg));
  ok('...naming the lot and the batch', /MB1-L1/.test(msg || '') && /MB1/.test(msg || ''), String(msg));
  ok('...and saying why a single entry cannot be pulled out',
     /split across several POs/.test(msg || ''), String(msg));
  /* nothing certified on the multi batch — the void is honest and proceeds */
  {
    const open = multi(); open.lots[0].coa = null;
    eq('an uncertified multi batch is not blocked',
       box(open)._voidBlockedBy({ batchNo: 'MB1', base: 'Potassium Humate', kg: 3000 }), null);
  }
  /* and the message on an ordinary batch names its batch too */
  {
    const c = box(HG());
    ok('the ordinary refusal names the batch as well as the lot',
       /on batch HG26025/.test(c._voidBlockedBy({ batchNo: 'HG26025', base: 'Potassium Humate', kg: 3400 }) || ''));
  }
}

/* ================= 7. there is a way in ================= */
/* The whole batch entity — batch #, opened date, planned, produced — used to be
   reachable only from a card that lists batches WITHOUT a batch number. Every
   batch in the data on record has one, so there was no route at all: the fix for
   HG26025 existed and could not be opened. */
{
  const b = { console, Math, JSON,
    state: { role: 'Plant Manager', masters: {} },
    _pe: v => String(v == null ? '' : v) };
  b.globalThis = b; vm.createContext(b);
  vm.runInContext(['correctAllowed', 'correctFieldOK', 'correctAnyField', 'correctCanAmend',
                   'hardRole', 'canEdit', '_pcCorrectBtn'].map(H.grab).join('\n\n')
                  + '\n' + H.grabObj('CORRECT_ENTITY'), b);
  const batch = { id: 'B-HG26025', batchNo: 'HG26025' };
  ['Plant Manager', 'Production', 'COO'].forEach(r => {
    b.state.role = r;
    const html = b._pcCorrectBtn(batch);
    ok(r + ' gets a way into the batch correction', /openCorrect\('batch','B-HG26025'\)/.test(html), html);
  });
  ['KAM', 'Lab Rep', 'Supply Chain', 'CFO', 'QA Inspector'].forEach(r => {
    b.state.role = r;
    eq('...and ' + r + ' does not', b._pcCorrectBtn(batch), '');
  });
  { /* Every exit from _pcLifeAction must carry it, or the button appears on some
       stages and not others — and HG26025 was closed, the one stage where the old
       code returned early. Anchored on each exit's own text rather than a regex
       over `return`, because the closed-batch string contains `&times;` and a
       naive match stops at that semicolon. */
    const life = H.grab('_pcLifeAction');
    [['closed batch', /\+_rr\+_pcCorrectBtn\(b\)/],
     ['not-editable', /if\(!edAny\)return _cb;/],
     ['pool',         /Call for manufacturing<\/button>':''\)\+_cb;/],
     ['the main row', /return primary\+sec\+_cb;/]].forEach(([name, re]) =>
      ok('the ' + name + ' exit carries the Correct button', re.test(life), life.slice(0, 160)));
    ok('...and there is no exit that returns nothing at all',
       !/return '';/.test(life), (life.match(/return '';/g) || []).length + " bare empty return(s)"); }
  ok('GUARD: including on a closed batch, which is where HG26025 was',
     /_rr\+_pcCorrectBtn\(b\)/.test(H.grab('_pcLifeAction')));
  ok('GUARD: and it is outside the Production-only edit flag',
     /var _cb=_pcCorrectBtn\(b\);[\s\S]{0,900}if\(!edAny\)return _cb;/.test(H.grab('_pcLifeAction')),
     H.grab('_pcLifeAction').slice(0, 200));
}

/* ================= 8. the routes in, for a batch at every stage ================= */
/* The action row only exists while a batch is on the floor — open, or closed
   with something left to pack or reconcile. Once the last kilo is packed the
   batch lives ONLY on the closed-batches card, which is where a Plant Manager
   looking at a finished batch goes. Without a button there, the correction built
   for HG26025 would have stopped working the week its 35,400 Kg was packed. */
{
  const src = ['batchClearedKg', 'batchPackableKg', 'batchRemainderKg', 'activeFloorBatches',
               'correctAllowed', 'correctFieldOK', 'correctAnyField', 'correctCanAmend',
               'hardRole', 'canEdit', '_pcCorrectBtn'].map(H.grab).join('\n\n')
            + '\n' + H.grabObj('CORRECT_ENTITY');
  const b = { console, Math, JSON, state: { role: 'Plant Manager', masters: {}, batches: [] },
              _pe: v => String(v == null ? '' : v) };
  b.globalThis = b; vm.createContext(b); vm.runInContext(src, b);

  /* HG26025 once its released stock has been packed: nothing packable, nothing
     to reconcile — it drops off the floor entirely. */
  const packedOut = Object.assign(HG(), { packedKg: 35400 });
  b.state.batches = [packedOut];
  eq('setting up: fully packed, nothing left to pack', b.batchPackableKg(packedOut), 0);
  eq('...and nothing to reconcile', b.batchRemainderKg(packedOut), 0);
  eq('so it is NOT on the floor any more', b.activeFloorBatches().length, 0);
  ok('the closed-batches card still offers Correct on it',
     /openCorrect\('batch','B-HG26025'\)/.test(b._pcCorrectBtn(packedOut)));
  ok('GUARD: the closed-batches row really carries the button',
     /:'<span class="muted" style="font-size:10\.5px">Plant Manager reopens<\/span>'\)\s*[\s\S]{0,600}\+_pcCorrectBtn\(b\)/
       .test(H.grab('closedBatchesCard')), H.grab('closedBatchesCard').slice(-300));
  ok('...next to Reopen, not instead of it',
     /openReopenBatch/.test(H.grab('closedBatchesCard')));
  /* and the batch as it stands today, still packable, is on the floor */
  b.state.batches = [HG()];
  eq('while it still has packable stock it is on the floor', b.activeFloorBatches().length, 1);
}

/* ================= 9. a batch cannot be "reversed" ================= */
/* The batch entity has no doReverse, so applyCorrect used to fall through to
   rec.reversed=true — and `.reversed` is read only on packing runs, never on a
   batch. The Plant Manager was told the batch had been reversed and struck
   through while it carried on producing, packing and shipping. Unreachable
   before the Correct button; two clicks away the moment it landed. */
{
  const src = ['batchClearedKg', 'batchPackableKg', 'recordCorrection', 'correctTypeLabel',
               'correctReasonText', 'correctTarget', 'correctFieldOK', 'correctCanAmend',
               'correctAllowed', 'correctAnyField', 'applyCorrect', 'nid', 'logAction',
               'hardRole', 'canEdit'].map(H.grab).join('\n\n')
            + '\n' + H.grabObj('CORRECT_REASONS') + '\n' + H.grabObj('CORRECT_ENTITY');
  function box(role) {
    const b = { console, Math, JSON, Date,
      state: { role, currentUser: { name: 'P' }, seq: 1, screen: 'prod', corrections: [],
               audit: [], actionLog: [], batches: [HG()], orders: [], packingLog: [], shipments: [] },
      toasts: [], toast: m => b.toasts.push(m), logAction: () => {}, save: () => {},
      closeModal: () => {}, render: () => {},
      fmt: n => String(n), shortClient: c => String(c || ''), _pe: v => String(v == null ? '' : v) };
    b.globalThis = b; vm.createContext(b); vm.runInContext(src, b); return b;
  }
  ['Plant Manager', 'COO', 'Production'].forEach(r => {
    const b = box(r);
    b.correctForm = { type: 'batch', id: 'B-HG26025', op: 'REVERSE', reasonCode: 'keying',
      reason: 'Trying to reverse a batch, which must not be possible.', vals: {} };
    b.applyCorrect();
    ok('nobody can reverse a batch — ' + r, b.state.batches[0].reversed !== true,
       'reversed=' + b.state.batches[0].reversed);
    eq('...and no false record is written — ' + r, b.state.corrections.length, 0);
  });
  ok('GUARD: the batch entity grants REVERSE to nobody',
     /amend:\['Production','COO'\], reverse:\[\]/.test(H.grabObj('CORRECT_ENTITY')));
  /* amending it still works — the two are separate authorities */
  const c = box('Plant Manager');
  c.correctForm = { type: 'batch', id: 'B-HG26025', op: 'AMEND', reasonCode: 'keying',
    reason: 'And amending a batch still works, which is the point.', vals: { producedKg: 38800 } };
  c.applyCorrect();
  eq('but amending a batch still works', c.state.batches[0].producedKg, 38800);
}

/* ================= 10. the two shapes that are not corrections ================= */
{
  const src = ['batchClearedKg', 'batchPackableKg', 'recordCorrection', 'correctTypeLabel',
               'correctReasonText', 'correctTarget', 'correctFieldOK', 'correctCanAmend',
               'correctAllowed', 'correctAnyField', 'applyCorrect', 'nid', 'logAction',
               'hardRole', 'canEdit'].map(H.grab).join('\n\n')
            + '\n' + H.grabObj('CORRECT_REASONS') + '\n' + H.grabObj('CORRECT_ENTITY');
  function box(batch, order) {
    const b = { console, Math, JSON, Date, TODAY: new Date('2026-08-25T00:00:00Z'),
      state: { role: 'Plant Manager', currentUser: { name: 'P' }, seq: 1, screen: 'prod',
               corrections: [], audit: [], actionLog: [], batches: [batch],
               orders: order ? [order] : [], packingLog: [], shipments: [] },
      toasts: [], toast: m => b.toasts.push(m), logAction: () => {}, save: () => {},
      closeModal: () => {}, render: () => {},
      fmt: n => String(n), shortClient: c => String(c || ''), _pe: v => String(v == null ? '' : v) };
    b.globalThis = b; vm.createContext(b); vm.runInContext(src, b); return b;
  }
  const F = v => ({ type: 'batch', id: 'B-HG26025', op: 'AMEND', reasonCode: 'keying',
                    reason: 'A perfectly ordinary sentence of explanation.', vals: { producedKg: v } });

  /* An empty box reads as 0. On an UNCERTIFIED batch the certified floor is 0,
     so nothing else would catch it — and when the lab later certifies, the
     HG26025 condition comes straight back. */
  {
    const un = HG(); un.lots = un.lots.map(l => Object.assign({}, l, { coa: null }));
    const b = box(un);
    b.correctForm = F('');
    b.applyCorrect();
    eq('a blank box on a batch with lots is refused, certified or not',
       b.state.batches[0].producedKg, 35400);
    ok('...and says what to do instead', b.toasts.some(t => /void them|dispose of it/.test(t)),
       JSON.stringify(b.toasts));
  }
  /* A multi batch spreads output across POs by allocation; the mirror only
     follows a single line, so correcting the total would strand the others. */
  {
    const m = Object.assign(HG(), { kind: 'multi', allocations: [{ oid: 'O1', lid: 'L1', kg: 10000 }] });
    const b = box(m);
    b.correctForm = F(38800);
    b.applyCorrect();
    eq('a multi batch is refused until the mirror handles allocations',
       b.state.batches[0].producedKg, 35400);
    ok('...and says why', b.toasts.some(t => /several POs by allocation/.test(t)),
       JSON.stringify(b.toasts));
  }
  /* An upward correction that completes the line must SET prodComplete, not just
     leave it blank — submitShiftLog does, and a blank leaves the line on
     worklists as unfinished. */
  {
    const po = Object.assign(HG(), { kind: 'po', po: 'PO-1', lineId: 'L1', producedKg: 15000,
      lots: [{ id: 'x', lotNo: 'L1', qty: 20000, coa: { status: 'approved', certifiedKg: 20000 } }] });
    const order = { id: 'O1', po: 'PO-1', lines: [{ id: 'L1', brand: 'B', ordered: 20000, produced: 15000, packed: 0, prodComplete: '' }] };
    const b = box(po, order);
    b.correctForm = F(20000);
    b.applyCorrect();
    eq('the line reaches its ordered quantity', b.state.orders[0].lines[0].produced, 20000);
    ok('and production is marked complete, not left blank',
       !!b.state.orders[0].lines[0].prodComplete, JSON.stringify(b.state.orders[0].lines[0]));
  }
  /* The line's produced can never fall below what it has packed. */
  {
    const po = Object.assign(HG(), { kind: 'po', po: 'PO-1', lineId: 'L1', producedKg: 20000, packedKg: 12000,
      lots: [{ id: 'x', lotNo: 'L1', qty: 20000, coa: { status: 'approved', certifiedKg: 12000 } }] });
    const order = { id: 'O1', po: 'PO-1', lines: [{ id: 'L1', brand: 'B', ordered: 20000, produced: 20000, packed: 18000, prodComplete: '2026-08-01' }] };
    const b = box(po, order);
    b.correctForm = F(13000);
    b.applyCorrect();
    eq('the batch is corrected down', b.state.batches[0].producedKg, 13000);
    eq('but the line never goes below what it has packed',
       b.state.orders[0].lines[0].produced, 18000);
  }
}

console.log('\nHG26025 — produced-quantity correction and the certified-lot void: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
