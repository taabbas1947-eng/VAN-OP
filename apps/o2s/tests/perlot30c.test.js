/* BUILD 2026-10-30c. Tahir, 30 Oct 2026 ("how to resolve it cleanly?", panel answers: a separate build after 30b was pushed; 1 alert per lot):
   each lot's lab job is its own job, so Defer, is on it and the phone and laptop alerts are per lot.
   Live before: HG26047-L4 and L5 shared the name Lab QC|b:B5570-subk, and Mubeen Ahmed's is on it (taken for L3) showed on both.
   Run: node perlot30c.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const ai = grab('actionItems');
/* ---- each lot is its own job (Tahir, 30 Oct: Defer, is on it and alerts per lot) ---- */
['Rework lot', 'Correct COA', 'Lab COA', 'Review COA again', 'Review COA', 'Approve COA', 'UNFIT lot'].forEach(w => {
  const re = new RegExp("batch:b,lid:u\\.id,[^}]*what:'" + w + " — '");
  ok('the ' + w + ' job carries its lot id', re.test(ai)); });
{ const k = { Object, String }; vm.createContext(k); vm.runInContext(grab('acKey'), k);
  const B2 = { id: 'B5570-subk' };
  const k4 = k.acKey({ label: 'Lab QC', batch: B2, lid: 'LOT-L4' }), k5 = k.acKey({ label: 'Lab QC', batch: B2, lid: 'LOT-L5' });
  ok('2 lots of one batch now have 2 different job names (HG26047-L4 and L5 shared one before)', k4 !== k5);
  eq('the name ends with the lot', k4, 'Lab QC|b:B5570-subk|u:LOT-L4');
  eq('a batch with no lots keeps its old name, so its defer and is on it stay', k.acKey({ label: 'Lab QC', batch: B2, lid: '' }), 'Lab QC|b:B5570-subk');
  const def = { [k4]: { until: '2026-11-05' } }; ok('a defer on L4 does not reach L5', !!def[k4] && !def[k5]); }
ok('the alert name of a lab job is its job name, so alerts are per lot too', /return acKey\(it\);/.test(grab('pushKeyOf')) && !/Lab QC|Review|Approve/.test(grab('pushKeyOf')));
ok('a no-lot batch unit has id empty, so its job keeps its old name', /\[\{id:'',no:\(b\.batchNo\|\|''\),coa:b\.coa,rework:b\.rework,date:''\}\]/.test(ai));
ok('the Guide says each lot is its own job', /Each lot is its own job: deferring or taking one lot does not touch the other lots of the batch/.test(grab('guideHow')));
ok('the changelog has the 30c entry and the build matches', /ver:'2026-10-30c'/.test(html) && /Now Defer, is on it and the phone and laptop alerts are per lot/.test(html) && /var BUILD_ID='2026-10-(30[c-z]|31[a-z])'/.test(html) && /var SYSDOC_VER='2026-10-(30[c-z]|31[a-z])'/.test(html));
process.exitCode = report('30c: each lot\'s lab job is its own job') ? 1 : 0;
