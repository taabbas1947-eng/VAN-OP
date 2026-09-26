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

const src = ['lineShortClosed','lineShortRequested','lineShortRefused','lineRefusalOpen','scArchive','scReason','scWho','scFreeze','_scLine',
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
ok('26a: a refusal with no reason is refused', b.lineShortRequested(b.l) === true && /why it is refused/.test(last(b)));
b.rejectShortClose('O1','L1','customer still wants it');
ok('a refused request leaves the line completely open',
   b.lineShortRequested(b.l) === false && b.lineShortClosed(b.l) === false);
/* 26a: the refusal is a recorded fact, never an erase. An erased field is put
   back by the 3-way sync merge from the other person's copy - Fahim refused the
   same Grain Set request 10 times on 26 Sep. */
ok('26a: the request is kept, with who refused it and why',
   !!b.l.shortClose && b.l.shortClose.refusedBy === 'B' && b.l.shortClose.refusedWhy === 'customer still wants it' && !!b.l.shortClose.refusedAt);
ok('26a: it is a refusal the asker has not read yet', b.lineShortRefused(b.l) === true && b.lineRefusalOpen(b.l) === true);
ok('26a: rejectShortClose never deletes the request', !/delete l\.shortClose/.test(grab('rejectShortClose')));
{ /* the sync merge cannot bring the request back: merge3 against the server copy still holding the waiting request */
  const m3 = new Function(grab('_eq') + '\n' + grab('_arrId') + '\n' + grab('merge3') + '\nreturn merge3;')();
  const base = { shortClose: { requestedBy:'A', reasonCode:'our_shortfall' } };
  const local = JSON.parse(JSON.stringify(b.l));
  const srv = { shortClose: { requestedBy:'A', reasonCode:'our_shortfall' } };
  const out = m3(base, local, srv);
  ok('26a: after a sync merge with a copy that never saw the refusal, the refusal stands', !!(out.shortClose && out.shortClose.refusedAt) && b.lineShortRequested(out) === false);
}
/* asking again archives the refusal and opens a new request */
b.state.currentUser = { name:'A' };
b.requestShortClose('O1','L1','customer_reduced','customer confirmed on 26 Sep');
ok('26a: asking again opens a new request', b.lineShortRequested(b.l) === true && !b.l.shortClose.refusedAt);
ok('26a: the refusal moves to the line history, not lost', (b.l.shortCloseHistory||[]).length === 1 && b.l.shortCloseHistory[0].refusedWhy === 'customer still wants it' && !!b.l.shortCloseHistory[0].id);

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

/* ---- the UI wiring ----
   Three separate changes in this file have been built onto a screen that does
   not render, and each time a check that grepped the source passed. So these
   assert the route a person actually takes: My Actions raises it, the modal
   opens it, and the modal refuses to show Approve to the person who asked. */
const ac = grab('actionItems');
ok('My Actions raises a waiting close for the Plant Manager',
   /lineShortRequested\(l\)/.test(ac) && /openShortCloseReview\('/.test(ac));
/* the window is wide because the `what:` line carries the quantity, the reason
   and who asked — all of which a person needs before opening it */
ok('it is raised to leadership, not to whoever is looking',
   /role:'Plant Manager'[\s\S]{0,500}?openShortCloseReview/.test(ac));
ok('a waiting close suppresses every other item on that line',
   /lineShortRequested\(l\)\)\{[\s\S]{0,600}?return;\s*\}/.test(ac));
ok('a decided close raises nothing at all', /if\(lineShortClosed\(l\)\) return;/.test(ac));
ok('the shortfall and the reason are in the wording someone reads',
   /Approve closing short/.test(ac) && /asked by/.test(ac));

const rq = grab('openShortClose');
ok('the request modal asks for the right before opening',
   /may\('po\.shortclose_request'\)/.test(rq));
ok('it refuses to open on a line already closed',  /lineShortClosed\(l\)/.test(rq));
ok('it refuses to open on a line already waiting', /lineShortRequested\(l\)/.test(rq));

const rv = grab('openShortCloseReview');
ok('the review modal works out whether the viewer is the requester',
   /requestedBy\|\|''\)===String\(scWho\(\)\)/.test(rv));
ok('it hides Approve from the person who asked',
   /mine\?'':'<button[^']*approveShortClose/.test(rv));
ok('it always offers Refuse, which asks for the reason first (26a)',  /openShortCloseRefuse\(/.test(rv) && !/rejectShortClose\(/.test(rv));
ok('26a: the refuse form needs the reason', /rejectShortClose\(scRefuseForm\.oid,scRefuseForm\.lid,scRefuseForm\.why\)/.test(grab('openShortCloseRefuse')));
ok('26a: a refusal goes back to the asker on Today', /lineRefusalOpen\(l\)/.test(ac) && /openRefusal\(/.test(ac) && /label:'Refused'/.test(ac) && /who:_as\.user/.test(ac));
ok('26a: the asker can ask again or leave it open', /openShortClose\(/.test(grab('openRefusal')) && /refusalSeen\(/.test(grab('openRefusal')));
ok('it shows what is being given up, not just a yes/no',
   /Closing short/.test(rv) && /still ships/.test(rv));

const rm = grab('renderShortClose');
ok('the request form says packed stock still ships', /still ships/.test(rm));
ok('it names the shortfall before you commit',       /shortfall/.test(rm));
ok('it says whether the reason counts against us',
   /delivery performance/.test(rm));
ok('it says plainly that this is only a request',    /takes effect only when/.test(rm));

report();
