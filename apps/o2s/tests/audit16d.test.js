/* 16d · The inspection record prints what was inspected (Tahir, 16 Oct 2026).
 *
 * printInspect(po) is the internal record of every inspection on a PO (QA, Log).
 * Under each inspection it states what the pack was required to carry: price
 * rule, batch number, mfg and expiry. Before 16d an inspection of older runs took
 * those from the FIRST packing run of the PO and product, not from the runs it
 * inspected. Live 16 Oct (read only): 109 of 531 inspections on 17 POs named a
 * batch or dates they did not inspect.
 *
 * Here: a PO with 2 runs of one product (first run A, then run B); a packed-lot
 * inspection of B, a truck inspection that carried B, an old per-lot QA on B,
 * and 1 inspection with no run ids. Each must print B, except the one without
 * ids, which keeps the old fall-back to the first run.
 */
const vm = require('vm');
const H = require('./harness.js');
const { ok, report, grab } = H;

const NAMES = ['printInspect', 'printInspectRunDates', 'printInspectPriceRule', 'qcExpect', 'lotBrandNo', 'lotBaseNo'];
const src = NAMES.map(n => { try { return grab(n); } catch (e) { return ''; } }).join('\n\n') + '\n' + H.bagSrc();
ok('the new helper exists', /function printInspectRunDates\(/.test(src));

function render(state) {
  let html = '';
  const box = {
    console, state, Date, JSON, Object, Array, String, Set,
    window: { open: () => ({ document: { write: h => { html += h; }, close() {} }, focus() {} }) },
    toast: () => {}, fmt: n => String(n), _pe: x => String(x == null ? '' : x),
    sigName: s => String((s && s.name) || ''), printPolicyOL: () => ({ mode: 'noprint' }),
    printDoc: (t, meta, body) => { html += meta + body; }, _docHead: () => '', VAN_LOGO_REAL: '', VAN_FOOTER: '',
    evLag: () => null, _tx: x => String(x || ''),
  };
  box.globalThis = box; vm.createContext(box); vm.runInContext(src, box);
  try { box.printInspect('PO1'); } catch (e) { return 'ERROR ' + e.message; }
  return html.replace(/<[^>]*>/g, ' ');
}

const A = { id: 'RA', po: 'PO1', brand: 'Enrich', lid: 'L1', brandBatchNo: 'VAN6HE001', batchId: 'B1', mfgDate: '2026-08-19', expDate: '2028-08-19', kg: 100 };
const B = { id: 'RB', po: 'PO1', brand: 'Enrich', lid: 'L1', brandBatchNo: 'VAN6GE002', batchId: 'B1', mfgDate: '2026-08-13', expDate: '2028-08-13', kg: 100 };
const base = () => ({
  orders: [{ id: 'O1', po: 'PO1', client: 'X', lines: [{ id: 'L1', brand: 'Enrich' }] }],
  batches: [{ id: 'B1', batchNo: 'HG26024' }],
  packingLog: [JSON.parse(JSON.stringify(A)), JSON.parse(JSON.stringify(B))], shipments: [], inspections: []
});
const insp = (ids, date) => ({ po: 'PO1', brand: 'Enrich', lid: 'L1', kg: 100, by: 'Asif', date, pass: true, checklist: [], verify: [], batches: ids.map(id => ({ lotId: id, batch: 'HG26024', brand: id === 'RA' ? A.brandBatchNo : B.brandBatchNo, kg: 100 })) });
const req = t => (t.match(/Required on the pack[^]*?(?=Sample|Inspector|$)/g) || []);

{ const s = base(); s.inspections = [insp(['RB'], '2026-08-13')]; const t = render(s);
  ok('a packed-lot inspection of run B prints B\'s batch', /VAN6GE002/.test(req(t).join(' ')) && !/VAN6HE001/.test(req(t).join(' ')), req(t).join(' | ').slice(0, 200));
  ok('...and B\'s dates, not the first run\'s', /2026-08-13/.test(req(t).join(' ')) && !/2026-08-19/.test(req(t).join(' '))); }

{ const s = base(); s.shipments = [{ id: 'S1', dispId: 'D1', po: 'PO1', brand: 'Enrich', lid: 'L1', kg: 100, batches: [{ lotId: 'RB', kg: 100 }], qa: { pass: true, by: 'Asif', date: '2026-08-20', checklist: [], verify: [] } }];
  const t = render(s);
  ok('a truck inspection prints the runs the truck carried', /VAN6GE002/.test(req(t).join(' ')) && !/VAN6HE001/.test(req(t).join(' '))); }

{ const s = base(); s.packingLog[1].qa = { pass: true, by: 'Asif', date: '2026-08-14', checklist: [], verify: [] }; const t = render(s);
  ok('an old per-lot QA prints its own run', /VAN6GE002/.test(req(t).join(' ')) && !/VAN6HE001/.test(req(t).join(' '))); }

{ const s = base(); s.inspections = [insp(['RA', 'RB', 'RB'], '2026-08-20')]; const t = render(s); const r = req(t).join(' ');
  ok('an inspection of 2 runs prints both batch numbers once each', /VAN6HE001/.test(r) && /VAN6GE002/.test(r) && (r.match(/VAN6GE002/g) || []).length === 1, r.slice(0, 220));
  ok('...and both date pairs once each', /2026-08-19/.test(r) && /2026-08-13/.test(r) && (r.match(/2026-08-13/g) || []).length === 1); }

{ const s = base(); s.inspections = [Object.assign(insp([], '2026-08-13'), { batches: [] })]; const t = render(s);
  ok('an inspection with no run ids falls back to the first run, as before', /VAN6HE001/.test(req(t).join(' '))); }

{ const s = base(); s.packingLog[1].bagMfg = '2026-10'; s.packingLog[1].bagExp = '2028-10'; s.inspections = [insp(['RB'], '2026-10-16')]; const t = render(s);
  ok('a 16b run still prints its bag month', /Oct-2026/.test(req(t).join(' ')) && /VAN6GE002/.test(req(t).join(' ')), req(t).join(' | ').slice(0, 200)); }

/* review 16 Oct: a record whose runs are gone never borrows the first run */
{ const s = base(); s.inspections = [insp(['GONE1'], '2026-08-13')]; const t = render(s); const r = req(t).join(' ');
  ok('runs no longer on record: says so, and prints no other run', /run no longer on record/.test(r) && !/VAN6HE001/.test(r) && !/VAN6GE002/.test(r), r.slice(0, 200)); }
{ const s = base(); s.inspections = [insp(['RB', 'GONE1'], '2026-08-13')]; const t = render(s); const r = req(t).join(' ');
  ok('1 run found and 1 gone: prints the found run and notes the missing one', /VAN6GE002/.test(r) && !/VAN6HE001/.test(r) && /1 run this inspection checked is no longer on record/.test(r)); }
/* an old per-lot row with no id prints itself, never another PO's id-less row */
{ const s = base(); s.packingLog.unshift({ po: 'PO9', brand: 'Enrich', brandBatchNo: 'OTHERPO1', mfgDate: '2026-01-01', expDate: '2028-01-01', kg: 5 });
  s.packingLog.push({ po: 'PO1', brand: 'Enrich', lid: 'L1', brandBatchNo: 'NOIDROW', mfgDate: '2026-08-30', expDate: '2028-08-30', kg: 5, qa: { pass: true, by: 'Asif', date: '2026-08-30', checklist: [], verify: [] } });
  const t = render(s); const r = req(t).join(' ');
  ok('an old per-lot row with no id prints its own batch', /NOIDROW/.test(r) && !/OTHERPO1/.test(r), r.slice(0, 200)); }
/* mixed: a 16b run and an older run on one record */
{ const s = base(); s.packingLog[1].bagMfg = '2026-10'; s.packingLog[1].bagExp = '2028-10'; s.inspections = [insp(['RA', 'RB'], '2026-10-16')]; const r = req(render(s)).join(' ');
  ok('a 16b run and an older run on 1 record: both batches, the bag month and the old dates', /VAN6HE001/.test(r) && /VAN6GE002/.test(r) && /Oct-2026/.test(r) && /2026-08-19/.test(r), r.slice(0, 260)); }
/* 2 runs with the same dates print the pair once */
{ const s = base(); s.packingLog[1].mfgDate = '2026-08-19'; s.packingLog[1].expDate = '2028-08-19'; s.inspections = [insp(['RA', 'RB'], '2026-08-20')]; const r = req(render(s)).join(' ');
  ok('2 runs with the same dates: the date pair once', (r.match(/2026-08-19/g) || []).length === 1); }
/* a withdrawn inspection still prints its own run */
{ const s = base(); s.inspections = [Object.assign(insp(['RB'], '2026-08-13'), { superseded: { reason: 'redone', by: 'Asif', at: '2026-08-14' } })]; const r = req(render(s)).join(' ');
  ok('a withdrawn inspection prints its own run', /VAN6GE002/.test(r) && !/VAN6HE001/.test(r)); }
/* the truck and old per-lot cases carry the right dates too */
{ const s = base(); s.shipments = [{ id: 'S1', dispId: 'D1', po: 'PO1', brand: 'Enrich', lid: 'L1', kg: 100, batches: [{ lotId: 'RB', kg: 100 }], qa: { pass: true, by: 'Asif', date: '2026-08-20', checklist: [], verify: [] } }];
  const r = req(render(s)).join(' ');
  ok('a truck inspection prints the carried run\'s dates', /2026-08-13/.test(r) && !/2026-08-19/.test(r)); }

/* mutation: the old line (first run for older records) must fail the first check */
{ const mut = src.replace(/var _new=runs\.some\(function\(p\)\{ return p\.bagMfg; \}\);/, 'var _new=runs.some(function(p){ return p.bagMfg; }); if(!_new) runs=[];');
  let html = ''; const box = { console, state: (() => { const s = base(); s.inspections = [insp(['RB'], '2026-08-13')]; return s; })(), Date, JSON, Object, Array, String, Set,
    window: { open: () => ({ document: { write: h => { html += h; }, close() {} }, focus() {} }) }, toast: () => {}, fmt: n => String(n), _pe: x => String(x == null ? '' : x),
    sigName: s => String((s && s.name) || ''), printPolicyOL: () => ({ mode: 'noprint' }), printDoc: (t, m, b) => { html += m + b; }, _docHead: () => '', evLag: () => null, _tx: x => String(x || '') };
  box.globalThis = box; vm.createContext(box); vm.runInContext(mut, box); try { box.printInspect('PO1'); } catch (e) {}
  ok('mutation check: the pre-16d behaviour is caught', mut !== src && /VAN6HE001/.test(html.replace(/<[^>]*>/g, ' '))); }

report('16d inspection record prints what was inspected');
