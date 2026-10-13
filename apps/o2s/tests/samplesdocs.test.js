/* FOC sample DCs in Reports, Documents (13 Oct 2026, build 2026-10-13a).
   Run: node samplesdocs.test.js */
const H = require('./harness.js');
const { ok, eq, report, grab, html } = H;

function mk(role, samples, shipments) {
  const state = { role, samples, shipments: shipments || [], orders: [] };
  const src = ['_pe', 'rpEmpty', 'rpDocRows', 'rpSampleDocRows', 'rpDocCount', 'rpDocs'].map(grab).join('\n') +
    '\nreturn {rows:rpSampleDocRows,count:rpDocCount,docs:rpDocs};';
  return new Function('state', 'smpMayView', 'smpList', 'dispatchGroups', 'SMP_STATUS', 'shipPsiBtn', 'printDC', 'printGatePass',
    src)(state, () => ['COO','CFO','KAM','Finance','Finance Desk Officer','Warehouse','Supply Chain Officer','Supply Chain','QA Inspector','Plant Manager'].indexOf(role) > -1,
    () => state.samples, () => [], { gatepass: 'Gate pass issued, Saad to review', delivered: 'Delivered' }, () => '', () => {}, () => {});
}
const S1 = { id: 'SMP1', no: 'SMP-0001', client: 'FMC Pakistan', status: 'delivered', release: { by: 'Fahim' },
  dispatch: { dc: 'SDC-0001', gatePass: 'GP-0157', date: '2026-10-09', how: 'Courier', carrier: 'TCS' } };
const S2 = { id: 'SMP2', no: 'SMP-0002', client: 'Acme <b>', status: 'gatepass', dispatch: { dc: 'SDC-0002', gatePass: 'GP-0158', date: '2026-10-12', how: 'Our vehicle' } };
const S3 = { id: 'SMP3', no: 'SMP-0003', client: 'No Gate Yet', status: 'approved' };

ok('the 13a changelog entry exists (BUILD_ID itself is pinned by buildid.test.js)', /ver:'2026-10-13a'/.test(html));
{ const m = mk('COO', [S1, S2, S3]);
  eq('COO sees the 2 samples that have a DC (not the one without)', m.rows().length, 2);
  eq('count includes samples', m.count(), 2);
  const h = m.docs();
  ok('table lists SDC-0001 and GP-0157', /SDC-0001/.test(h) && /GP-0157/.test(h));
  ok('rows are marked FOC sample', (h.match(/>FOC sample</g) || []).length === 2);
  ok('a released sample has the DC + Gate Pass button', /smpPrint\('SMP1'\)/.test(h));
  ok('an unreleased sample has no print button, says so', !/smpPrint\('SMP2'\)/.test(h) && /prints once released/.test(h));
  ok('status text comes from SMP_STATUS', /Delivered/.test(h) && /Gate pass issued, Saad to review/.test(h));
  ok('client text is escaped', /Acme &lt;b&gt;/.test(h) && !/Acme <b>/.test(h));
  ok('search key carries "foc sample" and the DC', /data-k="[^"]*foc sample[^"]*"/.test(h) && /data-k="[^"]*sdc-0001/.test(h));
  ok('document count says 2 documents', /id="rpDocCount">2 documents</.test(h)); }
/* roles outside the sample chain */
['Production', 'Production Manager', 'Lab Rep', 'QCM', 'AQCM', 'Analyst'].forEach(r => {
  const m = mk(r, [S1, S2]);
  eq(r + ' sees no sample rows', m.rows().length, 0);
  ok(r + ' gets the empty-state text, not a table', /No shipments yet/.test(m.docs())); });
['KAM', 'Finance', 'Warehouse', 'QA Inspector', 'Plant Manager', 'CFO'].forEach(r => eq(r + ' sees the sample rows', mk(r, [S1]).rows().length, 1));
/* trucks and samples together */
{ const state = { role: 'COO', samples: [S1], shipments: [] };
  const src = ['_pe', 'rpEmpty', 'rpDocRows', 'rpSampleDocRows', 'rpDocCount', 'rpDocs'].map(grab).join('\n') + '\nreturn {count:rpDocCount,docs:rpDocs};';
  const m = new Function('state', 'smpMayView', 'smpList', 'dispatchGroups', 'SMP_STATUS', 'shipPsiBtn', 'printDC', 'printGatePass', src)(state, () => true, () => state.samples,
    () => [{ dispId: 'D1', dc: 'DC-0900', gatePass: 'GP-0900', poLabel: 'PO9', client: 'Truck Client', vehicle: 'LEA-1', date: '2026-10-10', stageNow: 'Delivered', pos: ['PO9'] }], {}, () => '', () => {}, () => {});
  eq('1 truck + 1 sample = 2 documents', m.count(), 2);
  const h = m.docs(); ok('both appear in one table', /DC-0900/.test(h) && /SDC-0001/.test(h) && /id="rpDocCount">2 documents</.test(h)); }
ok('kind bar count uses rpDocCount', /kopt\('dc','Delivery Challans & Gate Passes',rpDocCount\(\)\)/.test(html));
ok('Guide says where an FOC sample DC is', /marked <b>FOC sample<\/b>, for the people who may open FOC samples/.test(html));
ok('changelog entry 2026-10-13a exists', /ver:'2026-10-13a'/.test(html));
report();
