/* 7 Oct 2026 (07f) — LIST B: approvals that could be slipped past. Run: node fixesB.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab } = H;
const sb = { console, toasts: [], toast: m => sb.toasts.push(m), fmt: n => String(Math.round(n)), save: () => {}, render: () => {}, closeModal: () => {}, logAction: () => {}, coaFSClose: () => {}, qcAudit2: () => {},
  TODAY: new Date('2026-10-07T06:00:00Z'), canEdit: () => true, hardRole: () => true, may: () => true, denyRight: c => c, sigStamp: () => ({ name: 'X' }), coaTS: () => 't', scWho: () => 'COO' };
vm.createContext(sb);
vm.runInContext(['nid', 'approveRMPR', 'coaDeviation', 'reopenShortClose', 'lineShortClosed'].map(grab).join('\n'), sb);
const last = () => sb.toasts[sb.toasts.length - 1];

/* B8 - withdrawn after the audit: raisePR has no callers, so an approved PR cannot grow */
ok('B8: no change to the PR approval path (the reported loophole is unreachable)', !/reapprove/.test(H.html));

/* B9 */
sb.state = { role: 'Plant Manager', currentUser: { name: 'Fahim' } }; vm.runInContext('var state=this.state', sb);
const ctx = { b: {}, h: { coa: { status: 'failed' } }, L: 'L1' }; sb.coaCtx = () => ctx;
sb.prompt = () => null; sb.coaDeviation();
ok('B9: Cancel on the reason box accepts nothing', ctx.h.coa.status === 'failed' && !ctx.h.coa.deviation && /needs the reason/.test(last()));
sb.prompt = () => 'ok'; sb.coaDeviation(); ok('B9: a 2-letter reason is not enough', ctx.h.coa.status === 'failed');
sb.prompt = () => 'Customer agreed to 0.2% lower zinc'; sb.coaDeviation(); ok('B9: a real reason accepts it as a deviation', ctx.h.coa.status === 'analysed' && ctx.h.coa.deviation === true);
ctx.h.coa = { status: 'approved' }; sb.coaDeviation(); ok('B9: only an UNFIT certificate can be accepted as a deviation', ctx.h.coa.status === 'approved' && !ctx.h.coa.deviation);

/* B10 */
ok('B10: the analyst cannot submit over a certificate that moved on', /if\(h\.coa&&h\.coa\.status&&h\.coa\.status!=='draft'\)\{ toast\('This certificate has moved on/.test(grab('coaSubmitAnalyst')) && grab('coaSubmitAnalyst').indexOf("status!=='draft'") < grab('coaSubmitAnalyst').indexOf('h.coa=JSON.parse'));

/* B11 */
const O = { id: 'O1', po: 'P', lines: [{ id: 'a', brand: 'B', rmPR: { qty: 100, refused: { by: 'COO' } } }] };
sb.state = { orders: [O], audit: [], actionLog: [], role: 'CFO' }; vm.runInContext('state=this.state', sb);
sb.approveRMPR('O1', 'a'); ok('B11: a refused line request cannot be approved from an old screen', !O.lines[0].rmPR.cfoApproved && /was refused/.test(last()));

/* B12 */
ok('B12: closing a batch that is already closed is refused', /if\(b\.status==='closed'\)\{toast\('This batch is already closed\.'\)/.test(grab('doCloseBatch')));

/* B13 */
const O2 = { id: 'O2', po: 'Q', closed: { at: 't', by: 'COO', reasonCode: 'customer_cancelled' }, lines: [{ id: 'x', brand: 'B', shortClose: { approvedAt: 't' } }] };
sb.state = { orders: [O2], audit: [], actionLog: [], role: 'COO' }; vm.runInContext('state=this.state', sb);
sb._scLine = (oid, lid) => ({ o: O2, l: O2.lines[0] }); vm.runInContext('_scLine=this._scLine', sb);
sb.reopenShortClose('O2', 'x');
ok('B13: reopening a line of a PO closed as a whole reopens the PO, close kept as history', O2.closed === null && O2.closedHistory.length === 1 && O2.closedHistory[0].line === 'B' && !sb.lineShortClosed(O2.lines[0]));
process.exitCode = report('List B: approvals (07f)') ? 1 : 0;
