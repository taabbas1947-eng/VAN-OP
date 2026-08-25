/* Two fixes, 22-24 August 2026.

   1. The Data Fix writers had no permission check. dfSubmitCorrect had none at
      all; neither did the four backfill writers or the snapshot export. (The
      five functions that DID carry a check are the console controls -
      toggleDataFix, importGoLivePOs, startNewYearClean, importSnapshotStart and
      importSnapshotApply. The first version of this file claimed they were
      dfSubmitCorrect's siblings. They are not, and the claim is corrected here
      and in the app's own comment.)
   2. The bulk print-on-pack screen could set every open PO to "no price" with
      no question asked, and had a "Set all to no price" button above the list.
      "No" is the one answer that disarms a control.

   A third change - ids on customers and dealers - was REFUSED on review and is
   parked. Its tests are in PARKED-customer-ids.test.js; the reasons are in
   docs/o2s/parked-customer-ids/WHAT-WENT-WRONG.md. Do not restart that work
   from the tests alone.

   Run: node threefixes.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

const SCREENS_SRC = (function () {
  const i = H.html.indexOf('const SCREENS=');
  if (i < 0) throw new Error('SCREENS not found');
  return H.matchBlock(i, 'SCREENS', '[').replace(/^const /, 'var ') + ';';
})();

/* ============ 1. the Data Fix gate ============ */
{
  /* Named one by one. A count ("all six carry it") is a number that goes stale
     and then gets quoted as fact — which is exactly how the false claim in the
     first version survived. */
  const GATED = ['dfSubmitCorrect', 'dfSubmitPO', 'dfSubmitPacking',
                 'dfSubmitProduction', 'dfSubmitShipment', 'exportStateJSON'];
  GATED.forEach(fn => {
    let body = '';
    try { body = H.grab(fn); } catch (e) { /* reported by the check */ }
    ok('GUARD: ' + fn + ' asks screenEditOK(\'datafix\')',
       !!body && /screenEditOK\('datafix'\)/.test(body),
       body ? 'gate not found in ' + fn : fn + ' not found at all');
  });
  /* And the console controls keep theirs. */
  ['toggleDataFix', 'importGoLivePOs', 'startNewYearClean',
   'importSnapshotStart', 'importSnapshotApply'].forEach(fn => {
    ok('GUARD: console control ' + fn + ' still gated',
       /screenEditOK\('datafix'\)/.test(H.grab(fn)));
  });

  const src = ['accessOv', '_ownerEdit', 'accessLevelOn', 'accessLevel', 'screenEditOK', 'dfSubmitCorrect']
                .map(H.grab).join('\n\n') + '\n' + SCREENS_SRC;
  function box(role, tweak) {
    const b = {
      console, Date, JSON,
      state: { role, masters: JSON.parse(JSON.stringify(STATE.masters)),
               orders: [{ id: 'O1', po: 'P1', lines: [{ id: 'L1', brand: 'X' }] }] },
      dfForm: { oid: 'O1', reason: 'R' },
      scr: id => b.SCREENS.find(s => s.id === id),
      toasts: [], toast: m => b.toasts.push(m),
      /* Every field the function reads is filled in, INCLUDING the reason code.
         The first version left co_reasonCode blank, so the write was stopped by
         "Pick a reason" and the refusal checks passed for the wrong reason —
         they would have passed with no gate at all. */
      $: id => ({ value: id === 'co_printDecision' ? 'no'
                       : id === 'co_reasonCode' ? 'DATA-ENTRY'
                       : id === 'co_reason' ? 'testing the gate' : '' }),
      save: () => {}, closeModal: () => {}, render: () => {},
      logAction: () => {}, recordCorrection: () => {}, dfReasonOk: () => true,
      isCorrection: () => true, nid: p => p + '1',
      shortClient: c => String(c || ''), fmt: n => String(n), dfBack: () => {},
      CORRECT_REASONS: [{ code: 'DATA-ENTRY', label: 'Data entry error' }],
    };
    if (tweak) tweak(b.state.masters.accessMatrix);
    b.globalThis = b; vm.createContext(b); vm.runInContext(src, b); return b;
  }
  const wrote = b => b.state.orders[0].printDecision;

  ['KAM', 'Supply Chain', 'QA Inspector', 'Lab Rep', 'CFO', 'Finance'].forEach(r => {
    const b = box(r);
    try { b.dfSubmitCorrect(); } catch (e) { /* refusal happens before any work */ }
    ok('Data Fix correct refuses ' + r, wrote(b) === undefined, 'wrote ' + wrote(b));
    ok('...and says why to ' + r, b.toasts.some(t => /Edit access to Data Fix/.test(t)),
       JSON.stringify(b.toasts));
  });

  /* THE CONTROL THAT MATTERS. Production holds datafix:{e:true} in the live
     matrix, so the gate must let it THROUGH — and this is a real answer from the
     matrix, not the COO short-circuit, which would pass whatever the predicate
     said. Take the grant away and the same role is refused. That pair is the
     only thing that proves the gate is reading the matrix at all. */
  {
    const grant = ((STATE.masters.accessMatrix || {})['Production'] || {}).datafix;
    ok('the live matrix really does grant Production Data Fix edit',
       !!(grant && grant.e === true), JSON.stringify(grant));
    const b = box('Production');
    b.dfSubmitCorrect();
    eq('Production HAS the grant, so the write lands', wrote(b), 'no');

    const b2 = box('Production', m => { m['Production'].datafix = { v: true, e: false }; });
    try { b2.dfSubmitCorrect(); } catch (e) {}
    eq('take the grant away and the SAME role is refused', wrote(b2), undefined);
  }
  { const b = box('COO'); b.dfSubmitCorrect();
    eq('and the COO is never locked out of a correction', wrote(b), 'no'); }
}

/* ============ 3. the bulk "no price" question ============ */
{
  const src = ['openPrintDecisionPOs', 'bulkPDAll', 'accessOv', '_ownerEdit', 'accessLevelOn', 'accessLevel',
               'screenEditOK', 'mayWork', 'whoMayEdit', 'denyWork', 'bulkPDWhoMay',
               'bulkPDMayAnswer', 'bulkPDDenied', 'saveBulkPrintDecision'].map(H.grab).join('\n')
  + '\n' + ['scr', 'accessOv', '_ownerEdit', 'accessLevelOn', 'accessLevel', 'screenEditOK', 'hardRole'].map(H.grab).join('\n')
  + '\n' + H.authModelSrc();
  function box(opts) {
    const b = {
      console, Date, JSON,
      state: { role: 'COO', currentUser: { name: 'tahir' }, orders: opts.orders,
               masters: { accessMatrix: {}, roles: [{ name: 'KAM' }] } },
      bulkPD: opts.pick, asked: [], toasts: [],
      confirm: m => { b.asked.push(m); return opts.answer; },
      recallPrintPrice: brand => (opts.history || []).indexOf(brand) >= 0 ? 1250 : 0,
      toast: m => b.toasts.push(m), logAction: () => {}, save: () => {},
      closeModal: () => {}, render: () => {}, renderBulkPrintDecision: () => {},
      scr: id => ({ id, name: id, owners: [] }),
    };
    b.globalThis = b; vm.createContext(b); vm.runInContext(src, b); return b;
  }
  const POS = () => ([
    { id: 'A', po: 'A', lines: [{ ordered: 100, brand: 'Max Humic' }] },
    { id: 'B', po: 'B', lines: [{ ordered: 100, brand: 'Enroot' }] },
  ]);
  {
    const b = box({ orders: POS(), pick: { A: 'no', B: 'no' },
                    history: ['Max Humic', 'Enroot'], answer: false });
    b.saveBulkPrintDecision();
    eq('it asks before setting POs to no price', b.asked.length, 1);
    ok('the question names how many POs', /2 POs/.test(b.asked[0]), b.asked[0]);
    ok('and names the products that normally carry a price',
       /Max Humic/.test(b.asked[0]) && /Enroot/.test(b.asked[0]), b.asked[0]);
    ok('and says what it does to QA', /FAILURE/.test(b.asked[0]), b.asked[0]);
    eq('answering no writes nothing at all', b.state.orders[0].printDecision, undefined);
    eq('...for either PO', b.state.orders[1].printDecision, undefined);
  }
  {
    const b = box({ orders: POS(), pick: { A: 'no', B: 'no' },
                    history: ['Max Humic'], answer: true });
    b.saveBulkPrintDecision();
    eq('answering yes writes the answer', b.state.orders[0].printDecision, 'no');
    eq('and the flag follows it', b.state.orders[0].printOnPack, false);
  }
  {
    const b = box({ orders: POS(), pick: { A: 'no' }, history: [], answer: false });
    b.saveBulkPrintDecision();
    eq('no question when no product has ever carried a price', b.asked.length, 0);
    eq('and it just writes', b.state.orders[0].printDecision, 'no');
  }
  {
    const b = box({ orders: POS(), pick: { A: 'list', B: 'yes' },
                    history: ['Max Humic', 'Enroot'], answer: false });
    b.saveBulkPrintDecision();
    eq('setting POs to a PRICE asks nothing', b.asked.length, 0);
    eq('and goes straight through', b.state.orders[0].printDecision, 'list');
  }
  ok('GUARD: the "Set all to no price" button is gone',
     !/bulkPDAll\(\\?'no\\?'\)/.test(H.html), 'the button is still there');
  ok('GUARD: the other two set-all buttons are still there',
     /bulkPDAll\(\\?'list\\?'\)/.test(H.html) && /bulkPDAll\(\\?'yes\\?'\)/.test(H.html));
}

console.log('\nTwo fixes — Data Fix gates, bulk no-price: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
