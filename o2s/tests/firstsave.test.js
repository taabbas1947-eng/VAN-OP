/* Measures two live save-path defects found during the printing-slip review.
   Nothing here is about the slip. These are reachable in the app today.

   1. `_baseSnapshot` is never set when the app boots. On the FIRST save of a
      session, if somebody else saved in between, the merge is run with
      base === local, every leaf then satisfies _eq(local, base), and the
      server's value wins on every field the person just edited.

   2. `_savePending` is only cleared inside `if(r.ok)`. A network error, a 500,
      or a 6th conflict leaves it true, and startSync() returns early on
      `if(_savePending) return` — so that tab stops pulling the team's changes
      for the rest of the session, silently.

   Run: node firstsave.test.js */
const H = require('./harness.js');
const vm = require('vm');

const src = ['_arrId', '_eq', 'merge3'].map(H.grab).join('\n\n');
const box = { console };
vm.createContext(box);
vm.runInContext(src, box);
const merge3 = box.merge3;

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, got, want) { ok(n, JSON.stringify(got) === JSON.stringify(want),
  'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); }

/* ---- 1. first save of a session, edit to an EXISTING record ---- */
{
  /* Server and this tab both loaded rev 10. The tab's user edits an existing
     order line; somebody else saved something unrelated first, so this save
     comes back 409. */
  const server = { orders: [{ id: 'O1', po: '22032', ack: false, lines: [{ id: 'L1', ordered: 2000 }] }] };
  const local  = { orders: [{ id: 'O1', po: '22032', ack: true,  lines: [{ id: 'L1', ordered: 2000 }] }] };

  /* what the code does today: base = _baseSnapshot || dataOnly(state), and
     _baseSnapshot is null because bootState never calls _snapBase(). */
  const brokenBase = local;
  const broken = merge3(brokenBase, local, server);
  eq('BUG 1 today: the acknowledgement the person just made is thrown away',
     broken.orders[0].ack, false);

  /* with the baseline pinned at boot, as it is after every successful save */
  const goodBase = { orders: [{ id: 'O1', po: '22032', ack: false, lines: [{ id: 'L1', ordered: 2000 }] }] };
  const fixed = merge3(goodBase, local, server);
  eq('BUG 1 fixed: the acknowledgement survives', fixed.orders[0].ack, true);
}

/* a NEW record added in the same first save is not affected — which is why
   this has never been noticed. Only edits to existing rows are lost. */
{
  const server = { orders: [{ id: 'O1', po: '22032' }] };
  const local  = { orders: [{ id: 'O1', po: '22032' }, { id: 'O2', po: '22099' }] };
  const broken = merge3(local, local, server);
  eq('BUG 1: a newly ADDED record still survives (why this stayed hidden)',
     broken.orders.length, 2);
}

/* the same defect on a number the floor cares about */
{
  const server = { batches: [{ id: 'B1360', batchNo: 'MAXM26001', packedKg: 1500 }] };
  const local  = { batches: [{ id: 'B1360', batchNo: 'MAXM26001', packedKg: 2000 }] };
  const broken = merge3(local, local, server);
  eq('BUG 1: 500 Kg of packing entered and lost on the first save of the day',
     broken.batches[0].packedKg, 1500);
}

/* ---- 2. bare audit rows destroy each other ---- */
{
  /* Rows written straight into state.audit carry no id until ensureState runs,
     which happens AFTER the merge. One id-less row makes the whole array fall
     to the leaf rule and one side is discarded wholesale. */
  const base   = { audit: [{ id: 'AU1', what: 'old' }] };
  const server = { audit: [{ id: 'AU1', what: 'old' }, { t: 'z', user: 'Zain', what: 'DC 118 approved' }] };
  const local  = { audit: [{ id: 'AU1', what: 'old' }, { t: 'z', user: 'Asma', what: 'slip signed 1500' }] };
  const out = merge3(base, local, server);
  ok("BUG 3: Zain's audit row is gone after the merge",
     !out.audit.some(r => r.what === 'DC 118 approved'),
     JSON.stringify(out.audit));
  eq('BUG 3: only the local side survives', out.audit.length, 2);
}

/* ---- 3. partial ids on one array lose rows in BOTH directions ---- */
{
  const base   = { rows: [] };
  const withId    = { rows: [{ id: 'A', v: 1 }, { id: 'B', v: 2 }] };
  const oneNoId   = { rows: [{ id: 'A', v: 1 }, { v: 9 }] };
  const a = merge3(base, withId, oneNoId);
  ok('BUG 4: server row without an id is dropped and nothing says so',
     !a.rows.some(r => r.v === 9), JSON.stringify(a.rows));
  const b = merge3(base, oneNoId, withId);
  ok("BUG 4: one local row without an id discards the server's whole array",
     b.rows.length === 2 && !b.rows.some(r => r.id === 'B'), JSON.stringify(b.rows));
}

/* ---- 4. clearing a field by delete/undefined puts it back ---- */
{
  const base   = { slip: { id: 'S1', signedBy: 'Asma' } };
  const server = { slip: { id: 'S1', signedBy: 'Asma' } };
  const local  = { slip: { id: 'S1' } };          // signedBy removed, not nulled
  const out = merge3(base, local, server);
  eq('BUG 5: a withdrawn signature comes back, because undefined means absent',
     out.slip.signedBy, 'Asma');
  const local2 = { slip: { id: 'S1', signedBy: null } };
  const out2 = merge3(base, local2, server);
  eq('BUG 5 fixed: clearing to null actually clears', out2.slip.signedBy, null);
}

/* ---- 5. two people, one running total ---- */
{
  const base   = { line: { id: 'L1', dispatched: 0 } };
  const server = { line: { id: 'L1', dispatched: 3000 } };   // truck approved
  const local  = { line: { id: 'L1', dispatched: 500 } };    // correction booked
  const out = merge3(base, local, server);
  eq('BUG 6: two people move one running total, one of them vanishes',
     out.line.dispatched, 500);
}

/* ---- 6. after the 22-Aug fix: audit rows carry ids, so both sides survive ---- */
{
  const base   = { audit: [{ id: 'AU1', what: 'old' }] };
  const server = { audit: [{ id: 'AU1', what: 'old' }, { id: 'AU9', user: 'Zain', what: 'DC 118 approved' }] };
  const local  = { audit: [{ id: 'AU1', what: 'old' }, { id: 'AU7', user: 'Asma', what: 'MRP set 1500' }] };
  const out = merge3(base, local, server);
  eq('FIXED: with ids on every row, both audit rows survive', out.audit.length, 3);
  ok("FIXED: Zain's row is still there",
     out.audit.some(r => r.what === 'DC 118 approved'), JSON.stringify(out.audit));
}

/* Guard, not proof: the one live writer into state.audit must keep its id.
   Every row loaded from the server is id'd by ensureRecordIds, so this writer
   is the only thing that can drop the array off the id-matching path. */
{
  const line = /state\.audit\.unshift\(\{[^}]*\}\)/.exec(H.html);
  ok('GUARD: the PO Tracker audit writer still mints an id',
     !!line && /id:\s*nid\('AU'\)/.test(line[0]), line ? line[0].slice(0, 90) : 'writer not found');
  const others = (H.html.match(/audit\.unshift\(|audit\.push\(/g) || []).length;
  ok('GUARD: still only four writers into state.audit (3 are spent one-time migrations)',
     others === 4, 'found ' + others);
}

console.log('\nSave-path defects (measured against the real merge3): ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
