/* 25b — WHY THE NEEDS-YOU ITEMS HAPPENED, AND FIXING THEM WHERE THEY HAPPENED.
   Tahir, 24 Sep 2026: "Why did those even happen? Where was the gap or loophole?
   ... it never leads me to the origin." Ruled: refuse packing above ordered;
   for packed-with-no-record offer both fixes and the fixer chooses.
   The holes: (1) allocateStock raised packed with no record; (2) Correct a record
   let packed/dispatched/delivered be typed; (3) Correct a record's packing had no
   cap at ordered; (4) the old "Add the packing record" route added the gap to
   packed a second time; (5) a reversed lot still counted as packing.
   Run: node linefix.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

/* ---- the holes are shut (source) ---- */
ok('allocateStock refuses before touching packed', /function allocateStock\(oid,lid\)\{ toast\([^)]*\); return;/.test(html));
ok('Correct a record: packing refused above what the line still needs', /if\(q>_need\+0\.5\) return toast\('That is more than the line still needs/.test(grab('dfSubmitPacking')));
{ const src = html.slice(html.indexOf("/* 25b, the invariant"), html.indexOf("/* 25b, the invariant") + 900);
  ok('Correct values no longer writes packed, dispatched or delivered', !/\['packed',/.test(src) && !/\['dispatched',/.test(src) && !/\['delivered',/.test(src) && /\['ordered','Ordered/.test(src)); }
ok('...and shows them read-only', /id="cl_packed_\$\{l\.id\}"[^>]*readonly disabled/.test(html) && /id="cl_delivered_\$\{l\.id\}"[^>]*readonly disabled/.test(html));
ok('the old reconcile route now opens the line sheet (it used to double the gap)', /function reconFix\(po,lid\)\{ lfForm=\{\}; lineFixOpen\(po,lid\); return;/.test(html));
ok('lotsFor skips reversed and voided lots', /if\(!p\|\|p\.reversed\|\|p\.void\) return false;/.test(grab('lotsFor')));
ok('Needs you opens the list of lines, not a screen to search', /go:"lineFixList\('undated'\)"/.test(html) && /go:"lineFixList\('packing'\)"/.test(html));
ok('every order line in the order sheet has History', /lineFixOpen\(\\''\+qsEsc\(o\.po\)/.test(grab('openOrderSheet')));
/* no path raises l.packed without writing its record: every writer is a packing run, a reversal, the fix sheet (which only lowers it), or the one-time Rudolf repair */
{ const writers = []; const re = /l\.packed=/g; let m;
  while ((m = re.exec(html))) { const pre = html.slice(Math.max(0, m.index - 6000), m.index); const all = [...pre.matchAll(/(?:function\s+([A-Za-z0-9_]+)\s*\(|([A-Za-z0-9_]+):function\s*\()/g)]; const last = all[all.length - 1]; writers.push(last ? (last[1] || last[2]) : '?'); }
  const allowed = ['dfSubmitPacking', 'submitDivert', 'submitProdQty', 'doPack', 'allocateStock', 'fixRudolfDupV1', 'lineFixCut', 'doReverse'];
  ok('every write to packed is a packing run, a reversal, the fix sheet or the one-time repair: ' + writers.join(', '), writers.length === 8 && writers.every(w => allowed.includes(w))); }

/* ---- the sheet, run ---- */
const sb = { console, toasts: [], saved: 0, corr: [],
  toast: m => sb.toasts.push(m), save: () => sb.saved++, render: () => {}, closeModal: () => {},
  evToday: () => '2026-09-24', fmt: n => String(Math.round(+n * 100) / 100), unitOf: () => 'Kg', qsEsc: x => String(x == null ? '' : x), _tdClient: o => o.client,
  lineShortClosed: () => false, screenEditOK: () => sb.canFix, canFix: true,
  nid: p => p + (++sb._n), _n: 0, batchLabApproved: b => !!b.ok, batchPackableKg: b => (+b.producedKg || 0) - (+b.packedKg || 0),
  packDates: () => ({ mfgDate: '2026-08-01', expDate: '2028-08-01', shelfMonths: 24 }), syncPackBatchDates: () => {},
  lotBaseNo: p => p.baseBatchNo || '', recordCorrection: (op, t, id, label, ch, code, reason) => sb.corr.push({ op, t, id, ch, reason }),
  $: () => ({ innerHTML: '', classList: { add() {}, remove() {} } }),
  state: { role: 'COO', currentUser: { name: 'Tahir' }, corrections: [], actionLog: [], audit: [],
    batches: [{ id: 'B1', batchNo: 'VMG26001', base: 'Mg', ok: true, producedKg: 1000, packedKg: 500 }, { id: 'B2', batchNo: 'X1', base: 'Other', ok: true, producedKg: 99, packedKg: 0 }],
    orders: [
      { po: 'P-VMG', client: 'VGreen', lines: [{ id: 'L1', brand: 'V-Mg', base: 'Mg', ordered: 150, packed: 150, dispatched: 150, delivered: 150, deliveredDate: '2026-08-02' }] },
      { po: 'P-OVER', client: 'Transfarm', lines: [{ id: 'L2', brand: 'V-T', base: 'Mg', ordered: 300, packed: 600, dispatched: 300, delivered: 0 }] },
      { po: 'P-MAX', client: 'Maxim', lines: [{ id: 'L3', brand: 'Max S', base: 'Mg', ordered: 2000, packed: 2000, dispatched: 0, delivered: 0 }] },
      { po: 'P-UND', client: 'Farm', lines: [{ id: 'L4', brand: 'NPK', base: 'Mg', ordered: 50, packed: 50, dispatched: 50, delivered: 50 }] } ],
    packingLog: [{ id: 'PK0', po: 'P-OVER', lid: 'L2', brand: 'V-T', kg: 300, shipKg: 300, insKg: 300, date: '2026-07-01', baseBatchNo: 'B' },
                 { id: 'PKR', po: 'P-OVER', lid: 'L2', brand: 'V-T', kg: 200, reversed: true, date: '2026-07-02' },
                 { id: 'PKU', po: 'P-UND', lid: 'L4', brand: 'NPK', kg: 50, shipKg: 50, insKg: 50, date: '2026-07-03' }],
    shipments: [{ po: 'P-VMG', lid: 'L1', brand: 'V-Mg', kg: 150, dispCounted: true, stage: 'delivered', delivered: '2026-08-02' },
                { po: 'P-UND', lid: 'L4', brand: 'NPK', kg: 50, dispCounted: true, stage: 'delivered', delivered: '2026-07-20' }] } };
vm.createContext(sb);
vm.runInContext(['lotsFor', 'saleLeft', 'lineFacts', 'lineIssues', 'lineFixRows', 'lineHistory', 'lineCause', 'lineFixOpen', '_lfCtx', '_lfGuard', 'lineFixRecord', 'lineFixCut', 'lineFixDate', 'lineFixList'].map(grab).join('\n') + '\nvar lfForm={};', sb);
const O = po => sb.state.orders.find(o => o.po === po), L = po => O(po).lines[0];
eq('a reversed lot is not counted as packing', sb.lineFacts(O('P-OVER'), L('P-OVER')).logged, 300);
eq('the list finds the 3 packing lines', sb.lineFixRows('packing').map(r => r.o.po).join(','), 'P-VMG,P-OVER,P-MAX');
eq('...and the undated one', sb.lineFixRows('undated').map(r => r.o.po).join(','), 'P-UND');
ok('over-ordered is named', sb.lineIssues(O('P-OVER'), L('P-OVER')).some(i => i.k === 'over'));
/* V-Mg: shipped, no record -> record against a batch; the line does not move */
sb.lineFixOpen('P-VMG', 'L1', 'rec'); sb.lfForm.bid = 'B1'; sb.lfForm.kg = 150; sb.lfForm.reason = '';
sb.lineFixRecord(); ok('a reason is required', /reason/.test(sb.toasts.pop()) && sb.state.packingLog.length === 3);
sb.lfForm.reason = 'Packed from VMG26001 in July, never logged'; sb.lfForm.bid = 'B2'; sb.lineFixRecord();
ok('a batch of another product is refused', /this line is/.test(sb.toasts.pop()));
sb.lfForm.bid = 'B1'; sb.lfForm.kg = 151; sb.lineFixRecord(); ok('more than the gap is refused', /At most 150/.test(sb.toasts.pop()));
sb.lfForm.kg = 150; sb.lineFixRecord();
const lot = sb.state.packingLog[0];
eq('the record is written against the batch', [lot.po, lot.lid, lot.baseBatchNo, lot.kg].join('|'), 'P-VMG|L1|VMG26001|150');
eq('packed on the line did not move', L('P-VMG').packed, 150);
eq('it is marked shipped (it left on a truck), inspection noted as not on record', [lot.shipKg, lot.insKg, lot.qa.retro].join('|'), '150|150|true');
eq('the batch gives up the quantity', sb.state.batches[0].packedKg, 650);
ok('the correction register has it, with the reason', sb.corr.some(c => c.op === 'ADD' && c.t === 'packingLot' && /never logged/.test(c.reason)));
eq('the line is no longer flagged', sb.lineIssues(O('P-VMG'), L('P-VMG')).length, 0);
/* Transfarm 600 on 300: record refused (would pass ordered); cut to 300 allowed */
sb.lfForm = {}; sb.lineFixOpen('P-OVER', 'L2', 'rec'); sb.lfForm.bid = 'B1'; sb.lfForm.kg = 300; sb.lfForm.reason = 'double entry'; sb.lineFixRecord();
ok('recording past the ordered quantity is refused', /At most 0/.test(sb.toasts.pop()));
sb.lfForm.mode = 'cut'; sb.lineFixCut();
eq('overpack brought back to the records', L('P-OVER').packed, 300);
eq('...and recorded as an amendment', sb.corr[sb.corr.length - 1].op + ' ' + sb.corr[sb.corr.length - 1].ch[0].after, 'AMEND 300');
/* Maxim 2,000, nothing shipped: cut allowed; or record. Cut refused when the gate already passed more */
L('P-MAX').dispatched = 500; sb.lfForm = {}; sb.lineFixOpen('P-MAX', 'L3', 'cut'); sb.lfForm.reason = 'never packed'; sb.lineFixCut();
ok('cannot cut below what left the gate', /already left the gate/.test(sb.toasts.pop()) && L('P-MAX').packed === 2000);
L('P-MAX').dispatched = 0; sb.lineFixCut(); eq('nothing left the gate: packed back to 0', L('P-MAX').packed, 0);
/* undated: date from the truck */
sb.lfForm = {}; sb.lineFixOpen('P-UND', 'L4', 'date'); eq('the truck\'s delivery date is offered', sb.lfForm.ddate, '2026-07-20');
sb.lfForm.reason = 'from the DC'; sb.lfForm.ddate = '2027-01-01'; sb.lineFixDate(); ok('a future date is refused', /future/.test(sb.toasts.pop()));
sb.lfForm.ddate = '2026-07-20'; sb.lineFixDate(); eq('stamped', L('P-UND').deliveredDate, '2026-07-20');
/* only the COO */
sb.canFix = false; sb.lfForm = { po: 'P-UND', lid: 'L4', reason: 'xxxxx', ddate: '2026-07-21' }; sb.lineFixDate(); ok('someone without Correct a record cannot fix', /COO/.test(sb.toasts.pop()) && L('P-UND').deliveredDate === '2026-07-20');
/* cause, from the records */
sb.state.corrections.push({ entityType: 'orderLine', entityId: 'L3', at: '2026-08-01T10:00:00Z', by: 'Someone', reason: 'import', changes: [{ field: 'packed', label: 'Packed', before: '0', after: '2,000' }] });
ok('the cause names the correction that typed packed', /Typed in Correct a record by Someone on 2026-08-01/.test(sb.lineCause(O('P-MAX'), L('P-MAX'))));
sb.state.actionLog.push({ t: '2026-07-05T00:00:00Z', by: 'Ops', what: 'Allocated 150 Kg/L packed V-Mg from stock → P-VMG' });
ok('...or the stock allocation', /from packed stock by Ops/.test(sb.lineCause(O('P-VMG'), L('P-VMG'))));
ok('...and says so when nothing records it', /No record in O2S shows how/.test(sb.lineCause(O('P-UND'), L('P-UND'))));
ok('the history lists the packing, the truck and the corrections', (() => { const h = sb.lineHistory(O('P-VMG'), L('P-VMG')).map(x => x.txt).join('\n'); return /Packed 150 from batch VMG26001/.test(h) && /Truck/.test(h) && /Allocated/.test(h); })());
process.exitCode = report('Fix it where it happened (25b)') ? 1 : 0;
