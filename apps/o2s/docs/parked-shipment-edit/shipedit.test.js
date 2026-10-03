/* The shipment edit path — SPEC-03 "close all the paths and keep one".
   Tahir, 22 Aug 2026: once a shipment is delivered, its quantity and DC number
   belong to the Plant Manager, not to Supply Chain, and only with a reason. */
const vm = require('vm');
const H = require('./harness.js');
const html = H.html;

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));

const SRC = [
  H.grabObj('CORRECT_ENTITY'),
  H.grab('correctFieldOK'), H.grab('correctAnyField'), H.grab('correctCanAmend'),
  H.grab('correctAllowed'), H.grab('hardRole'), H.grab('isCorrection'),
  H.grab('shipEditCorrections'), H.grab('resyncLineShipKg'), H.grab('lotsFor'),
].join('\n');

function ctx(role, state) {
  const s = Object.assign({
    console, fmt: n => String(n), TODAY: new Date('2026-08-22T00:00:00Z'), Date,
    toast: () => {}, logAction: () => {}, save: () => {}, closeModal: () => {},
    render: () => {}, recordCorrection: () => {},
  }, { state: Object.assign({ role, currentUser: { name: 'tahir' } }, state) });
  s.globalThis = s;
  vm.createContext(s); vm.runInContext(SRC, s); return s;
}

const shipDelivered = () => ({ id: 'S1', po: 'PO-1', brand: 'VL-NPK', kg: 1000, dc: 'DC-9', delivered: '2026-08-10', dispatch: '2026-08-08', vehicle: 'ABC-123' });
const shipInFlight = () => ({ id: 'S2', po: 'PO-1', brand: 'VL-NPK', kg: 1000, dc: 'DC-9', delivered: null, dispatch: '2026-08-08', vehicle: 'ABC-123' });

/* ---------- 1. who may change the quantity and the DC ---------- */
function fieldOK(role, ship, key) {
  const s = ctx(role, { shipments: [ship], orders: [] });
  const f = s.CORRECT_ENTITY.shipment.fields.find(x => x.k === key);
  return s.correctFieldOK('shipment', f, ship);
}

eq('delivered: Supply Chain may NOT change the quantity', fieldOK('Supply Chain', shipDelivered(), 'kg'), false);
eq('delivered: Supply Chain may NOT change the DC', fieldOK('Supply Chain', shipDelivered(), 'dc'), false);
eq('delivered: Plant Manager MAY change the quantity', fieldOK('Plant Manager', shipDelivered(), 'kg'), true);
eq('delivered: Plant Manager MAY change the DC', fieldOK('Plant Manager', shipDelivered(), 'dc'), true);
eq('delivered: COO may too', fieldOK('COO', shipDelivered(), 'kg'), true);

eq('in flight: Supply Chain still owns the quantity', fieldOK('Supply Chain', shipInFlight(), 'kg'), true);
eq('in flight: Supply Chain still owns the DC', fieldOK('Supply Chain', shipInFlight(), 'dc'), true);
eq('in flight: Plant Manager does NOT own the quantity yet', fieldOK('Plant Manager', shipInFlight(), 'kg'), false);

eq('a delivered date that never existed cannot be amended here',
  fieldOK('Plant Manager', shipInFlight(), 'delivered'), false);
eq('a delivered date that DOES exist can be, by the Plant Manager',
  fieldOK('Plant Manager', shipDelivered(), 'delivered'), true);

/* the six original fields keep the record-level rule */
eq('vehicle stays with Supply Chain even after delivery',
  fieldOK('Supply Chain', shipDelivered(), 'vehicle'), true);
eq('vehicle is not handed to the Plant Manager',
  fieldOK('Plant Manager', shipDelivered(), 'vehicle'), false);

/* ---------- 2. rolesIf is never judged without the record ---------- */
{
  const s = ctx('COO', { shipments: [], orders: [] });
  const f = s.CORRECT_ENTITY.shipment.fields.find(x => x.k === 'kg');
  eq('no record in hand means no, not a guess', s.correctFieldOK('shipment', f, undefined), false);
  eq('...and not even for the COO', s.correctFieldOK('shipment', f, null), false);
}
{ /* a throwing rolesIf must deny, not crash */
  const s = ctx('COO', { shipments: [], orders: [] });
  eq('a rolesIf that throws denies',
    s.correctFieldOK('shipment', { k: 'x', rolesIf: () => { throw new Error('boom'); } }, {}), false);
  eq('an empty rolesIf list means nobody, COO included',
    s.correctFieldOK('shipment', { k: 'x', rolesIf: () => [] }, {}), false);
}

/* ---------- 3. the Plant Manager can reach the modal at all ---------- */
{
  const sd = shipDelivered();
  const s = ctx('Plant Manager', { shipments: [sd], orders: [] });
  eq('Plant Manager is not in shipment.amend', s.CORRECT_ENTITY.shipment.amend.includes('Plant Manager'), false);
  eq('...but the field opens the modal for him anyway', s.correctCanAmend('shipment', sd), true);
  const s2 = ctx('KAM', { shipments: [sd], orders: [] });
  eq('a KAM still cannot amend a shipment', s2.correctCanAmend('shipment', sd), false);
}

/* ---------- 4. the second door: entry passes, correction is refused ---------- */
function corrections(role, ship, form) {
  const s = ctx(role, { shipments: [ship], orders: [] });
  return s.shipEditCorrections(Object.assign({ rows: [{ s: ship, kg: ship.kg }] }, form));
}
const base = sh => ({ date: sh.dispatch, dest: sh.destination, carrier: sh.carrier, vehicle: sh.vehicle, dc: sh.dc, bilty: sh.bilty, delivered: !!sh.delivered, deliveredDate: sh.delivered });

{
  const sh = shipDelivered();
  eq('nothing changed means nothing to refuse', corrections('COO', sh, base(sh)).length, 0);

  const f1 = Object.assign(base(sh), { dc: 'DC-11' });
  ok('changing the DC is caught', corrections('COO', sh, f1).includes('DC number'));

  const f2 = Object.assign(base(sh), { vehicle: 'XYZ-999' });
  ok('changing the vehicle is caught', corrections('COO', sh, f2).includes('Vehicle #'));

  /* quantity comes off the row, not the header */
  const s = ctx('COO', { shipments: [sh], orders: [] });
  const got = s.shipEditCorrections(Object.assign(base(sh), { rows: [{ s: sh, kg: 900 }] }));
  ok('changing the quantity is caught', got.some(x => /Quantity/.test(x)));
}
{ /* filling a blank is entry and must still go straight through */
  const sh = shipInFlight(); sh.bilty = ''; sh.destination = '';
  const f = Object.assign(base(sh), { bilty: 'BL-77', dest: 'Multan' });
  eq('filling two blanks is not a correction', corrections('COO', sh, f).length, 0);
}
{ /* confirming a delivery for the first time is entry, not a correction */
  const sh = shipInFlight();
  const f = Object.assign(base(sh), { delivered: true, deliveredDate: '2026-08-20' });
  eq('first delivery confirmation is entry', corrections('COO', sh, f).length, 0);
  const sd = shipDelivered();
  const f2 = Object.assign(base(sd), { deliveredDate: '2026-08-12' });
  ok('moving an existing delivered date is a correction',
    corrections('COO', sd, f2).includes('Delivered date'));
}

/* ---------- 5. the door actually refuses, in source ---------- */
ok('saveShipEdit calls the correction test', /var _corr=shipEditCorrections\(f\);/.test(html));
ok('...and returns instead of writing', /if\(_corr\.length\)\{[\s\S]{0,400}?return; \} \}/.test(html));
ok('...and hands the user to the correction modal', /openCorrect\('shipment',_sid\)/.test(html));
/* Only saveShipEdit's own row. The five other Shipment audit rows are creation
   events (Dispatched, Shipped, Truck planned, Released, Delivered) and still
   stamp the role, which is the pre-existing pattern for entry across the whole
   audit table. Widening this check to all of them was a test bug, not a finding. */
{
  const i = html.indexOf('function saveShipEdit');
  const body = html.slice(i, html.indexOf('\nfunction ', i + 10));
  ok('saveShipEdit no longer stamps the role as the user',
    !/user:state\.role,module:'Shipment'/.test(body));
  ok('saveShipEdit names the person and keeps the role beside it',
    /user:_who,role:state\.role,module:'Shipment'/.test(body));
  ok('and it no longer claims an empty before value on a change',
    /old:'\(blank\)'/.test(body));
}

/* ---------- 6. correcting a quantity walks the whole chain ---------- */
{
  const sh = shipDelivered();
  const other = { id: 'S3', po: 'PO-1', brand: 'VL-NPK', kg: 500, delivered: '2026-08-11' };
  const line = { id: 'L1', brand: 'VL-NPK', dispatched: 1500, delivered: 1500 };
  const order = { po: 'PO-1', lines: [line] };
  const s = ctx('Plant Manager', { shipments: [sh, other], orders: [order], packingLog: [] });
  sh.kg = 900;                                    // as applyCorrect would have set it
  const cascade = s.CORRECT_ENTITY.shipment.onAmend(sh, [{ field: 'kg', before: 1000, after: 900 }]);
  eq('the order line dispatched total follows', line.dispatched, 1400);
  eq('the delivered total follows too', line.delivered, 1400);
  ok('and the cascade says so', cascade.some(x => /dispatched 1500 . 1400/.test(x)));
  ok('and the per-lot quantities are re-derived',
    cascade.some(x => /Per-lot shipped quantities/.test(x)));
}
{ /* a voided shipment must not be counted back in */
  const sh = shipDelivered();
  const dead = { id: 'S4', po: 'PO-1', brand: 'VL-NPK', kg: 400, delivered: '2026-08-11', voided: true };
  const line = { id: 'L1', brand: 'VL-NPK', dispatched: 1000, delivered: 1000 };
  const s = ctx('COO', { shipments: [sh, dead], orders: [{ po: 'PO-1', lines: [line] }], packingLog: [] });
  s.CORRECT_ENTITY.shipment.onAmend(sh, [{ field: 'kg', before: 1000, after: 1000 }]);
  eq('a voided shipment is excluded from the total', line.dispatched, 1000);
}
{ /* changing something other than the quantity must not touch the line */
  const sh = shipDelivered();
  const line = { id: 'L1', brand: 'VL-NPK', dispatched: 7777, delivered: 7777 };
  const s = ctx('COO', { shipments: [sh], orders: [{ po: 'PO-1', lines: [line] }], packingLog: [] });
  const out = s.CORRECT_ENTITY.shipment.onAmend(sh, [{ field: 'vehicle', before: 'A', after: 'B' }]);
  eq('a vehicle change cascades nothing', out.length, 0);
  eq('and leaves the line alone', line.dispatched, 7777);
}

{ /* clearing a delivered date moves the delivered total even though no Kg changed */
  const sh = shipDelivered();
  const line = { id: 'L1', brand: 'VL-NPK', dispatched: 1000, delivered: 1000 };
  const s = ctx('Plant Manager', { shipments: [sh], orders: [{ po: 'PO-1', lines: [line] }], packingLog: [] });
  sh.delivered = '';                               // as applyCorrect would have set it
  const out = s.CORRECT_ENTITY.shipment.onAmend(sh, [{ field: 'delivered', before: '2026-08-10', after: '' }]);
  eq('un-delivering drops the line delivered total', line.delivered, 0);
  eq('but leaves dispatched alone', line.dispatched, 1000);
  ok('and the cascade reports it', out.some(x => /delivered 1000 . 0/.test(x)));
}

/* ---------- 7. the other record types did not change ---------- */
{
  const s = ctx('CFO', { shipments: [], orders: [] });
  const inv = s.CORRECT_ENTITY.orderLine.fields.find(x => x.k === 'invoicePrice');
  eq('the CFO still owns the invoice price', s.correctFieldOK('orderLine', inv, {}), true);
  const s2 = ctx('Supply Chain', { shipments: [], orders: [] });
  eq('and nobody else does', s2.correctFieldOK('orderLine', inv, {}), false);
  eq('an approved COA is still un-amendable by anyone',
    ctx('COO', {}).correctAllowed('coa', 'AMEND'), false);
}

console.log('\nShipment edit path: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
