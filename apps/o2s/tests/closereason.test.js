/* 6 Oct 2026 — A CLOSE REASON HAS TO FIT THE STOCK.
   Arain Traders (DLR-SN-TAN-008-2608-3355): V-Zinc 1,000, Vibrant 640, V-Borate 17% 100 and
   VL-Potash 50 were packed in full and asked to be closed as "We could not supply".
   Run: node closereason.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar } = H;
const sb = { console, toasts: [], saved: 0, toast: m => sb.toasts.push(m), fmt: n => Number(n).toLocaleString('en-US'), qsEsc: x => String(x),
  may: () => true, denyRight: () => '', save: () => sb.saved++, render: () => {}, closeModal: () => {}, logAction: () => {}, scArchive: () => {}, scFreeze: () => ({}),
  scWho: () => sb.who, who: 'Saad Jamal', shortCloseGap: l => (+l.ordered || 0) - (+l.delivered || 0), state: { role: 'Supply Chain', currentUser: { username: 'saad' }, audit: [], orders: [] } };
vm.createContext(sb);
vm.runInContext(grabTopVar('SHORTCLOSE_REASONS', '[') + ';\n' + ['scReason', 'lineShortClosed', 'lineShortRequested', 'scPackedConflict', 'scPackedConflictMsg', '_scLine', 'requestShortClose', 'approveShortClose', 'cpOpenLines', 'submitClosePO'].map(grab).join('\n') + '\nvar cpForm=null;', sb);
const L = (id, brand, ordered, packed) => ({ id, brand, ordered, packed, produced: packed, dispatched: 0, delivered: 0 });
const o = { id: 'O1', po: 'DLR-SN-TAN-008-2608-3355', lines: [L('a', 'V-Zinc', 1000, 1000), L('b', 'Vibrant', 640, 640), L('c', 'Cal-Mag V', 60, 0), L('d', 'Green Sulfur', 100, 0), L('e', 'Half', 100, 40)] };
sb.state.orders = [o];
eq('a fully packed product contradicts "We could not supply"', sb.scPackedConflict(o.lines[0], 'our_shortfall'), 1000);
eq('...and "Raw material never arrived"', sb.scPackedConflict(o.lines[0], 'material_unavailable'), 1000);
eq('but not "Customer cancelled the balance"', sb.scPackedConflict(o.lines[0], 'customer_cancelled'), 0);
eq('a product not made does not', sb.scPackedConflict(o.lines[2], 'our_shortfall'), 0);
eq('a product partly packed does not (the rest may truly be short)', sb.scPackedConflict(o.lines[4], 'our_shortfall'), 0);
/* the close sheet, ask mode: the Arain request */
sb.cpForm = { oid: 'O1', pick: { a: 1, b: 1, c: 1, d: 1 }, reasonCode: 'our_shortfall', reason: '', mode: 'ask' };
vm.runInContext('cpForm=this.cpForm', sb);
sb.submitClosePO();
ok('the 6-product style request is refused, naming the packed ones', /V-Zinc \(1,000 Kg\/L packed\), Vibrant \(640 Kg\/L packed\) are already packed in full/.test(sb.toasts.pop()));
ok('...and nothing was asked', !o.lines.some(l => l.shortClose) && sb.saved === 0);
vm.runInContext('cpForm={oid:"O1",pick:{c:1,d:1},reasonCode:"our_shortfall",reason:"",mode:"ask"}', sb);
sb.submitClosePO();
ok('the 2 products not made go through', !!o.lines[2].shortClose && !!o.lines[3].shortClose && !o.lines[0].shortClose);
vm.runInContext('cpForm={oid:"O1",pick:{a:1,b:1},reasonCode:"customer_cancelled",reason:"",mode:"ask"}', sb);
sb.submitClosePO();
ok('the packed ones go through with a reason that fits', o.lines[0].shortClose && o.lines[0].shortClose.reasonCode === 'customer_cancelled');
/* single line ask */
const o2 = { id: 'O2', po: 'P2', lines: [L('z', 'V-Borate 17%', 100, 100)] }; sb.state.orders.push(o2);
sb.requestShortClose('O2', 'z', 'our_shortfall', '');
ok('the 1-product ask is refused the same way', /V-Borate 17% \(100 Kg\/L packed\) is already packed in full/.test(sb.toasts.pop()) && !o2.lines[0].shortClose);
/* approval of a request made before this release */
o2.lines[0].shortClose = { requestedBy: 'Saad Jamal', reasonCode: 'our_shortfall' }; sb.who = 'Fahim Asghar';
sb.approveShortClose('O2', 'z');
ok('a waiting request with that reason cannot be approved; the Plant Manager is told to refuse it', /Refuse this request with that reason/.test(sb.toasts.pop()) && !o2.lines[0].shortClose.approvedAt);
o2.lines[0].shortClose = { requestedBy: 'Saad Jamal', reasonCode: 'customer_cancelled' };
sb.approveShortClose('O2', 'z');
ok('with a reason that fits it is approved', !!o2.lines[0].shortClose.approvedAt);
process.exitCode = report('A close reason has to fit the stock (6 Oct)') ? 1 : 0;
