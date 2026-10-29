/* The tiny remainder close - 29 Oct 2026 (build 2026-10-29c).
 *
 * Tahir's rulings, from the design page and his comments:
 *   - a PO line with 50 Kg/L or less left may be closed short by Saad Jamal (Supply Chain),
 *     Muhammad Ismail (Finance) and Muhammad Shoaib (Warehouse), at once, with no Plant Manager step
 *   - not Zain (Supply Chain Officer), not the CFO, not the Finance Desk Officer
 *   - the 3 are told: a card on Today until they tap Read, My job, the Guide
 *   - "left" is ordered minus delivered; a line with nothing delivered counts; no limit per PO
 *   - the same reasons as the normal close; the Plant Manager is not told
 *   - "make sure it shouldn't introduce a new bug, glitch, line error or untracked mark"
 *
 * Run: node tinyclose29c.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

/* ================= 1. THE RIGHT: WHICH ROLES HOLD IT ================= */
function blockAt(n, o) { const i = html.indexOf(n); return H.matchBlock(i, n, o); }
function makeBox() {
  const src = blockAt('const SCREENS=', '[').replace(/^const /, 'var ') + ';\n'
    + H.grabTopVar('DEPTS', '[') + H.grabTopVar('ROLE_DEPT', '{') + H.grabTopVar('RIGHTS', '[')
    + H.grabTopVar('RIGHTS_LIVE', '{') + H.grabTopVar('DISPATCH_LIVE', '[') + H.grabTopVar('DISPATCH_GRANT', '{')
    + H.grabTopVar('PROCUREMENT_LIVE', '[') + H.grabTopVar('PROCUREMENT_GRANT', '{')
    + H.grabTopVar('CUSTOMER_LIVE', '[') + H.grabTopVar('CUSTOMER_GRANT', '{') + '\n'
    + ['rightByCode', 'accessOv', '_ownerEdit', 'accessLevelOn', 'accessLevel', '_canEditOn',
       'mayLegacyRole', 'mayRole', 'rolesOfState', 'roleByName', 'roleIdOf', 'roleRightsOf',
       'seedAnswer', 'seedDeptRightsV1', 'seedTitlesV1', 'scr']
      .map(n => { try { return H.grab(n); } catch (e) { return ''; } }).join('\n\n');
  const box = { console, state: { role: 'COO', screen: 'ship', masters: JSON.parse(JSON.stringify(STATE.masters)) },
                _pe: v => String(v == null ? '' : v), ROLE_TITLE: {}, USER_TITLE: {} };
  box.globalThis = box;
  vm.createContext(box);
  vm.runInContext(src, box);
  box.seedDeptRightsV1(box.state);
  return box;
}
{
  const box = makeBox();
  const r = box.RIGHTS.find(x => x.code === 'po.shortclose_small');
  ok('the right po.shortclose_small exists', !!r);
  ok('it is not delegable: a department lead cannot widen it', r && r.delegable === false);
  eq('it is a hard list of exactly Supply Chain, Finance and Warehouse',
     r && JSON.stringify(r.legacy), JSON.stringify({ kind: 'hard', roles: ['Supply Chain', 'Finance', 'Warehouse'] }));
  ['Supply Chain', 'Finance', 'Warehouse', 'COO'].forEach(role =>
    ok(role + ' may close a small remainder', box.mayRole(role, 'po.shortclose_small') === true));
  ['Supply Chain Officer', 'CFO', 'Finance Desk Officer', 'Plant Manager', 'Production Manager', 'Production',
   'KAM', 'QA Inspector', 'Lab Rep', 'AQCM', 'QCM'].forEach(role =>
    ok(role + ' may NOT close a small remainder', box.mayRole(role, 'po.shortclose_small') === false));
  /* the normal route is untouched */
  eq('asking is still Production Manager and Supply Chain only',
     JSON.stringify(box.RIGHTS.find(x => x.code === 'po.shortclose_request').legacy.roles), JSON.stringify(['Production Manager', 'Supply Chain']));
  eq('approving is still the Plant Manager only',
     JSON.stringify(box.RIGHTS.find(x => x.code === 'po.shortclose_approve').legacy.roles), JSON.stringify(['Plant Manager']));
  ok('the right is in no RIGHTS_LIVE list, so the hard role list answers',
     box.RIGHTS_LIVE['po.shortclose_small'] === undefined);
}

/* ================= 2. THE CLOSE ITSELF ================= */
const names = ['lineShortClosed', 'lineShortRequested', 'lineShortRefused', 'scArchive', 'scReason', 'scWho', 'scFreeze', '_scLine',
  'shortCloseGap', 'shortCloseAgainstUs', 'shortCloseRefusal', 'scPackedConflict', 'scPackedConflictMsg',
  'requestShortClose', 'approveShortClose', 'reopenShortClose',
  'scLeft', 'tinyFmt', 'tinyMade', 'tinyRefusal', 'tinyMay', 'openTinyClose', 'renderTinyClose', 'tinyFresh', 'tinyConfirm', 'tinyShortClose',
  'tinyNoticeDue', 'tinyNoticeCard', 'tinySeen', 'cpOpenLines', 'cpMode', 'closeLineButtonHTML', 'tinyWhyNot', 'tinyWindowOpen', 'winOpenWith', 'tinyRedrawIfIdle', 'tinyPoAgeDays',
  'reopenLineButtonHTML', 'openReopenClose', 'renderReopenClose', 'reopenConfirm', 'tinyOpensOn', 'packLineOwes', 'nid', 'scReopenNote'];
const src = names.map(n => { try { return grab(n); } catch (e) { return 'throw new Error("missing ' + n + '");'; } }).join('\n\n');

function world(opts) {
  opts = opts || {};
  const l = Object.assign({ id: 'L1', brand: 'Max Potash', ordered: 30000, delivered: 29960, packed: 29960 }, opts.line || {});
  const o = { id: 'O1', po: '22868', client: 'Maxim', lines: [l], received: opts.received === undefined ? '2026-09-01' : opts.received };
  const rights = opts.rights || ['po.shortclose_small'];
  const box = {
    console, l, o,
    state: { orders: [o], role: opts.role || 'Supply Chain', currentUser: { name: opts.user || 'Saad Jamal', username: opts.username || 'saad' }, audit: [], seq: 1 },
    toasts: [], logged: [], saves: 0, renders: 0, closed: 0, shown: [],
    may: c => rights.indexOf(c) > -1,
    denyRight: (c, w) => 'denied: ' + w,
    logAction: m => box.logged.push(String(m)),
    save: () => { box.saves++; }, render: () => { box.renders++; }, closeModal: () => { box.closed++; },
    fmt: n => String(n), qsEsc: v => String(v == null ? '' : v), _pe: v => String(v == null ? '' : v), _av: v => String(v == null ? '' : v),
    shortClient: c => String(c || ''),
    authHdr: () => ({}),
    $: id => ({ classList: { add() {}, remove() {} }, set innerHTML(v) { box.shown.push(v); }, get innerHTML() { return box.shown[box.shown.length - 1] || ''; } }),
  };
  box.toast = m => box.toasts.push(String(m));
  box.globalThis = box;
  vm.createContext(box);
  if (opts.fetch) box.fetch = opts.fetch;
  vm.runInContext(H.grabTopVar('SHORTCLOSE_REASONS', '[') + '\n' + 'var SHORTCLOSE_SMALL_KG=50; var SHORTCLOSE_TINY_MIN_DAYS=7; var rcForm=null; var tcForm=null; var _savePending=false; var _rev=5; var _baseSnapshot=null;\n' + src, box);
  return box;
}
const last = b => b.toasts[b.toasts.length - 1] || '';

ok('the limit is 50 and fixed in the program, once', (html.match(/var SHORTCLOSE_SMALL_KG=50;/g) || []).length === 1);
ok('no screen or setting changes the number', !/SHORTCLOSE_SMALL_KG\s*=[^=]/.test(html.replace(/var SHORTCLOSE_SMALL_KG=50;/, '')));

/* who may, and which lines qualify: ordered minus delivered, 50 or less, more than 0.5 */
[
  ['40 left of 30,000', { ordered: 30000, delivered: 29960 }, true],
  ['exactly 50 left', { ordered: 1000, delivered: 950 }, true],
  ['50.01 left', { ordered: 1000, delivered: 949.99 }, false],
  ['51 left', { ordered: 1000, delivered: 949 }, false],
  ['nothing delivered, 36 ordered', { ordered: 36, delivered: 0, packed: 0 }, true],
  ['nothing delivered, 51 ordered', { ordered: 51, delivered: 0, packed: 0 }, false],
  ['2 left of 50 (VL-Boron)', { ordered: 50, delivered: 48, packed: 48 }, true],
  ['37 left, 19 packed beyond delivered (PO 22867): it must ship first', { ordered: 1000, delivered: 963, packed: 982 }, false],
  ['37 left, 19 produced beyond delivered', { ordered: 1000, delivered: 963, packed: 963, produced: 982 }, false],
  ['37 left, 19 on a truck beyond delivered', { ordered: 1000, delivered: 963, packed: 963, dispatched: 982 }, false],
  ['37 left, produced and packed equal to delivered', { ordered: 1000, delivered: 963, packed: 963, produced: 963, dispatched: 963 }, true],
  ['37 left, produced less than delivered (stock delivered from elsewhere)', { ordered: 1000, delivered: 963, packed: 0, produced: 500 }, true],
  ['fully delivered', { ordered: 100, delivered: 100 }, false],
  ['0.4 left counts as delivered', { ordered: 100, delivered: 99.6 }, false],
  ['over-delivered', { ordered: 100, delivered: 120 }, false],
  ['a big open line, 20,000 left', { ordered: 30000, delivered: 10000 }, false],
].forEach(c => {
  const b = world({ line: Object.assign({ packed: c[1].delivered }, c[1]) });
  ok('qualifies? ' + c[0], (b.tinyRefusal(b.o, b.l) === '') === c[2], b.tinyRefusal(b.o, b.l));
  ok('tinyMay agrees? ' + c[0], b.tinyMay(b.o, b.l) === c[2]);
});

/* a good close */
{
  const b = world({ user: 'Saad Jamal', username: 'saad', line: { ordered: 1000, delivered: 963, packed: 963 } });
  b.tinyShortClose('O1', 'L1', 'customer_reduced', 'took less');
  ok('the line is now closed short', b.lineShortClosed(b.l) === true);
  const sc = b.l.shortClose;
  eq('it records who closed it', sc.approvedBy, 'Saad Jamal');
  eq('who is also recorded as the asker', sc.requestedBy, 'Saad Jamal');
  eq('with his username', sc.requestedUser, 'saad');
  eq('and his role', sc.requestedRole, 'Supply Chain');
  ok('both times are written', !!sc.approvedAt && !!sc.requestedAt);
  eq('it is marked a tiny remainder', sc.tinyRemainder, true);
  eq('the limit that applied is written on it', sc.tinyLimit, 50);
  eq('how much was left is written on it', sc.leftAtClose, 37);
  eq('the ordered quantity is frozen', sc.orderedAtClose, 1000);
  eq('the delivered quantity is frozen', sc.deliveredAtClose, 963);
  eq('the packed quantity is frozen', sc.packedAtClose, 963);
  eq('l.ordered is never rewritten', b.l.ordered, 1000);
  eq('the shortfall reads 37', b.shortCloseGap(b.l), 37);
  eq('the reason is kept', sc.reasonCode, 'customer_reduced');
  eq('and the words', sc.reason, 'took less');
  ok('a customer reason is not counted against us', b.shortCloseAgainstUs(b.l) === false);
  ok('it was saved once and drawn once', b.saves === 1 && b.renders === 1 && b.closed === 1);
  ok('it is in the action log', b.logged.length === 1 && /Tiny remainder closed short/.test(b.logged[0]) && /Saad Jamal/.test(b.logged[0]) && /37/.test(b.logged[0]));
  eq('it is in the audit trail', b.state.audit.length, 1);
  eq('with its own field name', b.state.audit[0].field, 'Tiny remainder closed short');
  ok('and the PO, the product, the user and the time', b.state.audit[0].po === '22868' && b.state.audit[0].brand === 'Max Potash' && b.state.audit[0].user === 'Saad Jamal' && !!b.state.audit[0].t);
  ok('no history row is invented on a first close', !b.l.shortCloseHistory);
  ok('the line is told it is closed', /closed short/.test(last(b)));
  ok('the closed line no longer offers any button', b.closeLineButtonHTML(b.o, b.l) === '');
  /* a second try is refused cleanly and changes nothing */
  const before = JSON.stringify(b.l);
  b.tinyShortClose('O1', 'L1', 'customer_reduced', 'again');
  ok('closing twice is refused', /already closed/.test(last(b)) && JSON.stringify(b.l) === before);
  ok('and writes nothing more', b.saves === 1 && b.logged.length === 1 && b.state.audit.length === 1);
}

/* nothing delivered: Tahir said yes */
{
  const b = world({ user: 'Muhammad Shoaib', username: 'shoaib', role: 'Warehouse', line: { brand: 'Grain Set', ordered: 36, delivered: 0, packed: 0 } });
  b.tinyShortClose('O1', 'L1', 'customer_no_uptake', '');
  ok('36 ordered, 0 delivered closes', b.lineShortClosed(b.l) === true);
  eq('left at close is 36', b.l.shortClose.leftAtClose, 36);
  eq('the role is Warehouse', b.l.shortClose.requestedRole, 'Warehouse');
}

/* refusals leave NOTHING behind */
function untouched(name, mk, call, re) {
  const b = mk(); const before = JSON.stringify(b.l); const aud = b.state.audit.length;
  call(b);
  ok(name + ': nothing is recorded', JSON.stringify(b.l) === before && b.state.audit.length === aud && b.logged.length === 0 && b.saves === 0 && b.renders === 0,
     JSON.stringify(b.l) + ' ' + b.logged.join('|'));
  ok(name + ': and it says why', re.test(last(b)), last(b));
}
untouched('without the right', () => world({ rights: [] }), b => b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'), /denied/);
untouched('a Supply Chain Officer', () => world({ rights: ['po.shortclose_request'], role: 'Supply Chain Officer' }), b => b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'), /denied/);
untouched('51 Kg/L left', () => world({ line: { ordered: 1000, delivered: 949 } }), b => b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'), /50 Kg\/L or less.*Plant Manager/);
untouched('20,000 left', () => world({ line: { ordered: 30000, delivered: 10000 } }), b => b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'), /Plant Manager/);
untouched('no reason', () => world(), b => b.tinyShortClose('O1', 'L1', '', ''), /reason/);
untouched('an unknown reason', () => world(), b => b.tinyShortClose('O1', 'L1', 'because', 'x'), /reason/);
untouched('"Other" with no words', () => world(), b => b.tinyShortClose('O1', 'L1', 'other', '   '), /why/i);
untouched('a missing line', () => world(), b => b.tinyShortClose('O1', 'NOPE', 'customer_reduced', 'x'), /not found/);
untouched('a missing order', () => world(), b => b.tinyShortClose('NOPE', 'L1', 'customer_reduced', 'x'), /not found/);
untouched('a fully delivered line', () => world({ line: { ordered: 100, delivered: 100 } }), b => b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'), /Nothing is open/);
untouched('a request already waiting for the Plant Manager',
  () => { const b = world(); b.l.shortClose = { requestedBy: 'Zain', requestedAt: 'x', reasonCode: 'customer_reduced', ordered: 1 }; return b; },
  b => b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'), /already waiting for a decision/);
untouched('already closed short',
  () => { const b = world(); b.l.shortClose = { approvedAt: 'x', reasonCode: 'customer_reduced' }; return b; },
  b => b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'), /already closed/);
untouched('a line with the last 40 packed and waiting to ship (any reason)',
  () => world({ line: { ordered: 30000, delivered: 29960, packed: 30000 } }),
  b => b.tinyShortClose('O1', 'L1', 'customer_cancelled', 'x'), /40 Kg\/L of Max Potash is already made and not yet delivered/);
untouched('a line with the last 40 produced and not packed',
  () => world({ line: { ordered: 30000, delivered: 29960, packed: 29960, produced: 30000 } }),
  b => b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'), /made and not yet packed\. Pack and ship it first/);
untouched('a line with 40 on a truck',
  () => world({ line: { ordered: 30000, delivered: 29960, packed: 29960, dispatched: 30000 } }),
  b => b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'), /on a truck and not yet marked delivered\. Mark it delivered first/);
untouched('a line with a raw material purchase request still open',
  () => { const b = world(); b.l.rmPR = { qty: 40, closed: false }; return b; },
  b => b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'), /raw material purchase request is still open/);
{
  const b = world(); b.l.rmPR = { qty: 40, closed: true };
  ok('a closed raw material request does not stop it', b.tinyRefusal(b.o, b.l) === '');
  const c = world(); c.l.rmPR = null;
  ok('and no request at all does not stop it', c.tinyRefusal(c.o, c.l) === '');
}
untouched('50.01 left says 50.01, not 50',
  () => world({ line: { ordered: 1000, delivered: 949.99, packed: 949.99 } }),
  b => b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'), /has 50\.01 Kg\/L left/);
ok('the refusal sentences carry no personal names', (() => {
  const b = world({ line: { ordered: 1000, delivered: 100, packed: 100 } });
  const all = [b.tinyRefusal(b.o, b.l)];
  const c = world(); c.l.shortClose = { requestedAt: 'x' }; all.push(c.tinyRefusal(c.o, c.l));
  const d = world(); d.l.shortClose = { refusedAt: 'x' }; all.push(d.tinyRefusal(d.o, d.l));
  const e = world({ line: { packed: 30000 } }); all.push(e.tinyRefusal(e.o, e.l));
  return !/Fahim|Majid|Saad|Zain|Tahir|Ismail|Shoaib/.test(all.join(' | ')) && all.every(x => x.length > 20);
})());
ok('and the window and the notice carry none either', (() => {
  const b = world({ line: { ordered: 1000, delivered: 990, packed: 990 } }); b.openTinyClose('O1', 'L1');
  return !/Fahim|Majid|Saad|Zain|Tahir|Ismail|Shoaib/.test((b.shown[0] || '') + b.tinyNoticeCard());
})());

{
  const b = world({ line: { ordered: 30000, delivered: 29960, packed: 29960 } });
  b.tinyShortClose('O1', 'L1', 'our_shortfall', '');
  ok('"we could not supply" counts against us', b.lineShortClosed(b.l) && b.shortCloseAgainstUs(b.l) === true);
}

/* a close that was already refused or reopened is NOT closed this way: the Plant Manager / the COO decided it */
{
  const mk = (sc, hist) => { const b = world(); if (sc) b.l.shortClose = sc; if (hist) b.l.shortCloseHistory = hist; return b; };
  [
    ['a refusal sits on the line', mk({ requestedBy: 'X', requestedAt: 't1', reasonCode: 'commercial', refusedAt: 't2', refusedBy: 'Y', refusedWhy: 'wait' })],
    ['a refusal was read and the line left open', mk({ requestedBy: 'X', requestedAt: 't1', reasonCode: 'commercial', refusedAt: 't2', refusedBy: 'Y', refusedWhy: 'wait', refusalSeenAt: 't3' })],
    ['a close was reopened', mk({ requestedBy: 'X', requestedAt: 't1', reasonCode: 'commercial', approvedAt: 't2', reopenedAt: 't3' })],
    ['an earlier refusal is in the history', mk(null, [{ id: 'SCH1', refusedAt: 't2', refusedWhy: 'wait' }])],
    ['an earlier reopen is in the history', mk(null, [{ id: 'SCH2', approvedAt: 't2', reopenedAt: 't3' }])],
  ].forEach(c => {
    const b = c[1]; const before = JSON.stringify(b.l);
    ok(c[0] + ': not closable this way, and it says so', /already refused or reopened/.test(b.tinyRefusal(b.o, b.l)), b.tinyRefusal(b.o, b.l));
    ok(c[0] + ': no button', b.tinyMay(b.o, b.l) === false);
    b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x');
    ok(c[0] + ': nothing is recorded', JSON.stringify(b.l) === before && b.saves === 0 && b.logged.length === 0 && b.state.audit.length === 0);
    b.openTinyClose('O1', 'L1');
    ok(c[0] + ': the window does not open', b.shown.length === 0);
  });
  /* a history of other things (an old approved-and-reopened is covered; an old plain request is not a decision) */
  const h = mk(null, [{ id: 'SCH3', requestedAt: 't1' }]);
  ok('a history entry with no decision in it does not stop the close', h.tinyRefusal(h.o, h.l) === '');
  /* the normal route still takes such a line: ask again, the refusal is archived */
  const n = world({ rights: ['po.shortclose_request'], role: 'Supply Chain' });
  n.l.shortClose = { requestedBy: 'X', requestedAt: 't1', reasonCode: 'commercial', refusedAt: 't2', refusedBy: 'Y', refusedWhy: 'wait' };
  n.requestShortClose('O1', 'L1', 'customer_reduced', 'now small');
  ok('asking the Plant Manager again still works', n.lineShortRequested(n.l) === true && (n.l.shortCloseHistory || []).length === 1);
}

/* review fix: a line the role may not close this way says why, where the button would be (it used to be an empty space) */
{
  const why = (rights, role, line) => { const b = world({ rights, role, line }); return { b, html: b.closeLineButtonHTML(b.o, b.l) }; };
  let r = why(['po.shortclose_small'], 'Warehouse', { ordered: 1000, delivered: 963, packed: 982 });
  ok('Warehouse, stock made and not yet delivered: no button, but the reason is on screen', !/<button/.test(r.html) && /Small remainder:/.test(r.html) && /already made and not yet delivered/.test(r.html), r.html);
  r = why(['po.shortclose_small'], 'Finance', { ordered: 1000, delivered: 960, packed: 960, rmPR: { qty: 5, closed: false } });
  ok('Finance, raw material request open: the reason is on screen', !/<button/.test(r.html) && /raw material purchase request/.test(r.html), r.html);
  r = why(['po.shortclose_small'], 'Warehouse', { ordered: 1000, delivered: 960, packed: 960 });
  ok('a line that can be closed shows the button and no reason line', /Close small remainder/.test(r.html) && !/Small remainder:/.test(r.html));
  r = why(['po.shortclose_small'], 'Warehouse', { ordered: 1000, delivered: 900, packed: 900 });
  ok('more than 50 left: nothing is drawn for Warehouse (not a small remainder at all)', r.html === '');
  r = why(['po.shortclose_small'], 'Warehouse', { ordered: 1000, delivered: 1000, packed: 1000 });
  ok('nothing left: nothing is drawn', r.html === '');
  r = why(['po.shortclose_small', 'po.shortclose_request'], 'Supply Chain', { ordered: 1000, delivered: 963, packed: 982 });
  ok('Supply Chain keeps its Ask button and also sees the reason', /Ask to close this line/.test(r.html) && /already made and not yet delivered/.test(r.html), r.html);
  r = why(['po.shortclose_small'], 'Warehouse', { ordered: 1000, delivered: 960, packed: 960, shortClose: { requestedBy: 'X', requestedAt: 't' } });
  ok('a close already waiting for a decision is explained', /waiting for a decision/.test(r.html), r.html);
  r = why(['po.shortclose_small'], 'Warehouse', { ordered: 1000, delivered: 960, packed: 960, shortClose: { requestedBy: 'X', requestedAt: 't', approvedAt: 't2', reasonCode: 'commercial' } });
  ok('an already closed line draws nothing', r.html === '');
  const co = world({ rights: ['po.shortclose_small'], role: 'COO', line: { ordered: 1000, delivered: 963, packed: 982 } });
  ok('the COO never gets the small remainder line', !/Small remainder:/.test(co.closeLineButtonHTML(co.o, co.l)));
  const nr = world({ rights: [], role: 'Production Manager', line: { ordered: 1000, delivered: 963, packed: 982 } });
  ok('a role without the right never gets it', !/Small remainder:/.test(nr.closeLineButtonHTML(nr.o, nr.l)));
}

/* review fix: Cancel really cancels. The window is closed or replaced while the latest figures are being checked */
{
  ok('closeModal puts the small remainder form away', /function closeModal\(\)\{[^\n]*try\{tcForm=null;\}catch\(e\)\{\} try\{rcForm=null;\}catch\(e\)\{\} \}/.test(html));
  ok('a tap outside the window and Cancel both go through closeModal', /<button class="ghost" onclick="closeModal\(\)">Cancel<\/button><button class="green"/.test(html));
}

const winStub = (b, open, hasButton) => { b.$ = () => ({ classList: { contains: () => open, add() {}, remove() {} }, querySelector: () => (hasButton ? {} : null), set innerHTML(v) { b.shown.push(v); }, get innerHTML() { return ''; } }); };
function heldWorld() { let release; const gate = new Promise(r => { release = r; }); const b = world({ line: tinyLine }); b.tinyFresh = async () => { await gate; return true; }; b.openTinyClose('O1', 'L1'); return { b, release }; }

/* the COO can reopen a tiny close; the close stays as history; it cannot be closed this way a second time */
{
  const b = world({ rights: ['po.shortclose_small', 'po.reopen'], user: 'Tahir Abbas', username: 'tahir' });
  b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x');
  b.reopenShortClose('O1', 'L1');
  ok('the COO right reopens a tiny close', b.lineShortClosed(b.l) === false && !!b.l.shortClose.reopenedAt);
  ok('the tiny marks stay on the reopened record', b.l.shortClose.tinyRemainder === true && b.l.shortClose.leftAtClose === 40);
  const before = JSON.stringify(b.l); const saves = b.saves;
  b.tinyShortClose('O1', 'L1', 'customer_cancelled', 'again');
  ok('a reopened line is not closed this way again', JSON.stringify(b.l) === before && b.saves === saves && /already refused or reopened/.test(last(b)));
}

/* the normal route is unchanged: asking for 40 Kg/L still needs the Plant Manager */
{
  const b = world({ rights: ['po.shortclose_request', 'po.shortclose_approve'], user: 'Zain', username: 'zain' });
  b.requestShortClose('O1', 'L1', 'customer_reduced', '');
  ok('asking for a tiny line is still only a request', b.lineShortRequested(b.l) === true && b.lineShortClosed(b.l) === false);
  ok('and carries no tiny mark', b.l.shortClose.tinyRemainder === undefined);
  b.approveShortClose('O1', 'L1');
  ok('the one who asked still cannot approve it', b.lineShortClosed(b.l) === false && /Somebody else/.test(last(b)));
}

/* ================= 3. THE BUTTON ================= */
{
  const tiny = { ordered: 30000, delivered: 29960 }, big = { ordered: 30000, delivered: 10000 };
  const btn = (opts) => { const b = world(opts); return b.closeLineButtonHTML(b.o, b.l); };
  ok('Supply Chain sees Close small remainder on a tiny line',
     /Close small remainder/.test(btn({ role: 'Supply Chain', rights: ['po.shortclose_small', 'po.shortclose_request'], line: tiny })));
  ok('and opens the tiny window, not the normal sheet',
     /openTinyClose\('O1','L1'\)/.test(btn({ role: 'Supply Chain', rights: ['po.shortclose_small', 'po.shortclose_request'], line: tiny })));
  ok('Supply Chain still sees Ask to close this line on a big line',
     /Ask to close this line/.test(btn({ role: 'Supply Chain', rights: ['po.shortclose_small', 'po.shortclose_request'], line: big })));
  ok('Finance sees the button on a tiny line', /Close small remainder/.test(btn({ role: 'Finance', rights: ['po.shortclose_small'], line: tiny })));
  ok('Finance sees nothing on a big line', btn({ role: 'Finance', rights: ['po.shortclose_small'], line: big }) === '');
  ok('Warehouse sees the button on a tiny line', /Close small remainder/.test(btn({ role: 'Warehouse', rights: ['po.shortclose_small'], line: tiny })));
  ok('the Supply Chain Officer sees nothing', btn({ role: 'Supply Chain Officer', rights: [], line: tiny }) === '');
  ok('a Production Manager asks, as before', /Ask to close this line/.test(btn({ role: 'Production Manager', rights: ['po.shortclose_request'], line: tiny })));
  ok('the COO still gets the direct close, never the tiny one',
     /Close this line/.test(btn({ role: 'COO', rights: ['po.shortclose_small', 'po.shortclose_request', 'po.close'], line: tiny })) &&
     !/small remainder/.test(btn({ role: 'COO', rights: ['po.shortclose_small', 'po.shortclose_request', 'po.close'], line: tiny })));
  ok('a line waiting for the Plant Manager shows no tiny button',
     !/small remainder/.test((() => { const b = world({ role: 'Finance', rights: ['po.shortclose_small'], line: tiny }); b.l.shortClose = { requestedAt: 'x', requestedBy: 'Zain' }; return b.closeLineButtonHTML(b.o, b.l); })()));
  /* the window */
  const b = world({ line: tiny, rights: ['po.shortclose_small'] });
  b.openTinyClose('O1', 'L1');
  const w = b.shown[b.shown.length - 1] || '';
  ok('the window names the product, the PO and the 40 left', /Max Potash/.test(w) && /22868/.test(w) && /<b>40 Kg\/L<\/b> is left/.test(w));
  ok('it says plainly: closes now, nobody approves, Plant Manager not told, production not told',
     /closes <b>now<\/b>/.test(w) && /nobody approves it/.test(w) && /Plant Manager is not told/.test(w) && /production is not told/.test(w));
  ok('it says only the COO can reopen it, and says nothing false about performance or packed stock',
     !/delivery performance/.test(w) && !/already packed still ships/.test(w) && /Only the COO can reopen it\./.test(w) && !/Undo button/.test(w) && !/cannot be undone/.test(w));
  ok('it says what the report will do with the reason', /(not )?listed as ours in the Closed short report/.test((() => { const x = world({ line: tiny, rights: ['po.shortclose_small'] }); x.openTinyClose('O1', 'L1'); vm.runInContext("tcForm.reasonCode='our_shortfall'; renderTinyClose();", x); return x.shown[x.shown.length - 1]; })()));
  ok('it offers the same reasons as the normal close',
     b.eval ? true : (w.match(/<option value="/g) || []).length === 9 /* the empty choice + 8 reasons */, String((w.match(/<option value="/g) || []).length));
  ok('and a button that names the quantity and calls the checked route, never the bare close',
     /Close 40 Kg\/L short now/.test(w) && /onclick="tinyConfirm\(\)"/.test(w) && !/onclick="tinyShortClose/.test(w));
  const big2 = world({ line: big, rights: ['po.shortclose_small'] });
  big2.openTinyClose('O1', 'L1');
  ok('a big line does not open the window', big2.shown.length === 0 && /Plant Manager/.test(last(big2)));
  const nor = world({ line: tiny, rights: [] });
  nor.openTinyClose('O1', 'L1');
  ok('without the right the window does not open', nor.shown.length === 0 && /denied/.test(last(nor)));
}

/* ================= 4. THE NOTICE ================= */
{
  const b = world({ username: 'saad', line: { ordered: 1000, delivered: 990 } });
  ok('a holder who has not read it is due', b.tinyNoticeDue() === true);
  const card = b.tinyNoticeCard();
  ok('the card says 50 Kg/L, Close small remainder and that the Plant Manager is not told',
     /50 Kg\/L or less/.test(card) && /Close small remainder/.test(card) && /Plant Manager is not told/.test(card));
  ok('and has the Read button', /onclick="tinySeen\(\)"/.test(card) && /Read/.test(card));
  b.tinySeen();
  ok('after Read it is not due', b.tinyNoticeDue() === false && b.tinyNoticeCard() === '');
  eq('Read is kept per person', Object.keys(b.state.tinyCloseSeen).join(','), 'saad');
  ok('with a time', /^\d{4}-\d\d-\d\dT/.test(b.state.tinyCloseSeen.saad));
  ok('it is saved and logged', b.saves === 1 && b.logged.length === 1 && /Read the notice/.test(b.logged[0]) && /Saad Jamal/.test(b.logged[0]));
  /* the next person on the same state still sees it */
  b.state.currentUser = { name: 'Muhammad Ismail', username: 'ismaeel' }; b.state.role = 'Finance';
  ok('another holder still gets it', b.tinyNoticeDue() === true);
  b.tinySeen();
  eq('both are kept', Object.keys(b.state.tinyCloseSeen).sort().join(','), 'ismaeel,saad');
  const c = world({ username: 'tahir', role: 'COO' }); c.state.role = 'COO';
  ok('the COO is not shown the notice', c.tinyNoticeDue() === false);
  const d = world({ rights: [], username: 'zain', role: 'Supply Chain Officer' });
  ok('a person without the right is not shown it', d.tinyNoticeDue() === false && d.tinyNoticeCard() === '');
  d.tinySeen();
  ok('and cannot mark it read for a right he does not hold', !d.state.tinyCloseSeen);
  const e = world({}); e.state.currentUser = null;
  ok('no user, no notice, no crash', e.tinyNoticeDue() === false && e.tinyNoticeCard() === '');
  e.tinySeen();
  ok('and no write', e.saves === 0);
}
/* the saved record survives a clash between 2 saves: 2 people reading it at the same moment keep BOTH marks */
{
  const bx = { console, JSON, _eq: null };
  bx.globalThis = bx; vm.createContext(bx);
  vm.runInContext(['_arrId', '_eq', 'merge3'].map(grab).join('\n'), bx);
  const base = { tinyCloseSeen: {} };
  const mine = { tinyCloseSeen: { saad: '2026-10-29T09:00:00Z' } };
  const theirs = { tinyCloseSeen: { ismaeel: '2026-10-29T09:00:01Z' } };
  const m = vm.runInContext('(function(b,l,s){return JSON.stringify(merge3(b,l,s));})', bx)(base, mine, theirs);
  const o = JSON.parse(m);
  ok('2 people reading at once: both marks survive the merge', o.tinyCloseSeen.saad && o.tinyCloseSeen.ismaeel, m);
  const m2 = JSON.parse(vm.runInContext('(function(b,l,s){return JSON.stringify(merge3(b,l,s));})', bx)(undefined, mine, { orders: [] }));
  ok('a copy that never had the key keeps ours', m2.tinyCloseSeen && m2.tinyCloseSeen.saad);
}

/* ================= 5. WHERE IT IS WIRED ================= */
{
  const td = grab('screenToday');
  ok('Today shows the card after the alerts card', td.indexOf('h+=pushCard();') > -1 && td.indexOf('h+=tinyNoticeCard();') > td.indexOf('h+=pushCard();'));
  ok('and before the job list', td.indexOf('h+=tinyNoticeCard();') < td.indexOf('tdTallyHTML'));
  const tm = grab('tinyShortClose');
  ok('the close checks the right first', tm.indexOf("may('po.shortclose_small')") > -1 && tm.indexOf("may('po.shortclose_small')") < tm.indexOf('l.shortClose='));
  ok('it re-checks the 50 at the moment of closing, not when the window opened', tm.indexOf('tinyRefusal(o,l)') > -1);
  ok('it never edits the ordered quantity', !/l\.ordered\s*=[^=]/.test(tm));
  ok('it never touches the PO-level close', !/o\.closed\s*=/.test(tm));
  ok('it archives a decided earlier record before replacing it', tm.indexOf('scArchive(l)') > -1 && tm.indexOf('scArchive(l)') < tm.indexOf('l.shortClose='));
  const ap = grab('approveShortClose');
  ok('the 23 Sep two-person rule is still in approveShortClose', /You asked for this close\. Somebody else must approve it\./.test(ap));
  ok('requestShortClose does not set the tiny mark', !/tinyRemainder/.test(grab('requestShortClose')) && !/tinyRemainder/.test(grab('submitClosePO')));
  const rep = html.slice(html.indexOf("how:(sc.tinyRemainder"), html.indexOf("how:(sc.tinyRemainder") + 220);
  ok('the Closed short report has a How it was closed column', /Tiny remainder, no approval/.test(rep) && /{k:'how',l:'How it was closed',t:'dim'}/.test(html));
  ok('and it is in the default view of the ready report', /ds:'shortclose', cols:\[[^\]]*'approvedby','how'\]/.test(html));
  ok('a close approved by the COO is not labelled as the Plant Manager\'s alone', /Approved by the Plant Manager or the COO/.test(rep));
  ok('the frozen 0 is read as a real number in both places that read it', (html.match(/sc\.tinyRemainder&&sc\.deliveredAtClose!=null&&isFinite\(\+sc\.deliveredAtClose\)/g) || []).length === 2);
  ok('the report shows no approver for a close that nobody approved', /approvedby:\(sc\.tinyRemainder\?'None, closed at once':\(sc\.approvedBy\|\|''\)\)/.test(html));
  ok('the window gives the unit with the limit and with the ordered quantity', /'\+SHORTCLOSE_SMALL_KG\+' Kg\/L or less, so you may close it yourself/.test(html) && /ordered '\+tinyFmt\(ord\)\+' Kg\/L · delivered /.test(html));
  ok('the changelog names the people the way the app does', /Saad \(Supply Chain\), Ismaeel \(Finance\) and Shoaib \(Warehouse\)/.test(html) && !/Muhammad Ismail/.test(html.replace(/SYSDOC_DATA_START[\s\S]*$/, '')));
  ok('the notice says only the COO can reopen it, the 7 day rule, the screen tells why, and Supply Chain can ask for more than 50', (() => { const w = world(); const n = w.tinyNoticeCard(); return /Only the COO can reopen it\./.test(n) && /at least 7 days old/.test(n) && /The screen tells you why/.test(n) && /Supply Chain can ask for it/.test(n) && !/Muhammad|Ismail/.test(n); })());
  ok('the screen only reaches the close through tinyConfirm, which asks for fresh figures first',
     /tinyFresh\(\)\.then\(/.test(grab('tinyConfirm')) && grab('tinyConfirm').indexOf('tinyFresh()') < grab('tinyConfirm').indexOf('tinyShortClose('));
  ok('tinyFresh refuses to pull over an unsaved change', grab('tinyFresh').indexOf('_savePending') > -1 && grab('tinyFresh').indexOf('_savePending') < grab('tinyFresh').indexOf('/api/state'));
  ok('My job tells the roles that hold it', /<b>Small remainder\.<\/b>/.test(grab('guideMyJob')));
  ok('the Guide has the rule', /<h3>A PO line with 50 Kg\/L or less left<\/h3>/.test(grab('guideRules')) && /'A PO line with 50 Kg\/L or less left':'R-048'/.test(html));
  ok('the build and the changelog agree', /var BUILD_ID='2026-10-29c'/.test(html) && /ver:'2026-10-29c'/.test(html));
  ok('the right is in the sign-off free list of RIGHTS only once', (html.match(/code:'po\.shortclose_small'/g) || []).length === 1);
  /* every place that tests for a closed line still goes through the one function */
  ok('lineStage still answers Closed short for it', /if\(lineShortClosed\(l\)\) return 'Closed short';/.test(grab('lineStage')));
}

/* ================= 6. FRESH FIGURES BEFORE CLOSING (it is async) ================= */
const tinyLine = { ordered: 1000, delivered: 990, packed: 990 };
const jr = x => ({ ok: true, json: async () => x });
const setForm = (b, code, why) => vm.runInContext('tcForm.reasonCode=' + JSON.stringify(code) + '; tcForm.reason=' + JSON.stringify(why || '') + ';', b);
const formOf = b => vm.runInContext('tcForm', b);
function confirmWorld(fresh) { const b = world({ line: tinyLine }); b.tinyFresh = fresh; b.openTinyClose('O1', 'L1'); return b; }

(async () => {
  /* the frozen 0 */
  { const b = world();
    eq('a frozen 0 delivered is a real 0 (36 ordered, 0 delivered at close, 100 later)',
       b.shortCloseGap({ ordered: 36, delivered: 100, shortClose: { approvedAt: 't', tinyRemainder: true, orderedAtClose: 36, deliveredAtClose: 0 } }), 36);
    eq('the older route keeps its old reading: a frozen 0 on a normal close still falls back to the live figure (no old closed line changes)',
       b.shortCloseGap({ ordered: 36, delivered: 10, shortClose: { approvedAt: 't', orderedAtClose: 36, deliveredAtClose: 0 } }), 26);
    eq('an old record with no frozen figures still falls back to the live ones',
       b.shortCloseGap({ ordered: 36, delivered: 10, shortClose: { approvedAt: 't' } }), 26); }

  /* tinyFresh */
  { let b = world({ line: tinyLine });
    ok('no fetch at all means "could not check"', (await b.tinyFresh()) === false);
    const calls = []; b = world({ line: tinyLine, fetch: async u => { calls.push(u); return jr({ rev: 5 }); } });
    ok('same revision means fresh', (await b.tinyFresh()) === true);
    ok('and only the revision was asked for', calls.length === 1 && calls[0] === '/api/rev');
    b = world({ line: tinyLine, fetch: async () => ({ ok: false }) });
    ok('a failed check means "could not check"', (await b.tinyFresh()) === false);
    b = world({ line: tinyLine, fetch: async () => { throw new Error('offline'); } });
    ok('offline means "could not check", not a crash', (await b.tinyFresh()) === false);
    b = world({ line: tinyLine, fetch: async () => jr({ rev: 5 }) }); vm.runInContext('_savePending=true', b);
    ok('a save still going through means "could not check"', (await b.tinyFresh()) === false);
    b = world({ line: tinyLine, fetch: async u => u === '/api/rev' ? jr({ rev: 9 }) : jr({ rev: 9, data: { orders: [{ id: 'O1', po: '22868', client: 'Maxim', lines: [{ id: 'L1', brand: 'Max Potash', ordered: 1000, delivered: 1000, packed: 1000 }] }] } }) });
    Object.assign(b, { dataOnly: s => JSON.parse(JSON.stringify(s)), _srvCopy: d => JSON.parse(JSON.stringify(d)), ensureState: x => x, merge3: (base, mine, theirs) => theirs });
    b.state.expanded = { a: 1 };
    ok('a newer revision is pulled and merged', (await b.tinyFresh()) === true);
    eq('the new figures are in the state', b.state.orders[0].lines[0].delivered, 1000);
    eq('the signed-in person survives the merge', b.state.currentUser.username, 'saad');
    eq('and the role', b.state.role, 'Supply Chain');
    eq('and the open lists', JSON.stringify(b.state.expanded), '{"a":1}');
    eq('and the revision moves on', vm.runInContext('_rev', b), 9);
    b = world({ line: tinyLine, fetch: async u => u === '/api/rev' ? jr({ rev: 9 }) : ({ ok: false }) });
    ok('a newer revision whose state cannot be read means "could not check"', (await b.tinyFresh()) === false);
  }

  /* tinyConfirm */
  { const b = confirmWorld(async () => true); setForm(b, 'customer_reduced', 'took less');
    await b.tinyConfirm();
    ok('fresh and unchanged: it closes', b.lineShortClosed(b.l) === true && b.saves === 1 && b.logged.length === 1 && b.state.audit.length === 1);
    eq('with the figures that were on the screen', b.l.shortClose.leftAtClose, 10); }
  { const b = confirmWorld(async () => true); await b.tinyConfirm();
    ok('no reason: nothing happens and it says so', !b.lineShortClosed(b.l) && /Pick a reason/.test(last(b)) && formOf(b).busy === false); }
  { const b = confirmWorld(async () => true); setForm(b, 'other', '  '); await b.tinyConfirm();
    ok('"Other" with no words: nothing happens', !b.lineShortClosed(b.l) && /Say why/.test(last(b))); }
  { const b = confirmWorld(async () => false); setForm(b, 'customer_reduced', '');
    await b.tinyConfirm();
    ok('it could not check: nothing is closed', !b.lineShortClosed(b.l) && b.saves === 0 && b.logged.length === 0 && b.state.audit.length === 0);
    ok('the window stays open and says nothing was closed', formOf(b) && formOf(b).busy === false && /Nothing was closed/.test(b.shown[b.shown.length - 1]));
    ok('and the button is usable again', !/disabled/.test(b.shown[b.shown.length - 1])); }
  { const b = confirmWorld(async () => { vm.runInContext('_savePending=true', b); return false; }); setForm(b, 'customer_reduced', '');
    await b.tinyConfirm();
    ok('a save still going through is named', /save is still going through/.test(b.shown[b.shown.length - 1]) && !b.lineShortClosed(b.l)); }
  { const b = confirmWorld(async () => { b.l.delivered = 970; b.l.packed = 970; return true; }); setForm(b, 'customer_reduced', '');
    await b.tinyConfirm();
    ok('the figures moved while the window was open: nothing is closed', !b.lineShortClosed(b.l) && b.saves === 0);
    ok('it shows the new figure and asks again', /30 Kg\/L is left now/.test(b.shown[b.shown.length - 1]) && /Nothing was closed/.test(b.shown[b.shown.length - 1]));
    b.tinyFresh = async () => true; await b.tinyConfirm();
    ok('and the second tap closes it with the new figure', b.lineShortClosed(b.l) && b.l.shortClose.leftAtClose === 30 && b.saves === 1); }
  { const b = confirmWorld(async () => { b.l.shortClose = { requestedBy: 'Z', requestedAt: 't' }; return true; }); setForm(b, 'customer_reduced', '');
    await b.tinyConfirm();
    ok('someone asked for a close meanwhile: nothing is closed, the window goes, the person is told',
       b.l.shortClose.approvedAt === undefined && b.saves === 0 && formOf(b) === null && b.closed === 1 && /Not closed\./.test(last(b)) && /waiting for a decision/.test(last(b))); }
  { const b = confirmWorld(async () => { b.l.rmPR = { qty: 1, closed: false }; return true; }); setForm(b, 'customer_reduced', '');
    await b.tinyConfirm();
    ok('a raw material request raised meanwhile stops it', !b.lineShortClosed(b.l) && /raw material purchase request/.test(last(b))); }
  { const b = confirmWorld(async () => true); setForm(b, 'customer_reduced', '');
    const p1 = b.tinyConfirm(); const shownNow = b.shown[b.shown.length - 1]; const p2 = b.tinyConfirm();
    await p1; await p2;
    ok('while it checks, the button says so and is disabled', /disabled/.test(shownNow) && /Checking the latest figures/.test(shownNow));
    ok('a second tap while it checks does nothing: one close, one save, one log, one audit row',
       b.lineShortClosed(b.l) && b.saves === 1 && b.logged.length === 1 && b.state.audit.length === 1); }
  { const b = confirmWorld(async () => { vm.runInContext('tcForm=null', b); return true; }); setForm(b, 'customer_reduced', '');
    await b.tinyConfirm();
    ok('cancelled while it was checking: nothing is closed', !b.lineShortClosed(b.l) && b.saves === 0); }
  { const b = world({ line: tinyLine });
    b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x', 25);
    ok('the close itself refuses when the figure it was shown is not the figure on the line',
       !b.lineShortClosed(b.l) && b.saves === 0 && b.logged.length === 0 && /10 Kg\/L is left now/.test(last(b)));
    b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x', 10);
    ok('and closes when it matches', b.lineShortClosed(b.l) === true); }

  /* Cancel while it checks: nothing is closed, nothing is drawn over the next window */
  { const { b, release } = heldWorld(); setForm(b, 'customer_reduced', ''); winStub(b, true, true);
    const p = b.tinyConfirm(); winStub(b, false, false); const drawnBefore = b.shown.length; release(); await p;
    ok('Cancel pressed while it was checking: the line is NOT closed', !b.lineShortClosed(b.l) && b.saves === 0 && b.logged.length === 0 && b.state.audit.length === 0);
    ok('and no toast says it closed', !b.toasts.some(t => /closed short/.test(t)));
    ok('and the form is put away, nothing is drawn over a window that is not there', formOf(b) === null && b.shown.length === drawnBefore); }
  { const { b, release } = heldWorld(); setForm(b, 'customer_reduced', ''); winStub(b, true, true);
    const p = b.tinyConfirm(); winStub(b, true, false); release(); await p;
    ok('another window opened over it while it checked: the line is NOT closed', !b.lineShortClosed(b.l) && b.saves === 0 && formOf(b) === null); }
  { const { b, release } = heldWorld(); setForm(b, 'customer_reduced', ''); winStub(b, true, true);
    const p = b.tinyConfirm(); release(); await p;
    ok('the window still open: it closes as before', b.lineShortClosed(b.l) === true && b.saves === 1); }
  { const { b, release } = heldWorld(); setForm(b, 'customer_reduced', ''); winStub(b, true, true);
    const p = b.tinyConfirm(); vm.runInContext('tcForm=null', b); release(); await p;
    ok('the form cleared (Cancel) while it checked: nothing is closed', !b.lineShortClosed(b.l) && b.saves === 0); }

  /* a slow or hanging check is given up after 15 seconds and nothing is closed */
  { const b = world({ line: tinyLine }); let timer = null, cleared = 0;
    b.AbortController = AbortController; b.setTimeout = (f, ms) => { timer = { f, ms }; return 7; }; b.clearTimeout = () => { cleared++; };
    let sawSignal = false, aborted = false;
    b.fetch = (u, o) => new Promise((res, rej) => { sawSignal = !!(o && o.signal); if (!sawSignal) { rej(new Error('no signal')); return; } o.signal.addEventListener('abort', () => { aborted = true; rej(new Error('aborted')); }); });
    const p = b.tinyFresh(); timer.f(); const got = await p;
    ok('a check that hangs is given up after 15 seconds and reports "could not check"', got === false && timer.ms === 15000);
    ok('and it is the abort signal that ends it (the fetch was given the signal and it fired)', sawSignal === true && aborted === true);
    ok('and the timer is cleared', cleared === 1); }
  { const b = world({ line: tinyLine }); let cleared = 0;
    b.AbortController = AbortController; b.setTimeout = () => 7; b.clearTimeout = () => { cleared++; };
    b.fetch = async () => jr({ rev: 5 });
    ok('a check that answers in time returns true and clears the timer', (await b.tinyFresh()) === true && cleared === 1); }

  /* review round 2 */
  { /* walked away: the figures the check brought in are drawn, unless another window is open */
    const { b, release } = heldWorld(); setForm(b, 'customer_reduced', ''); winStub(b, false, false);
    const p = b.tinyConfirm(); release(); await p;
    ok('walked away (window gone): nothing closed and the page behind is drawn once with the new figures', !b.lineShortClosed(b.l) && b.saves === 0 && b.renders === 1); }
  { const { b, release } = heldWorld(); setForm(b, 'customer_reduced', ''); winStub(b, true, false);
    const p = b.tinyConfirm(); release(); await p;
    ok('another window open on top: nothing closed and the page behind is NOT redrawn over it', !b.lineShortClosed(b.l) && b.renders === 0); }
  { /* the button must not stay on "Checking" when the close refuses afterwards */
    const b = confirmWorld(async () => { setForm(b, 'other', ''); return true; }); setForm(b, 'other', 'because');
    await b.tinyConfirm();
    const shown = b.shown[b.shown.length - 1];
    ok('the close refused after the check (Other, words removed meanwhile): nothing closed and the button is back to normal', !b.lineShortClosed(b.l) && !/disabled/.test(shown) && !/Checking the latest figures/.test(shown) && formOf(b).busy === false); }
  { /* signed out */
    let b = world({ line: tinyLine, fetch: async () => ({ ok: false, status: 401 }) });
    b.openTinyClose('O1', 'L1'); setForm(b, 'customer_reduced', '');
    await b.tinyConfirm();
    ok('signed out (401): the window says so, not "check the connection", and nothing is closed', !b.lineShortClosed(b.l) && /signed out/i.test(formOf(b).note) && !/connection/.test(formOf(b).note));
    b = world({ line: tinyLine, fetch: async () => { throw new Error('offline'); } });
    b.openTinyClose('O1', 'L1'); setForm(b, 'customer_reduced', ''); await b.tinyConfirm();
    ok('offline still says check the connection', /connection/.test(formOf(b).note)); }
  { /* a save of ours landed meanwhile: what comes down is older, so it is not merged in and the revision does not go back */
    const b = world({ line: tinyLine, fetch: async u => u === '/api/rev' ? jr({ rev: 3 }) : jr({ rev: 3, data: { orders: [{ id: 'O1', po: '22868', client: 'Maxim', lines: [{ id: 'L1', brand: 'Max Potash', ordered: 1000, delivered: 500, packed: 500 }] }] } }) });
    vm.runInContext('_rev=5', b);
    ok('an older state from the server is a pass, not a rewind', (await b.tinyFresh()) === true && vm.runInContext('_rev', b) === 5 && b.l.delivered === 990); }
  /* the words */
  { const x = world({ line: { ordered: 36, delivered: 0, packed: 0 } }); x.openTinyClose('O1', 'L1');
    ok('nothing delivered is said in the window', /Nothing has been delivered on this line\./.test(x.shown[x.shown.length - 1]));
    const y = world(); y.openTinyClose('O1', 'L1');
    ok('and not said when something was delivered', !/Nothing has been delivered/.test(y.shown[y.shown.length - 1]));
    vm.runInContext("tcForm.reasonCode='customer_reduced'; renderTinyClose();", y);
    ok('a customer reason reads "not listed as ours"', /not listed as ours in the Closed short report/.test(y.shown[y.shown.length - 1]));
    vm.runInContext("tcForm.reasonCode='our_shortfall'; renderTinyClose();", y);
    ok('an our-side reason reads "listed as ours"', /is listed as ours in the Closed short report/.test(y.shown[y.shown.length - 1]) && !/not listed as ours/.test(y.shown[y.shown.length - 1])); }
  { const refused = { requestedBy: 'X', requestedAt: 't1', reasonCode: 'commercial', refusedAt: 't2', refusedBy: 'Y', refusedWhy: 'wait' };
    const w = world({ rights: ['po.shortclose_small'], role: 'Warehouse', line: { ordered: 1000, delivered: 960, packed: 960, shortClose: refused } });
    ok('Finance and Warehouse (no Ask button) are told to tell Supply Chain, not to "send a request"', /Tell Supply Chain; they can ask the Plant Manager\./.test(w.closeLineButtonHTML(w.o, w.l)) && !/A new request goes to the Plant Manager/.test(w.closeLineButtonHTML(w.o, w.l)));
    const sc = world({ rights: ['po.shortclose_small', 'po.shortclose_request'], role: 'Supply Chain', line: { ordered: 1000, delivered: 960, packed: 960, shortClose: refused } });
    ok('Supply Chain (has Ask) still reads the original sentence', /A new request goes to the Plant Manager\./.test(sc.closeLineButtonHTML(sc.o, sc.l)));
    const wait = world({ rights: ['po.shortclose_small', 'po.shortclose_request'], role: 'Supply Chain', line: { ordered: 1000, delivered: 960, packed: 960, shortClose: { requestedBy: 'X', requestedAt: 't' } } });
    ok('Supply Chain with a request waiting: no "waiting" line above a live Ask button', !/Small remainder:/.test(wait.closeLineButtonHTML(wait.o, wait.l))); }
  ok('the Guide says who can open the Closed short report', /Supply Chain, Finance, Warehouse, Plant Manager, Production Manager, KAM, CFO and COO can open the Closed short report and see it there\./.test(html));
  ok('the raw material refusal says what to do, in plain words', /Close or receive that request first/.test(html) && !/Settle it first/.test(html));
  ok('the reason line is its own row (full width, left aligned) so it does not float under History', /flex:1 1 100%;width:100%;text-align:left;font-size:11\.5px/.test(html));

  /* ================= 7. THE PO MUST BE 7 DAYS OLD (Tahir, 29 Oct) ================= */
  { const pk = n => new Date(Date.now() + 5 * 3600000 - n * 864e5).toISOString().slice(0, 10);   /* the date n days ago, Pakistan time */
    const at = r => world({ received: r });
    ok('received today (day 0): refused, and it says today', (() => { const b = at(pk(0)); const w = b.tinyRefusal(b.o, b.l); return /received today/.test(w) && /7 days old/.test(w) && b.tinyMay(b.o, b.l) === false; })());
    ok('received 1 day ago: refused, "1 day ago"', /received 1 day ago/.test((() => { const b = at(pk(1)); return b.tinyRefusal(b.o, b.l); })()));
    ok('received 6 days ago: refused, "6 days ago"', /received 6 days ago/.test((() => { const b = at(pk(6)); return b.tinyRefusal(b.o, b.l); })()));
    ok('received 7 days ago: allowed (the day it came in is day 0)', (() => { const b = at(pk(7)); return b.tinyRefusal(b.o, b.l) === '' && b.tinyMay(b.o, b.l) === true; })());
    ok('received 30 days ago: allowed', (() => { const b = at(pk(30)); return b.tinyRefusal(b.o, b.l) === ''; })());
    ok('a PO with no received date is not held back (its age cannot be told)', (() => { const b = at(null); return b.tinyRefusal(b.o, b.l) === ''; })());
    ok('an unreadable received date is not held back', (() => { const b = at('last week'); return b.tinyRefusal(b.o, b.l) === ''; })());
    ok('a received date with a time on it is read by its date', (() => { const b = at(pk(2) + 'T10:00:00Z'); return /received 2 days ago/.test(b.tinyRefusal(b.o, b.l)); })());
    ok('a date in the future is refused and says the date is in the future, not "received today"', (() => { const b = at(pk(-3)); const w = b.tinyRefusal(b.o, b.l); return /in the future/.test(w) && !/received today/.test(w) && w.indexOf(pk(-3)) > -1; })());
    ok('a young PO says the day the button opens, written out, not only "7 days"', (() => { const b = at(pk(2)); const d = new Date(Date.parse(pk(2) + 'T00:00:00Z') + 7 * 864e5); const want = d.getUTCDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()] + ' ' + d.getUTCFullYear(); return b.tinyRefusal(b.o, b.l).indexOf('from ' + want + ', when the PO is 7 days old') > -1; })());
    ok('tinyOpensOn is empty when there is no readable date', (() => { const b = at(null); return b.tinyOpensOn(b.o) === '' && at('x').tinyOpensOn(at('x').o) === ''; })());
    ok('more than 50 left on a young PO still gets the Plant Manager message, not the age one', (() => { const b = world({ received: pk(1), line: { ordered: 1000, delivered: 900, packed: 900 } }); return /Plant Manager’s approval/.test(b.tinyRefusal(b.o, b.l)); })());
    ok('a young PO: the close itself refuses and writes nothing', (() => { const b = at(pk(2)); const before = JSON.stringify(b.l); b.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'); return JSON.stringify(b.l) === before && b.saves === 0 && /received 2 days ago/.test(last(b)); })());
    ok('a young PO: no button, but the reason where the button would be (Warehouse)', (() => { const b = world({ received: pk(2), role: 'Warehouse' }); const h = b.closeLineButtonHTML(b.o, b.l); return !/<button/.test(h) && /Small remainder:/.test(h) && /7 days old/.test(h); })());
  }
  ok('the limit of 7 is in the program once and is not a setting', (html.match(/var SHORTCLOSE_TINY_MIN_DAYS=7;/g) || []).length === 1);

  /* ================= 8. FINANCE AND WAREHOUSE CAN OPEN THE CLOSED SHORT REPORT ================= */
  ok('the Closed short report is open to Finance and Warehouse as well as the six it had', (() => { const m = html.match(/\{id:'shortclose', t:'Closed short'[^\n]*roles:\[([^\]]*)\]/); if (!m) return false; const r = m[1]; return ['Plant Manager', 'Production Manager', 'Supply Chain', 'Finance', 'Warehouse', 'COO', 'CFO', 'KAM'].every(x => r.indexOf("'" + x + "'") > -1); })());

  /* ================= 9. THE COO'S REOPEN BUTTON ================= */
  { const closedLine = (extra) => Object.assign({ ordered: 1000, delivered: 960, packed: 960, shortClose: { requestedBy: 'Fahim PM', requestedAt: '2026-10-01T05:00:00Z', approvedBy: 'Tahir Abbas', approvedAt: '2026-10-02T05:00:00Z', reasonCode: 'customer_reduced', reason: 'took less', orderedAtClose: 1000, deliveredAtClose: 960, packedAtClose: 960 } }, extra || {});
    const coo = (extra) => world({ role: 'COO', rights: ['po.reopen'], user: 'Tahir Abbas', username: 'tahir', line: closedLine(extra) });
    let b = coo();
    ok('the COO sees Reopen this line on a closed-short line', /Reopen this line/.test(b.reopenLineButtonHTML(b.o, b.l)) && /openReopenClose\('O1','L1'\)/.test(b.reopenLineButtonHTML(b.o, b.l)));
    ok('and it is drawn on the order sheet beside the other buttons', /closeLineButtonHTML\(o,l\)\+\(typeof reopenLineButtonHTML==='function'\?reopenLineButtonHTML\(o,l\):''\)\+moveStockButtonHTML\(o,l\)/.test(html));
    const open = world({ role: 'COO', rights: ['po.reopen'] });
    ok('an open line has no Reopen button', open.reopenLineButtonHTML(open.o, open.l) === '');
    const sc = world({ role: 'Supply Chain', rights: ['po.shortclose_small'], line: closedLine() });
    ok('Supply Chain, Finance, Warehouse (no po.reopen) never see it', sc.reopenLineButtonHTML(sc.o, sc.l) === '');
    const re = coo({ shortClose: Object.assign({}, closedLine().shortClose, { reopenedAt: 't', reopenedBy: 'T' }) });
    ok('an already reopened line has no Reopen button', re.reopenLineButtonHTML(re.o, re.l) === '');
    sc.openReopenClose('O1', 'L1'); ok('without the right, the window does not open', sc.shown.length === 0 && /denied/.test(last(sc)));
    open.openReopenClose('O1', 'L1'); ok('on an open line, the window does not open', open.shown.length === 0 && /not closed short/.test(last(open)));

    b = coo(); b.openReopenClose('O1', 'L1');
    let w = b.shown[b.shown.length - 1];
    ok('the window says who closed it, when, why and the shortfall, and what reopening does', /Tahir Abbas/.test(w) && /2026-10-02/.test(w) && /took less/.test(w) && /<b>40 Kg\/L<\/b>/.test(w) && /The close stays in the history/.test(w) && /cannot use the quick small remainder close on this line again/.test(w) && /close it yourself/.test(w) && !/whole PO was closed/.test(w));
    b.tinyFresh = async () => true; vm.runInContext('rcForm.why=""', b);
    await b.reopenConfirm();
    ok('no reason: asked for one, nothing reopened', b.lineShortClosed(b.l) && b.saves === 0 && /Say why/.test(last(b)));
    vm.runInContext('rcForm.why="  closed by mistake  "', b);
    await b.reopenConfirm();
    ok('with a reason: reopened, the close kept as history with who, when and why', !b.lineShortClosed(b.l) && !!b.l.shortClose.reopenedAt && b.l.shortClose.reopenedBy === 'Tahir Abbas' && b.l.shortClose.reopenedWhy === 'closed by mistake' && b.l.shortClose.approvedBy === 'Tahir Abbas');
    ok('saved once, drawn, logged with the reason, audited with the reason', b.saves === 1 && b.logged.length === 1 && /REOPENED/.test(b.logged[0]) && /closed by mistake/.test(b.logged[0]) && b.state.audit.length === 1 && b.state.audit[0].val === 'closed by mistake' && /is open again/.test(last(b)));
    ok('the form is put away and the window closed', vm.runInContext('rcForm', b) === null && b.closed >= 1);
    ok('after a reopen the quick close refuses it and says so', /already refused or reopened/.test(b.tinyRefusal(b.o, b.l)));
    ok('and the shortfall of a reopened close reads 0 again', b.shortCloseGap(b.l) === 0);

    /* walking away while it checks */
    { let release; const gate = new Promise(r => { release = r; });
      const x = coo(); x.tinyFresh = async () => { await gate; return true; }; x.openReopenClose('O1', 'L1'); vm.runInContext('rcForm.why="because"', x); winStub(x, true, true);
      const p = x.reopenConfirm(); winStub(x, false, false); release(); await p;
      ok('Cancel while it checks: nothing is reopened, nothing saved', x.lineShortClosed(x.l) && x.saves === 0 && vm.runInContext('rcForm', x) === null && x.renders === 1); }
    { let release; const gate = new Promise(r => { release = r; });
      const x = coo(); x.tinyFresh = async () => { await gate; return true; }; x.openReopenClose('O1', 'L1'); vm.runInContext('rcForm.why="because"', x); winStub(x, true, true);
      const p = x.reopenConfirm(); const dur = x.shown[x.shown.length - 1]; const p2 = x.reopenConfirm(); release(); await p; await p2;
      ok('while it checks the button says so and is disabled; a second tap does nothing; one reopen, one save', /disabled/.test(dur) && /Checking the latest figures/.test(dur) && !x.lineShortClosed(x.l) && x.saves === 1 && x.logged.length === 1); }
    /* the line changed meanwhile */
    { const x = coo(); x.tinyFresh = async () => { x.l.shortClose.reopenedAt = 'elsewhere'; return true; }; x.openReopenClose('O1', 'L1'); vm.runInContext('rcForm.why="because"', x); winStub(x, true, true);
      await x.reopenConfirm();
      ok('someone reopened it meanwhile: not reopened a second time, and the COO is told', x.saves === 0 && x.logged.length === 0 && /Not reopened/.test(last(x))); }
    /* cannot check */
    { const x = coo(); x.tinyFresh = async () => false; x.tinyFresh.why = 'signedout'; x.openReopenClose('O1', 'L1'); vm.runInContext('rcForm.why="because"', x); winStub(x, true, true);
      await x.reopenConfirm();
      ok('cannot check (signed out): nothing reopened, a plain note, the button back', x.lineShortClosed(x.l) && x.saves === 0 && /signed out/i.test(vm.runInContext('rcForm.note', x)) && vm.runInContext('rcForm.busy', x) === false); }
    /* round 3 fixes */
    ok('a one-character reason is not enough', await (async () => { const x = coo(); x.tinyFresh = async () => true; x.openReopenClose('O1', 'L1'); vm.runInContext('rcForm.why="."', x); await x.reopenConfirm(); return x.lineShortClosed(x.l) && x.saves === 0 && /few words/.test(last(x)); })());
    ok('when the whole PO was closed too, the window says the PO opens again', (() => { const x = coo(); x.o.closed = { by: 'T', at: 't' }; x.openReopenClose('O1', 'L1'); return /whole PO was closed as well/.test(x.shown[x.shown.length - 1]); })());
    ok('the audit row of the reopen has an id (a row without one is dropped when saves merge)', (() => { const x = coo(); x.reopenShortClose('O1', 'L1', 'because'); const a = x.state.audit[0]; return typeof a.id === 'string' && a.id.length > 2; })());
    ok('the audit row of a tiny close has an id', (() => { const x = world({}); x.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'); const a = x.state.audit[0]; return x.saves === 1 && typeof a.id === 'string' && a.id.length > 2; })());
    ok('two audit rows get two different ids', (() => { const x = world({}); x.tinyShortClose('O1', 'L1', 'customer_reduced', 'x'); const y = x.nid('AU'); return x.state.audit[0].id !== y; })());
    ok('the audit row survives a JSON round trip with its id and its reason', (() => { const x = coo(); x.reopenShortClose('O1', 'L1', 'because'); const a = JSON.parse(JSON.stringify(x.state)).audit[0]; return a.val === 'because' && !!a.id && a.field === 'Short close reopened'; })());
    /* the Pack job comes back with the line */
    { const pl = () => coo({ ordered: 1000, delivered: 960, packed: 960 });
      const x = pl(); x.l.packed = 960;
      ok('closed short: no Pack job for the line', x.packLineOwes('22868', 'L1', 'Max Potash') === null);
      x.reopenShortClose('O1', 'L1', 'work left');
      ok('after a reopen the line owes its packing again (40 Kg unpacked)', !!x.packLineOwes('22868', 'L1', 'Max Potash'));
      const y = world({ line: { ordered: 1000, delivered: 960, packed: 960 } });
      ok('a line that was never closed owes the same, so the reopened line is treated like any open line', !!y.packLineOwes('22868', 'L1', 'Max Potash') === !!x.packLineOwes('22868', 'L1', 'Max Potash'));
      const z = world({ line: { ordered: 1000, delivered: 960, packed: 1000 } });
      ok('a fully packed line owes nothing, reopened or not', z.packLineOwes('22868', 'L1', 'Max Potash') === null); }
    /* round 3: the person who meets the refusal is told who reopened it, when and why */
    { const x = coo(); x.reopenShortClose('O1', 'L1', 'work left to do');
      const w = x.tinyRefusal(x.o, x.l);
      ok('after a reopen the refusal says who reopened it, when and why', /already refused or reopened/.test(w) && /reopened by Tahir Abbas on \d{4}-\d{2}-\d{2}: work left to do\./.test(w) && /Plant Manager/.test(w));
      ok('scReopenNote is empty for a line never reopened', world({}).scReopenNote(world({}).l) === '');
      const y = coo(); y.reopenShortClose('O1', 'L1', 'first'); y.l.shortCloseHistory = [Object.assign({}, y.l.shortClose, { reopenedAt: '2026-10-01T00:00:00Z', reopenedWhy: 'older' })]; y.l.shortClose = { reopenedAt: '2026-10-05T00:00:00Z', reopenedBy: 'T', reopenedWhy: 'newer', approvedAt: 'a' };
      ok('with two reopens the latest one is the one named', /newer/.test(y.scReopenNote(y.l)) && !/older/.test(y.scReopenNote(y.l)));
      const fin = world({ role: 'Finance', rights: ['po.shortclose_small'] }); fin.l.shortClose = { approvedAt: 'a', reopenedAt: '2026-10-05T00:00:00Z', reopenedBy: 'Tahir Abbas', reopenedWhy: 'm' };
      const fw = fin.tinyWhyNot(fin.o, fin.l);
      ok('Finance, who cannot ask, is told to tell Supply Chain and still sees who reopened it', /reopened by Tahir Abbas/.test(fw) && /Tell Supply Chain/.test(fw));
      ok('both the Ask window and the Plant Manager approval window carry the note', (html.match(/scReopenNote\(l\)\?\('<div class="note"/g) || []).length === 2);
      const rm = world({}); rm.l.rmPR = { qty: 40, closed: false };
      ok('the raw material refusal names who can settle the request', /Ask Supply Chain or the CFO to settle that request first/.test(rm.tinyRefusal(rm.o, rm.l))); }
    /* the old route is unchanged: no reason given still works (existing tests call it with two arguments) */
    { const x = coo(); x.reopenShortClose('O1', 'L1'); ok('reopenShortClose with two arguments still works (older callers and tests)', !x.lineShortClosed(x.l) && x.l.shortClose.reopenedWhy === undefined && x.saves === 1); }
    /* a whole-PO close is undone too */
    { const x = coo(); x.o.closed = { by: 'T', at: 't' }; x.reopenShortClose('O1', 'L1', 'mistake'); ok('a COO whole-PO close is kept as history and the PO opens too', x.o.closed === null && x.o.closedHistory.length === 1 && x.o.closedHistory[0].reopenedBy === 'Tahir Abbas' && x.o.closedHistory[0].by === 'T'); } }

  process.exitCode = report('The tiny remainder close (29c)') ? 1 : 0;
})();
