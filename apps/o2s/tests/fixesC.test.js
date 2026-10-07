/* 7 Oct 2026 (07g) — LIST C: jobs that stalled or misled. Run: node fixesC.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar } = H;
const ai = grab('actionItems');
/* C14 */
ok('C14: a lab-cleared batch with stock to pack is a Pack job for Production', /if\(!batchPackNow\(b\)\) return; if\(!packJobWanted\(b\)\) return;[\s\S]{0,120}role:'Production',batch:b,labAt:packJobSince\(b\)[\s\S]{0,200}openPackFor\('"\+b\.id\+"'\)",label:'Pack'/.test(ai));
const TL = grabTopVar('TD_LABEL', '{'), TN = grabTopVar('TD_NEXT', '{'), TR = grabTopVar('TD_RIGHT', '{');
ok('C14: the Pack job has a name, a next step (Pack QC) and is shown to whoever may pack', /'Pack':\s*\{title:'Cleared by the lab, ready to pack'/.test(TL) && /'Pack':'Pack QC'/.test(TN) && /'Pack':'packing\.pack'/.test(TR));
/* C15 */
{ const sb = { console, toasts: [], toast: () => {}, save: () => {}, render: () => {}, closeModal: () => {}, logAction: () => {}, _uRole: () => ({ by: 'Saad' }), bpEsc: x => x };
  vm.createContext(sb); vm.runInContext(['prRec', 'prDrop'].map(grab).join('\n') + '\nvar bpForm=null;', sb);
  const l = { id: 'a', brand: 'B', rmStatus: 'short', rmPR: { qty: 100, refused: { by: 'CFO', why: 'stock covers it' } } };
  sb.state = { orders: [{ id: 'O1', po: 'P', lines: [l] }] }; vm.runInContext('var state=this.state', sb);
  sb.prDrop('line', 'O1', 'a');
  ok('C15 (07i): dropping a refused request on a line that could make nothing sends it back to RM Check', l.rmPR.closed === true && l.rmStatus === 'pending' && !!l.rmRecheckAt); }
/* C16 */
ok('C16: the Review truck job names who may not do it (loaded / passed it out)', /notWho:\(g\.rows\|\|\[\]\)\.map\(function\(s\)\{ return \[s\.loadedByUser,s\.gatePassByUser\]; \}\)/.test(ai) && /x\.notWho\.indexOf\(_me\)>-1/.test(grab('tdItems')));
/* C17 */
{ const sb = { console, state: { role: 'Plant Manager' }, may: c => c === 'shipment.plan', roleTitle: r => r, _tdEsc: x => x };
  vm.createContext(sb); vm.runInContext(TR + '\n' + grab('tdCanAct') + '\n' + grab('tdChaseHTML'), sb);
  ok('C17: an escalated lab sign-off gives the Plant Manager no button, only "Chase"', sb.tdCanAct({ _escalated: true, role: 'QCM', label: 'Approve' }) === false && /chase QCM/.test(sb.tdChaseHTML({ role: 'QCM' })));
  ok('C17: an escalated job he holds the right for keeps its button', sb.tdCanAct({ _escalated: true, role: 'Supply Chain', label: 'Ship' }) === true);
  ok('C17: his own jobs always keep their button', sb.tdCanAct({ role: 'Plant Manager', label: 'Release' }) === true);
  sb.state.role = 'COO';
  ok('C17 audit: the COO keeps the button on every job escalated to him', sb.tdCanAct({ _escalated: true, role: 'Plant Manager', label: 'Release' }) === true && sb.tdCanAct({ _escalated: true, role: 'QCM', label: 'Approve' }) === true);
  sb.state.role = 'Plant Manager';
  ok('C17: both the single card and the rows use it', /tdCanAct\(one\)\?/.test(grab('tdCardHTML')) && /tdCanAct\(it\)\?/.test(grab('tdRowHTML'))); }
/* C18 */
{ const sb = { console }; vm.createContext(sb); vm.runInContext(grab('acKey'), sb);
  ok('C18: 2 samples, 2 customers, 2 rejected trucks, 2 moves each get their own key', sb.acKey({ label: 'Issue sample', smp: { id: 'S1' } }) !== sb.acKey({ label: 'Issue sample', smp: { id: 'S2' } }) && sb.acKey({ label: 'Approve customer', cust: { code: 'C1' } }) !== sb.acKey({ label: 'Approve customer', cust: { code: 'C2' } }) && sb.acKey({ label: 'DC rejected', dcr: { id: 'X1' } }) !== sb.acKey({ label: 'DC rejected', dcr: { id: 'X2' } }) && sb.acKey({ label: 'Approve move', mv: 'M1' }) !== sb.acKey({ label: 'Approve move', mv: 'M2' })); }
/* C19 */
const esc = grab('acEscalation');
ok('C19: a waiting move and a close-short request go to the COO after a day; a Pack job to the Production Manager', /'Approve move':\[1,'COO'\],'Approve close short':\[1,'COO'\],'Pack':\[1,'Production Manager'\]/.test(esc));
ok('C19: the Plant Manager\'s Guide lists both decisions', /'Plant Manager':\['Release','Approve DC','Release sample','Approve move','Approve close short'\]/.test(H.html) && /var SIGN_JOBS=TD_SIGN_JOBS;/.test(grab('tdRoleJobs')));
ok('C19: a move card shows its own text (POs and Kg)', /if\(it\.mv\) return _tdEsc\(w\);/.test(grab('_tdWhat')));
ok('C19: the approval sheet warns about an open purchase request and the RM Check', /has a purchase request open for its raw material/.test(grab('renderMoveApprove')) && /Its RM Check stays as it is/.test(grab('renderMoveApprove')));
ok('C19 audit: a move does not reset the source line\'s RM Check (an open PR would block it; part-made lines would be re-checked on the whole order)', !/lA\.rmStatus='pending'/.test(grab('pmvApply')));
/* C20 */
{ const sb = { console, _calDays: () => 1, truckDispatcher: r => r.d };
  vm.createContext(sb); vm.runInContext(grab('deliveryJobs'), sb);
  const j = sb.deliveryJobs({ rows: [{ d: { role: 'Supply Chain', user: 'saad', name: 'Saad' } }], dispId: 'D1', po: 'P' });
  const sc = j.filter(x => x.role === 'Supply Chain');
  ok('C20 audit: when a Supply Chain user sent the truck, the day-1 row stays for the others but not for him', sc.length === 2 && sc[0].who === 'saad' && sc[1].notWho && sc[1].notWho[0] === 'saad');
  const j2 = sb.deliveryJobs({ rows: [{ d: { role: 'Warehouse', user: 'ali', name: 'Ali' } }], dispId: 'D1', po: 'P' });
  ok('C20: a warehouse dispatch gives Saad the day-1 row with nobody excluded', j2.filter(x => x.role === 'Supply Chain').length === 1 && !j2[1].notWho); }
/* audit: Pack job only where packing is owed */
{ const sb = { console }; vm.createContext(sb); vm.runInContext(grab('packLineOwes') + '\n' + grab('packJobWanted'), sb);
  sb.state = { orders: [{ po: 'P1', lines: [{ id: 'L1', brand: 'B', ordered: 1000, packed: 400 }, { id: 'L2', brand: 'C', ordered: 500, packed: 500 }] }] }; vm.runInContext('var state=this.state', sb);
  ok('audit: a PO batch whose line is short of packed is a Pack job', sb.packJobWanted({ kind: 'po', po: 'P1', lineId: 'L1' }) === true);
  ok('audit: a PO batch whose line is fully packed is not', sb.packJobWanted({ kind: 'po', po: 'P1', lineId: 'L2' }) === false);
  ok('audit: bulk stock with no PO is not a standing Pack job', sb.packJobWanted({ kind: 'bulk', base: 'X' }) === false);
  sb.state.orders[0].lines[0].shortClose = { approvedAt: 'x' };
  ok('audit: a line closed short is not', sb.packJobWanted({ kind: 'po', po: 'P1', lineId: 'L1' }) === false); }
{ const at = grab('actTiming');
  ok('audit: a close-short request is aged from the request, not the PO date', /case 'Approve close short': c=\(l\.shortClose&&\(l\.shortClose\.requestedAt/.test(at)); }
ok('C20: a close-short request is its own job, not "Review"', /label:'Approve close short'/.test(ai) && /'Approve close short':\{title:'A request to close a line short'/.test(TL));
ok('C20: a sample QA failed comes back to the warehouse with the reason', /QA failed it: '\+String\(x\.qa\.remarks/.test(grab('smpJobs')));
process.exitCode = report('List C: jobs (07g)') ? 1 : 0;
