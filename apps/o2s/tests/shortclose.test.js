/* Short-closing a PO line — 23 September 2026.
 *
 * Tahir's definition: "PO can only close half means no further packing is
 * required... a packed product will leave... it's from unpacked or unproduced
 * product."
 *
 * So a short-close is a STOP instruction, not a reversal. It stops new forward
 * work against the line. It does not touch anything already packed, which still
 * ships, and it never rewrites l.ordered — the shortfall has to stay visible or
 * a 30,000 Kg order that shipped 18,000 would read as 18,000 fully delivered.
 *
 * The guard is ONE function, shortCloseRefusal(), and these checks assert that
 * every writer of new work calls it. Four separate faults in this codebase have
 * been "the same rule applied in two places and not a third" — fault 4, fault 8,
 * the release gate, and the Gate Pass earlier today. One function, tested for
 * reach, is the answer to that shape.
 */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const src = ['lineShortClosed','lineShortRequested','scReason','shortCloseGap',
             'shortCloseAgainstUs','shortCloseRefusal','lineStage','lineOverdue']
  .map(n => { try { return grab(n); } catch (e) { return ''; } }).join('\n\n');

const box = { console, TODAY: new Date('2026-09-23'), fmt: n => String(n) };
box.globalThis = box;
vm.createContext(box);
vm.runInContext(H.grabTopVar('SHORTCLOSE_REASONS', '[') + '\n' + src, box);

const closed = (code='customer_cancelled') => ({
  brand:'Max Boron', ordered:30000, delivered:18000, packed:18000, committed:'2026-09-01',
  shortClose:{ requestedBy:'Zain Ghaffar', requestedAt:'2026-09-23T09:00:00Z',
               reasonCode:code, reason:'customer took less',
               approvedBy:'Muhammad Faheem Asghar', approvedAt:'2026-09-23T10:00:00Z',
               orderedAtClose:30000, deliveredAtClose:18000, packedAtClose:18000 } });
const requested = () => { const l=closed(); delete l.shortClose.approvedBy; delete l.shortClose.approvedAt; return l; };
const openLine  = () => ({ brand:'Max Boron', ordered:30000, delivered:18000, packed:18000, committed:'2026-09-01' });

/* ---- the state helpers ---- */
ok('an approved close reads as closed',        box.lineShortClosed(closed()) === true);
ok('a requested close does NOT read as closed', box.lineShortClosed(requested()) === false);
ok('a requested close reads as requested',      box.lineShortRequested(requested()) === true);
ok('an approved close is no longer "requested"',box.lineShortRequested(closed()) === false);
ok('an ordinary line is neither',
   box.lineShortClosed(openLine()) === false && box.lineShortRequested(openLine()) === false);

const reopened = closed(); reopened.shortClose.reopenedAt = '2026-09-24T08:00:00Z';
ok('a reopened line is open again', box.lineShortClosed(reopened) === false);

/* ---- the shortfall is carried, never netted away ---- */
eq('the gap is ordered minus delivered, frozen at the close', box.shortCloseGap(closed()), 12000);
eq('an open line has no gap', box.shortCloseGap(openLine()), 0);
ok('l.ordered is never rewritten by any of this',
   !/shortClose[\s\S]{0,400}?l\.ordered\s*=/.test(html));

/* ---- the reason decides who the shortfall belongs to ---- */
ok('a customer cancellation is not ours',   box.shortCloseAgainstUs(closed('customer_cancelled')) === false);
ok('a customer reduction is not ours',      box.shortCloseAgainstUs(closed('customer_reduced'))   === false);
ok('our own shortfall is ours',             box.shortCloseAgainstUs(closed('our_shortfall'))      === true);
ok('missing raw material is ours',          box.shortCloseAgainstUs(closed('material_unavailable'))=== true);
ok('an unknown reason counts against us',   box.shortCloseAgainstUs(closed('nonsense'))           === true);
/* closed(undefined) would fire the default parameter and silently test
   'customer_cancelled' instead — so the no-reason case is built by hand. */
const noReason = closed(); delete noReason.shortClose.reasonCode;
ok('a line with no reason counts against us', box.shortCloseAgainstUs(noReason)                === true);

/* ---- the refusal message ---- */
const msg = box.shortCloseRefusal({po:'PO-2609-018'}, closed(), 'Packing');
ok('it names the PO',            /PO-2609-018/.test(msg));
ok('it names who approved it',   /Faheem/.test(msg));
ok('it names the reason',        /cancel/i.test(msg));
ok('it says packed stock can still ship', /still ship/i.test(msg));
eq('an open line is not refused', box.shortCloseRefusal({po:'X'}, openLine(), 'Packing'), '');
eq('a requested-but-unapproved close is not refused yet',
   box.shortCloseRefusal({po:'X'}, requested(), 'Packing'), '');

/* ---- REACH: every writer of new forward work asks the guard ---- */
['submitProdQty','doPack','submitDivert','allocateStock','openRMCheck'].forEach(fn => {
  ok(fn + '() asks shortCloseRefusal()', /shortCloseRefusal\(/.test(grab(fn)));
});

/* ---- REACH, the other way: what must NOT be blocked ----
   A shift log records output that physically happened. Data Fix exists to
   correct history. Blocking either would teach people not to record reality,
   which is the behaviour this whole system is trying to end. */
['submitShiftLog','dfSubmitProduction','dfSubmitPacking'].forEach(fn => {
  ok(fn + '() is NOT blocked by a short close', !/shortCloseRefusal\(/.test(grab(fn)));
});

/* Packed stock still leaves — nothing downstream asks the guard. */
['issueGatePass','approveRelease','markDelivered'].forEach(fn => {
  ok(fn + '() still lets packed stock go', !/shortCloseRefusal\(/.test(grab(fn)));
});

/* ---- the tracker tells the truth about it ---- */
eq('a closed line reads "Closed short"', box.lineStage({}, closed()), 'Closed short');
ok("'Closed short' is a real stage", /STAGE_ORDER=\[[^\]]*'Closed short'/.test(html));
ok('a requested-but-unapproved close does NOT read as closed',
   box.lineStage({}, requested()) !== 'Closed short');
eq('...it reads exactly as the same line would without any close at all',
   box.lineStage({}, requested()), box.lineStage({}, openLine()));

/* ---- and we stop chasing it ---- */
ok('a closed line is not overdue', box.lineOverdue({received:'2026-08-01'}, closed()) === false);
ok('an open line past its date still is',
   box.lineOverdue({received:'2026-08-01'}, openLine()) === true);
ok('a reopened line is chased again',
   box.lineOverdue({received:'2026-08-01'}, reopened) === true);

report();
