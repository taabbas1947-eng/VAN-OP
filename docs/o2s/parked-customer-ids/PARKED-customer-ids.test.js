/* PARKED 2026-08-24 — do not run as-is. This is the customer/dealer id work,
   pulled out of threefixes.test.js when the change it tested was refused.
   The tests are sound; the CHANGE they cover is not finished. Read
   docs/o2s/parked-customer-ids/WHAT-WENT-WRONG.md before restarting it.
   Needs these grabs restored in o2s.html: CUST_ID_FIELDS / DLR_ID_FIELDS,
   ensureRecordIds's two ensureIds lines, the merge3 guard, and the id-minting
   in custSave / addDealer / custInit. */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;
let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }
const IDFIELDS_SRC = (function () {
  const m = /\nvar CUST_ID_FIELDS=[^\n]*;/.exec(H.html);
  if (!m) throw new Error('CUST_ID_FIELDS not found — the shared field lists are gone');
  return m[0];
})();

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


console.log('\nPARKED — customer/dealer ids: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
