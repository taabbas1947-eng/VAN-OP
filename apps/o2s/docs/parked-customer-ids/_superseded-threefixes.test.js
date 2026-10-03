/* Three fixes, 22–24 August 2026.

   1. The Data Fix writers had no permission check. dfSubmitCorrect had none at
      all; so did the four backfill writers and the snapshot export. (The five
      functions that DID carry a check are the console controls — toggleDataFix,
      importGoLivePOs, startNewYearClean, importSnapshotStart/Apply. The first
      version of this file claimed they were dfSubmitCorrect's siblings. They
      are not, and the claim is corrected here and in the app's own comment.)
   2. customers and dealers carried no id on any row, so merge3 treated each
      array as one leaf and the last writer took the whole thing — two people
      editing the Customer Master silently deleted each other's work. Giving
      them ids is only half of it: every place that CREATES one of those rows
      has to mint an id too, custSave has to carry the id across an edit, and
      merge3 has to refuse the id path while the other browser is still on the
      old code. All four are tested below, because the first three were missing
      from the first attempt and the fix was a no-op at best.
   3. The bulk print-on-pack screen could set every open PO to "no price" with
      no question asked, and had a "Set all to no price" button above the list.
      "No" is the one answer that disarms a control.

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

/* The two field lists are pulled out of the app, not retyped. If somebody edits
   one of them the tests below move with it — a retyped copy would go on passing
   while the app and the test disagreed about what identifies a row. */
const IDFIELDS_SRC = (function () {
  const m = /\nvar CUST_ID_FIELDS=[^\n]*;/.exec(H.html);
  if (!m) throw new Error('CUST_ID_FIELDS not found — the shared field lists are gone');
  return m[0];
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

  const src = ['accessOv', '_ownerEdit', 'accessLevel', 'screenEditOK', 'dfSubmitCorrect']
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

/* ============ 2. ids on customers and dealers ============ */

/* 2a. the back-fill itself */
{
  const src = ['_hash', '_stableId', 'ensureIds'].map(H.grab).join('\n\n') + IDFIELDS_SRC;
  const mk = () => { const b = { console, JSON }; b.globalThis = b;
                     vm.createContext(b); vm.runInContext(src, b); return b; };
  const b = mk();
  const cus = JSON.parse(JSON.stringify(STATE.customers || []));
  const dlr = JSON.parse(JSON.stringify(STATE.dealers || []));
  ok('the live data really has none today',
     cus.every(c => c.id == null) && dlr.every(d => d.id == null));
  b.ensureIds(cus, 'CU', b.CUST_ID_FIELDS);
  b.ensureIds(dlr, 'DL', b.DLR_ID_FIELDS);
  eq('every customer gets an id', cus.filter(c => c.id).length, cus.length);
  eq('every dealer gets an id', dlr.filter(d => d.id).length, dlr.length);
  eq('customer ids are unique', new Set(cus.map(c => c.id)).size, cus.length);
  eq('dealer ids are unique', new Set(dlr.map(d => d.id)).size, dlr.length);

  /* THE PROPERTY THE WHOLE FIX RESTS ON, and the one the first version of this
     file did not test: the id must be a function of the row, not of the moment.
     Two independent runs stand in for two browsers. Replace _stableId's hash
     with anything random and this is what goes red. */
  {
    const b2 = mk();
    const again = JSON.parse(JSON.stringify(STATE.customers || []));
    b2.ensureIds(again, 'CU', b2.CUST_ID_FIELDS);
    eq('a second browser computes the SAME ids for the same rows',
       again.map(c => c.id).join('|'), cus.map(c => c.id).join('|'));
    const dagain = JSON.parse(JSON.stringify(STATE.dealers || []));
    b2.ensureIds(dagain, 'DL', b2.DLR_ID_FIELDS);
    eq('...and the same dealer ids', dagain.map(d => d.id).join('|'), dlr.map(d => d.id).join('|'));
  }
  ok('running it twice over the same rows changes nothing',
     (function () { const before = cus.map(c => c.id).join('|');
       b.ensureIds(cus, 'CU', b.CUST_ID_FIELDS);
       return cus.map(c => c.id).join('|') === before; })());
}

/* 2b. every place that CREATES a customer or dealer row mints an id.
   This is the half that was missing. Back-filling on load while custSave,
   addDealer and custInit keep pushing bare rows means the array loses its ids
   again on the first edit — and merge3's id path needs EVERY row to have one. */
{
  const src = ['hardRole', '_custAbbr3', '_custYY', 'custCode', 'custBrandKeyFor', 'custSave', 'addDealer',
               'custInit', '_hash', '_stableId', 'ensureIds', 'ensureRecordIds',
               '_arrId'].map(H.grab).join('\n\n') + IDFIELDS_SRC;
  function box(st) {
    const b = {
      console, Date, JSON, Object,
      TODAY: new Date('2026-08-24T00:00:00Z'),
      state: Object.assign({ role: 'COO', customers: [], dealers: [] }, st || {}),
      custForm: null, dlrForm: { name: '', region: 'Punjab', city: '', contact: '', phone: '', credit: 0 },
      toasts: [], toast: m => b.toasts.push(m),
      logAction: () => {}, save: () => {}, render: () => {},
      $: () => ({ value: '' }),
      suggestCode: () => 'DLR-NEW-001',
      SEED: { catalog: { clients: [], channelByClient: {} }, geo: {} },
    };
    b.globalThis = b; vm.createContext(b); vm.runInContext(src, b); return b;
  }

  /* --- custSave, editing an existing row --- */
  {
    const live = JSON.parse(JSON.stringify(STATE.customers));
    const b = box({ customers: live });
    b.ensureRecordIds({ customers: b.state.customers, dealers: [], packingLog: [],
                        shipments: [], productionLog: [], inspections: [], batches: [],
                        audit: [], actionLog: [] });
    const target = b.state.customers[0];
    const idBefore = target.id, n = b.state.customers.length;
    ok('the row has an id before the edit', !!idBefore);

    b.custForm = Object.assign({ editing: target.code }, target, { city: 'Lahore', phone: '0300' });
    b.custSave();
    const after = b.state.customers.find(c => c.code === target.code);
    eq('the edit landed', after.city, 'Lahore');
    eq('EDITING A CUSTOMER KEEPS ITS ID', after.id, idBefore);
    eq('...and does not add a row', b.state.customers.length, n);

    /* The exact failure the reviewer found: rec was a fresh literal with no id,
       so ensureIds re-minted one from the NEW city on the next load and 21
       customers came back as 22. */
    b.ensureRecordIds({ customers: b.state.customers, dealers: [], packingLog: [],
                        shipments: [], productionLog: [], inspections: [], batches: [],
                        audit: [], actionLog: [] });
    eq('and a reload still shows the same number of customers', b.state.customers.length, n);
    eq('...still under the same id', b.state.customers.find(c => c.code === target.code).id, idBefore);
    ok('every customer row still carries an id after an edit',
       b.state.customers.every(c => c.id != null));
    ok('so merge3 still sees the array as id-addressable', b._arrId(b.state.customers) === true);
  }

  /* --- custSave, adding a new row (and its dealer mirror) --- */
  {
    const b = box({ customers: [], dealers: [] });
    b.custForm = { editing: null, segment: 'Dealer', name: 'Test Traders', region: 'Punjab',
                   city: 'Jhang', contact: 'x', phone: '1', fed: 'Exclusive', kam: '',
                   introducedBy: '', destination: '', ntn: '', inducted: 2026, status: 'Active' };
    b.custSave();
    eq('a new customer was added', b.state.customers.length, 1);
    ok('A NEW CUSTOMER IS BORN WITH AN ID', b.state.customers[0].id != null,
       JSON.stringify(b.state.customers[0]));
    eq('the dealer mirror was written too', b.state.dealers.length, 1);
    ok('AND THE DEALER MIRROR HAS ONE', b.state.dealers[0].id != null,
       JSON.stringify(b.state.dealers[0]));
    ok('both arrays are id-addressable', b._arrId(b.state.customers) && b._arrId(b.state.dealers));

    /* the id is the deterministic one, so a back-fill elsewhere agrees with it */
    const copy = JSON.parse(JSON.stringify(b.state.customers)).map(c => { delete c.id; return c; });
    b.ensureIds(copy, 'CU', b.CUST_ID_FIELDS);
    eq('the id minted at creation is the one ensureIds would have computed',
       copy[0].id, b.state.customers[0].id);
  }

  /* --- addDealer --- */
  {
    const b = box({ dealers: [] });
    b.dlrForm = { name: 'New Dealer', region: 'Punjab', city: 'Jhang',
                  contact: 'c', phone: 'p', credit: 0 };
    b.addDealer();
    eq('the dealer was added', b.state.dealers.length, 1);
    ok('A DEALER ADDED ON THE DEALER FORM HAS AN ID', b.state.dealers[0].id != null,
       JSON.stringify(b.state.dealers[0]));
  }

  /* --- custInit's seeder --- */
  {
    const b = box({ customers: [], dealers: [{ code: 'D1', name: 'Seeded', region: 'Punjab', city: 'Jhang' }] });
    b.custInit();
    ok('custInit seeded some customers', b.state.customers.length > 0);
    ok('EVERY SEEDED CUSTOMER HAS AN ID', b.state.customers.every(c => c.id != null),
       JSON.stringify(b.state.customers.filter(c => c.id == null).map(c => c.code)));
    ok('the seeded rows are id-addressable', b._arrId(b.state.customers) === true);
    /* two browsers seeding the same catalogue must agree, or the merge doubles it */
    const b2 = box({ customers: [], dealers: [{ code: 'D1', name: 'Seeded', region: 'Punjab', city: 'Jhang' }] });
    b2.custInit();
    eq('a second browser seeds the SAME ids (or the merge would double the list)',
       b2.state.customers.map(c => c.id).join('|'), b.state.customers.map(c => c.id).join('|'));
  }
}

/* 2c. merge3 — what the ids buy, and the rollout window they open */
{
  const src = ['_arrId', '_eq', 'merge3'].map(H.grab).join('\n\n');
  const b = { console, JSON }; b.globalThis = b;
  vm.createContext(b); vm.runInContext(src, b);

  /* THE POINT: two people each add a customer, and both survive. */
  {
    const base = { customers: [{ id: 'CU1', name: 'A' }] };
    const mine = { customers: [{ id: 'CU1', name: 'A' }, { id: 'CU2', name: 'B' }] };
    const yours = { customers: [{ id: 'CU1', name: 'A' }, { id: 'CU3', name: 'C' }] };
    const out = b.merge3(base, mine, yours);
    eq('two people add a customer each — BOTH survive', out.customers.length, 3);
    ok('...including the one the other person added',
       out.customers.some(c => c.name === 'C'), JSON.stringify(out.customers));
  }
  /* and what it was like before */
  {
    const out = b.merge3({ customers: [{ name: 'A' }] },
                         { customers: [{ name: 'A' }, { name: 'B' }] },
                         { customers: [{ name: 'A' }, { name: 'C' }] });
    ok('BEFORE: with no ids the other person’s customer was silently deleted',
       !out.customers.some(c => c.name === 'C'), JSON.stringify(out.customers));
  }

  /* THE ROLLOUT WINDOW. This browser has the new code, so its rows carry ids.
     The other browser is still on the old code, so the rows it saved do not.
     The id path maps the server by id, finds nothing, and its final pass only
     re-adds server rows that HAVE an id — so it used to drop every one of them.
     Giving customers ids without this guard would have turned a case that is
     safe today into a new way to lose the other person's work. */
  {
    const base = { customers: [{ id: 'CU1', name: 'A' }] };
    const local = { customers: [{ id: 'CU1', name: 'A' }] };           /* we changed nothing */
    const srv = { customers: [{ name: 'A' }, { name: 'C' }] };         /* old browser saved */
    const out = b.merge3(base, local, srv);
    ok('ROLLOUT: an id-less server list is NOT silently emptied',
       out.customers.length === 2 && out.customers.some(c => c.name === 'C'),
       JSON.stringify(out.customers));
  }
  /* Half-id'd is the same trap and must take the same exit. */
  {
    const out = b.merge3({ customers: [{ id: 'CU1', name: 'A' }] },
                         { customers: [{ id: 'CU1', name: 'A' }] },
                         { customers: [{ id: 'CU1', name: 'A' }, { name: 'C' }] });
    ok('ROLLOUT: a half-id’d server list is not silently trimmed either',
       out.customers.length === 2, JSON.stringify(out.customers));
  }
  /* But an EMPTY server array has nothing to lose, and must keep taking the id
     path — otherwise the leaf rule hands back [] and our own rows disappear. */
  {
    const out = b.merge3({ customers: [{ id: 'CU1', name: 'A' }] },
                         { customers: [{ id: 'CU1', name: 'A' }] },
                         { customers: [] });
    eq('an EMPTY server list does not wipe our rows', out.customers.length, 1);
  }
  /* And the guard must not have cost anything when both sides are id’d. */
  {
    const out = b.merge3({ customers: [{ id: 'CU1', name: 'A' }] },
                         { customers: [{ id: 'CU1', name: 'A' }, { id: 'CU2', name: 'B' }] },
                         { customers: [{ id: 'CU1', name: 'A' }, { id: 'CU3', name: 'C' }] });
    eq('both sides id’d — the id merge still runs', out.customers.length, 3);
  }
  ok('GUARD: merge3 requires the SERVER side to be id’d too',
     /_arrId\(local\)\s*&&\s*Array\.isArray\(srv\)\s*&&\s*\(srv\.length===0\s*\|\|\s*_arrId\(srv\)\)/
       .test(H.grab('merge3')), 'the rollout guard is gone');
}

/* ============ 3. the bulk "no price" question ============ */
{
  const src = ['openPrintDecisionPOs', 'bulkPDAll', 'accessOv', '_ownerEdit', 'accessLevel',
               'screenEditOK', 'mayWork', 'whoMayEdit', 'denyWork', 'bulkPDWhoMay',
               'bulkPDMayAnswer', 'bulkPDDenied', 'saveBulkPrintDecision'].map(H.grab).join('\n');
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

console.log('\nThree fixes — Data Fix gates, customer/dealer ids, bulk no-price: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
