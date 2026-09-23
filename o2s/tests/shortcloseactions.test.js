/* Requesting, approving, rejecting and reopening a short close — 23 Sept 2026.
 *
 * Tahir's ruling: "Production, supply chain or anyone in the production, supply
 * chain or finance can ask, leadership approve." Reopen is COO only.
 *
 * The rule worth naming: THE REQUESTER CANNOT APPROVE HIS OWN REQUEST. That is a
 * separation of duties, and it is the first one in this app that can actually
 * fire — the existing five are all skipped, because six of the nine right codes
 * they name were never added to RIGHTS. Both codes here exist from the start, so
 * this one works on the day it ships.
 */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const src = ['lineShortClosed','lineShortRequested','scReason','scWho','scFreeze','_scLine',
             'shortCloseGap','shortCloseAgainstUs','shortCloseRefusal',
             'requestShortClose','approveShortClose','rejectShortClose','reopenShortClose']
  .map(n => { try { return grab(n); } catch (e) { return ''; } }).join('\n\n');

function world(opts) {
  opts = opts || {};
  const l = Object.assign({ id:'L1', brand:'Max Boron', ordered:30000, delivered:18000, packed:18000 }, opts.line || {});
  const o = { id:'O1', po:'PO-2609-018', client:'Arysta', lines:[l] };
  const box = {
    console, l, o,
    state: { orders:[o], role: opts.role || 'Supply Chain', currentUser: opts.user ? {name:opts.user} : null, audit:[] },
    toasts: [], logged: [],
    may: c => (opts.rights || ['po.shortclose_request','po.shortclose_approve','po.reopen']).indexOf(c) > -1,
    denyRight: (c,w) => 'denied: ' + w,
    logAction: m => box.logged.push(String(m)),
    save: () => {}, render: () => {}, closeModal: () => {},
    fmt: n => String(n),
  };
  box.toast = m => box.toasts.push(String(m));
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(H.grabTopVar('SHORTCLOSE_REASONS','[') + '\n' + src, box);
  return box;
}
const last = b => b.toasts[b.toasts.length - 1] || '';

/* ---- requesting ---- */
let b = world({ user:'Zain Ghaffar' });
b.requestShortClose('O1','L1','customer_reduced','took less this season');
ok('a request is recorded',            b.lineShortRequested(b.l) === true);
ok('and is NOT yet a close',           b.lineShortClosed(b.l) === false);
eq('it records who asked',             b.l.shortClose.requestedBy, 'Zain Ghaffar');
eq('it freezes the ordered quantity',  b.l.shortClose.orderedAtClose, 30000);
eq('it freezes what was delivered',    b.l.shortClose.deliveredAtClose, 18000);
eq('l.ordered is untouched',           b.l.ordered, 30000);

b = world({ user:'X', rights:[] });
b.requestShortClose('O1','L1','customer_reduced','x');
ok('without the right, nothing is recorded', !b.l.shortClose && /denied/.test(last(b)));

b = world({ user:'X' });
b.requestShortClose('O1','L1','not_a_reason','x');
ok('an unknown reason is refused', !b.l.shortClose && /reason/i.test(last(b)));

b = world({ user:'X' });
b.requestShortClose('O1','L1','other','');
ok('"other" demands a written reason', !b.l.shortClose && /why/i.test(last(b)));

b = world({ user:'X' });
b.requestShortClose('O1','L1','other','competitor undercut us');
ok('"other" with a reason is accepted', b.lineShortRequested(b.l) === true);

/* ---- approving ---- */
b = world({ user:'Zain Ghaffar' });
b.requestShortClose('O1','L1','customer_cancelled','');
b.state.currentUser = { name:'Zain Ghaffar' };
b.approveShortClose('O1','L1');
ok('THE REQUESTER CANNOT APPROVE HIS OWN REQUEST', b.lineShortClosed(b.l) === false);
ok('and is told why', /somebody else|another/i.test(last(b)));

b.state.currentUser = { name:'Muhammad Faheem Asghar' };
b.approveShortClose('O1','L1');
ok('a second person can approve it',   b.lineShortClosed(b.l) === true);
eq('and is recorded as the approver',  b.l.shortClose.approvedBy, 'Muhammad Faheem Asghar');
ok('the requester is still recorded',  b.l.shortClose.requestedBy === 'Zain Ghaffar');
ok('l.ordered is still untouched',     b.l.ordered === 30000);

b = world({ user:'A', rights:['po.shortclose_request'] });
b.requestShortClose('O1','L1','customer_cancelled','');
b.state.currentUser = { name:'B' };
b.approveShortClose('O1','L1');
ok('approval needs its own right', b.lineShortClosed(b.l) === false && /denied/.test(last(b)));

b = world({ user:'A' });
b.approveShortClose('O1','L1');
ok('nothing to approve is refused cleanly', b.lineShortClosed(b.l) === false && /nothing|no .*request/i.test(last(b)));

/* ---- rejecting ---- */
b = world({ user:'A' });
b.requestShortClose('O1','L1','our_shortfall','');
b.state.currentUser = { name:'B' };
b.rejectShortClose('O1','L1');
ok('a rejected request leaves the line completely open',
   !b.l.shortClose && b.lineShortRequested(b.l) === false && b.lineShortClosed(b.l) === false);

/* ---- reopening ---- */
b = world({ user:'A' });
b.requestShortClose('O1','L1','customer_cancelled','');
b.state.currentUser = { name:'B' };
b.approveShortClose('O1','L1');
b.reopenShortClose('O1','L1');
ok('a reopened line is open again',        b.lineShortClosed(b.l) === false);
ok('the close is kept as history, not deleted',
   !!b.l.shortClose && !!b.l.shortClose.reopenedAt && !!b.l.shortClose.approvedAt);

b = world({ user:'A', rights:['po.shortclose_request','po.shortclose_approve'] });
b.requestShortClose('O1','L1','customer_cancelled','');
b.state.currentUser = { name:'B' };
b.approveShortClose('O1','L1');
b.reopenShortClose('O1','L1');
ok('reopening needs its own right', b.lineShortClosed(b.l) === true && /denied/.test(last(b)));

/* ---- the rights themselves ---- */
['po.shortclose_request','po.shortclose_approve','po.reopen'].forEach(c => {
  ok(c + ' is in the RIGHTS catalogue', new RegExp("code:'" + c.replace('.','\\.') + "'").test(html));
});
ok('approving cannot be delegated by a department lead',
   /code:'po\.shortclose_approve'[\s\S]{0,300}?delegable:false/.test(html));
ok('reopening cannot be delegated either',
   /code:'po\.reopen'[\s\S]{0,300}?delegable:false/.test(html));
ok('leadership approves',
   /code:'po\.shortclose_approve'[\s\S]{0,400}?roles:\['Plant Manager'\]/.test(html));

report();
