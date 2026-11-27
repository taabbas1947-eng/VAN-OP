/* BUILD 2026-11-27g. Names on the lab and QA cards (D-387), phase E item 2.
   Tahir ruled on 27 Nov 2026 (design page "O2S names on lab and QA cards, phase E2"):
   Review card: Drafted by [analyst]; Approve card: Drafted by [analyst] · reviewed by [reviewer];
   Pack QC card: shift and in-charge of the latest packing still to inspect, +N more. Display only.
   Run: node names1127g.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

function box(packing) {
  const c = { console, Math, String, Date, JSON, Object, Array };
  vm.createContext(c);
  vm.runInContext(['_tdEsc', 'lotAvail', 'lotBaseNo', 'lotHasBatch', 'lotsFor', 'tdNameLine'].map(grab).join('\n'), c);
  c.state = { packingLog: (packing || []).map(p => Object.assign({ baseBatchNo: 'AP26001' }, p)), batches: [] };
  c.cmpLotHold = () => false;
  return c;
}
const coa = (st, an, rv) => ({ status: st, analyst: an ? { name: an } : undefined, reviewer: rv ? { name: rv } : undefined });

let c = box();
const lotB = { id: 'B1', lots: [{ id: 'L1', coa: coa('analysed', 'Sana Iqbal') }, { id: 'L2', coa: coa('reviewed', 'Sana Iqbal, Hira Khan', 'Asif Ali') }] };
eq('Review card: drafted by the analyst', c.tdNameLine({ label: 'Review', batch: lotB, lid: 'L1' }), 'Drafted by Sana Iqbal');
eq('Approve card: drafted by and reviewed by; 2 analysts both named', c.tdNameLine({ label: 'Approve', batch: lotB, lid: 'L2' }), 'Drafted by Sana Iqbal, Hira Khan · reviewed by Asif Ali');
eq('a batch with no lots uses the batch certificate', c.tdNameLine({ label: 'Review', batch: { id: 'B2', coa: coa('analysed', 'Sana Iqbal') } }), 'Drafted by Sana Iqbal');
eq('the UNFIT lot job (also labelled Review) gets no line', c.tdNameLine({ label: 'Review', batch: { id: 'B3', coa: coa('failed', 'Sana Iqbal') } }), '');
eq('no analyst name: no line, no blank', c.tdNameLine({ label: 'Review', batch: { id: 'B4', coa: coa('analysed') } }), '');
eq('Approve with only a reviewer name', c.tdNameLine({ label: 'Approve', batch: { id: 'B5', coa: coa('reviewed', '', 'Asif Ali') } }), 'Reviewed by Asif Ali');
eq('names are escaped', c.tdNameLine({ label: 'Review', batch: { id: 'B6', coa: coa('analysed', '<b>x</b>') } }), 'Drafted by &lt;b&gt;x&lt;/b&gt;');
eq('other jobs get no line', c.tdNameLine({ label: 'Lab QC', batch: lotB, lid: 'L1' }), '');

const o = { po: 'PO1' }, l = { id: 'ln1', brand: 'Brand A' };
c = box([
  { id: 'PK1', po: 'PO1', lid: 'ln1', kg: 500, insKg: 0, date: '2026-11-25', shift: 'Morning', incharge: 'Faisal Nadeem' },
  { id: 'PK2', po: 'PO1', lid: 'ln1', kg: 400, insKg: 400, date: '2026-11-26', shift: 'Night', incharge: 'Waqas Haider' },
  { id: 'PK3', po: 'PO1', lid: 'ln1', kg: 300, insKg: 0, date: '2026-11-27', shift: 'Evening', incharge: 'Bilal Younas' },
  { id: 'PK4', po: 'PO2', lid: 'ln9', kg: 300, insKg: 0, date: '2026-11-27', shift: 'Night', incharge: 'Other' }
]);
eq('Pack QC: latest waiting entry, +1 more (inspected entry and other PO left out)', c.tdNameLine({ label: 'Pack QC', o, l }), 'Packed: Evening shift, in-charge Bilal Younas · +1 more');
c = box([{ id: 'PK1', po: 'PO1', lid: 'ln1', kg: 500, date: '2026-11-25', shift: 'Morning', incharge: 'Faisal Nadeem' }]);
eq('Pack QC: 1 entry, no +more', c.tdNameLine({ label: 'Pack QC', o, l }), 'Packed: Morning shift, in-charge Faisal Nadeem');
c = box([{ id: 'PK1', po: 'PO1', lid: 'ln1', kg: 500, date: '2026-10-01', by: '(historical)' }]);
eq('Pack QC: an old entry with no shift or in-charge gives no line', c.tdNameLine({ label: 'Pack QC', o, l }), '');
c = box([{ id: 'PK1', po: 'PO1', lid: 'ln1', kg: 500, date: '2026-11-25', shift: 'Morning', incharge: '(historical)' }]);
eq('Pack QC: a (historical) in-charge is not shown', c.tdNameLine({ label: 'Pack QC', o, l }), 'Packed: Morning shift');
c = box([{ id: 'PK1', po: 'PO1', lid: 'ln1', kg: 500, date: '2026-11-25', shift: 'Morning', incharge: 'X', qaHold: true }]);
eq('Pack QC: a lot on QA hold is not waiting, so no line', c.tdNameLine({ label: 'Pack QC', o, l }), '');

/* review fixes, 27 Nov 2026 */
eq('a lot id that no longer exists gives no line (not the batch certificate)', c.tdNameLine({ label: 'Review', batch: { id: 'B7', coa: coa('analysed', 'Sana Iqbal'), lots: [] }, lid: 'L9' }), '');
c = box([
  { id: 'PK1', po: 'PO1', lid: 'ln1', kg: 500, date: '2026-11-25', shift: 'Morning', incharge: 'Faisal Nadeem' },
  { id: 'PK2', po: 'PO1', lid: 'ln1', kg: 300, date: '2026-11-27', shift: 'Night', incharge: 'No Batch', baseBatchNo: '' }
]);
eq('an entry with no batch number is not counted (the Pack QC job cannot inspect it yet)', c.tdNameLine({ label: 'Pack QC', o, l }), 'Packed: Morning shift, in-charge Faisal Nadeem');
/* packingLog is newest first (unshift); 2 runs on one day with ids that sort the wrong way as text */
c = box([
  { id: 'PK999', po: 'PO1', lid: 'ln1', kg: 300, date: '2026-11-27', shift: 'Evening', incharge: 'Bilal Younas' },
  { id: 'PK1000', po: 'PO1', lid: 'ln1', kg: 300, date: '2026-11-27', shift: 'Morning', incharge: 'Faisal Nadeem' }
]);
eq('2 runs on one day: the newest keyed is named', c.tdNameLine({ label: 'Pack QC', o, l }), 'Packed: Evening shift, in-charge Bilal Younas · +1 more');

/* wiring, display only */
const card = grab('tdCardHTML');
ok('the card uses the name line only when it has no other line and holds 1 job', /if\(!line&&n===1\) line=tdNameLine\(one\);/.test(card));
ok('nothing is saved', !/save\(\)/.test(grab('tdNameLine')));
ok('the job list is not touched (routing, rights and checks unchanged)', !/tdNameLine/.test(grab('actionItems')));

/* Guide, build, docs */
ok('the Guide explains the names', /<h2>Names on the lab and QA cards<\/h2>/.test(grab('guideHow')));
ok('BUILD_ID 2026-11-27g or later', /var BUILD_ID='2026-(11-(27[g-z]|2[89][a-z]|30[a-z])|12-\d\d[a-z])';/.test(html));
ok('changelog has 2026-11-27g', /ver:'2026-11-27g'/.test(html));
ok('system documentation carries D-387', /"id":"D-387"/.test(html));

report('names1127g');
