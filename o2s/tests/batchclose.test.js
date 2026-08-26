/* Closing and reopening a production batch.
   Tahir, 22 Aug 2026: show me all of them with quantities and let me untick;
   and give the Plant Manager a way to undo a close, with a reason.

   The old confirm box listed 8 of 26 and closed all of them, and closing was
   one way through the whole app. */
const vm = require('vm');
const H = require('./harness.js');
const html = H.html;
const STATE = require(H.STATE).data;

let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));

const SRC = [
  H.grabObj('CORRECT_REASONS'), H.grabObj('CORRECT_ENTITY'),
  H.grab('settledBatches'), H.grab('batchRemainderKg'),
  H.grab('openSettledClose'), H.grab('settledPick'), H.grab('settledPickAll'),
  H.grab('renderSettledClose'), H.grab('closeSettledBatches'),
  H.grab('batchReopenBlocked'), H.grab('batchReopenHeadroom'), H.grab('batchYieldMismatch'),
  H.grab('closedBatches'), H.grab('closedBatchesCard'),
  H.grab('openReopenBatch'), H.grab('renderReopenBatch'),
  H.grab('doReopenBatch'), H.grab('recordCorrection'), H.grab('correctTypeLabel'),
  H.grab('correctReasonText'), H.grab('nid'), H.grab('hardRole'), H.grab('coaItemOf'),
  H.grab('logAction'), H.grab('accessLevelOn'), H.grab('accessLevel'), H.grab('scr'),
  /* the closed-batches row carries a Correct button since 25 Aug */
  H.grab('_pcCorrectBtn'), H.grab('correctAllowed'), H.grab('correctFieldOK'),
  H.grab('correctAnyField'), H.grab('correctCanAmend'), H.grabObj('CORRECT_ENTITY'),
].join('\n')
  /* The bulk-close gates ask may('batch.close_bulk') since 25 Aug. The whole
     rights model comes in so the gate is the REAL one — stubbing may() to true
     would make every refusal check below prove nothing. */
  + '\n' + H.authModelSrc()
  + '\n' + (function(){ const i = H.html.indexOf('const SCREENS=');
      return H.matchBlock(i, 'SCREENS', '[').replace(/^const /, 'var ') + ';'; })();

function ctx(role, st) {
  const log = { toasts: [], actions: [], saved: 0, closed: 0, html: '' };
  const modal = { className: '', set innerHTML(v) { log.html = v; }, get innerHTML() { return log.html; } };
  const s = {
    console, Date, JSON, TODAY: new Date('2026-08-22T00:00:00Z'),
    /* a REAL escaper, not the identity. Stubbing _pe as String() meant every
       escaping check in this file proved nothing. */
    fmt: n => String(n),
    _pe: v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    _tx: v => String(v == null ? '' : v),
    toast: m => log.toasts.push(m),
    save: () => { log.saved++; }, closeModal: () => { log.closed++; }, render: () => {},
    evToday: () => '2026-08-22', batchAging: () => 26,
    $: id => (id === 'modal' ? modal : { classList: { add() {}, remove() {} } }),
    settledForm: null, reopenForm: null,
  };
  s.state = Object.assign({ role, screen: 'prod', currentUser: { name: 'Prod Person', username: 'prod' }, seq: 100,
    corrections: [], audit: [], actionLog: [],
    masters: JSON.parse(JSON.stringify(require(H.STATE).data.masters)) }, st);
  s.globalThis = s; vm.createContext(s); vm.runInContext(SRC, s);
  s._log = log; return s;
}

const batch = o => Object.assign({
  id: 'B1', batchNo: 'HG26001', kind: 'bulk', base: 'Humi Grow',
  plannedKg: 5000, producedKg: 5000, packedKg: 5000, disposedKg: 0, status: 'open',
}, o);
/* 5000 of 5000 leaves 250 Kg of headroom (105% cap), which is the real live shape:
   every closed batch on the system sits at exactly 100% of plan. */

/* ================= 1. which batches count as finished and on plan ================= */
{
  const s = ctx('Production', { batches: [
    batch(),                                             // settled
    batch({ id: 'B2', producedKg: 4000, packedKg: 4000 }),// short of plan -> needs a reason, not settled
    batch({ id: 'B3', packedKg: 3000 }),                 // 2000 unpacked -> not settled
    batch({ id: 'B4', status: 'closed' }),               // already closed
    batch({ id: 'B5', producedKg: 0, packedKg: 0 }),     // nothing produced
    batch({ id: 'B6', pool: true }),                     // a pool, not a real batch
    batch({ id: 'B7', voided: true }),
    batch({ id: 'B8', producedKg: 6000, packedKg: 6000 }),// over plan -> settled
  ], packingLog: [] });
  const got = s.settledBatches().map(b => b.id).sort().join(',');
  eq('only the finished, on-plan, still-open ones are offered', got, 'B1,B8');
}

/* ================= 2. the list shows every one, with its numbers ================= */
{
  const many = Array.from({ length: 26 }, (_, i) =>
    batch({ id: 'B' + i, batchNo: 'HG260' + String(i).padStart(2, '0'), plannedKg: 1000 + i, producedKg: 1000 + i, packedKg: 1000 + i }));
  const s = ctx('Production', { batches: many, packingLog: [] });
  s.openSettledClose();
  const h = s._log.html;
  eq('every batch has a row, not the first eight', (h.match(/<tr/g) || []).length - 1, 26);
  ok('the first one is named', /HG26000/.test(h));
  ok('and so is the twenty-sixth', /HG26025/.test(h));
  ok('planned, produced and packed are all shown', /Planned/.test(h) && /Produced/.test(h) && /Packed/.test(h));
  ok('and how long it has been open', /Open<\/th>/.test(h) && /26 days/.test(h));
  ok('every row can be unticked', (h.match(/type="checkbox"/g) || []).length === 26);
  /* count the ATTRIBUTE, not the word: `this.checked` in the handler matches too */
  ok('all start ticked', (h.match(/type="checkbox" checked/g) || []).length === 26);
  ok('it says how many are being closed', /Closing <b>26<\/b> of 26/.test(h));
  ok('it warns that no more output can be added', /No more shift output can be added/.test(h));
  ok('and that the Plant Manager can undo it', /reopened by the <b>Plant Manager<\/b>/.test(h));
}

/* ================= 3. unticking actually works ================= */
{
  const s = ctx('Production', { batches: [batch(), batch({ id: 'B2', batchNo: 'HG26002' })], packingLog: [] });
  s.openSettledClose();
  s.settledPick('B2', false);
  ok('the count follows the ticks', /Closing <b>1<\/b> of 2/.test(s._log.html));
  s.closeSettledBatches();
  eq('the ticked one is closed', s.state.batches[0].status, 'closed');
  eq('the unticked one is left alone', s.state.batches[1].status, 'open');
  ok('and the log names only the one that was closed',
    s.state.actionLog.length === 1 && /HG26001/.test(s.state.actionLog[0].what));
}
{
  const s = ctx('Production', { batches: [batch(), batch({ id: 'B2' })], packingLog: [] });
  s.openSettledClose(); s.settledPickAll(false);
  ok('with nothing ticked the button is not offered', !/Close \d+ batch/.test(s._log.html));
  s.closeSettledBatches();
  eq('and closing does nothing', s.state.batches[0].status, 'open');
  ok('it says so', s._log.toasts.some(t => /Nothing ticked/.test(t)));
}

/* ================= 4. what closing records ================= */
{
  const b = batch();
  const s = ctx('Production', { batches: [b], orders: [], packingLog: [] });
  s.openSettledClose(); s.closeSettledBatches();
  eq('status', b.status, 'closed');
  eq('actual yield is what it produced', b.actualYield, 5000);
  eq('no variance', b.varianceKg, 0);
  eq('the person, not the job', b.closedBy, 'Prod Person');
  eq('flagged as a bulk close so it is never read as a judgement', b.closedBulk, true);
  ok('each one logged individually with its numbers', /HG26001 closed at 5000\/5000/.test(s.state.actionLog[0].what));
  eq('and saved', s._log.saved > 0, true);
}
{ /* a PO batch marks its order line production-complete, and does not overwrite an earlier date */
  const b = batch({ kind: 'po', po: 'PO-1', lineId: 'L1' });
  const l = { id: 'L1', prodComplete: '' };
  const s = ctx('Production', { batches: [b], orders: [{ po: 'PO-1', lines: [l] }], packingLog: [] });
  s.openSettledClose(); s.closeSettledBatches();
  eq('the order line gets its production-complete date', l.prodComplete, '2026-08-22');
  const b2 = batch({ id: 'B2', kind: 'po', po: 'PO-2', lineId: 'L2' });
  const l2 = { id: 'L2', prodComplete: '2026-01-01' };
  const s2 = ctx('Production', { batches: [b2], orders: [{ po: 'PO-2', lines: [l2] }], packingLog: [] });
  s2.openSettledClose(); s2.closeSettledBatches();
  eq('an earlier date is not overwritten', l2.prodComplete, '2026-01-01');
}

/* ================= 5. who may close ================= */
{
  const s = ctx('KAM', { batches: [batch()], packingLog: [] });
  s.openSettledClose();
  ok('a KAM cannot even open the list', s._log.toasts.some(t => /Production/.test(t)));
  eq('and nothing is shown', s._log.html, '');
  const s2 = ctx('Plant Manager', { batches: [batch()], packingLog: [] });
  s2.openSettledClose();
  ok('nor can the Plant Manager close them', s2._log.toasts.length > 0);
  const s3 = ctx('COO', { batches: [batch()], packingLog: [] });
  s3.openSettledClose();
  ok('the COO can', /Closing <b>1<\/b> of 1/.test(s3._log.html));
}

/* ================= 6. REOPENING — the thing that did not exist ================= */
{
  const s = ctx('Plant Manager', { batches: [], packingLog: [] });
  eq('an open batch cannot be reopened', /not closed/.test(s.batchReopenBlocked(batch())), true);
  eq('a closed one can', s.batchReopenBlocked(batch({ status: 'closed' })), null);
  eq('a missing one is refused', /not found/.test(s.batchReopenBlocked(null)), true);
}
{ /* Production closed it; Production cannot undo it */
  const b = batch({ status: 'closed', closedDate: '2026-08-01', closedBy: 'Prod Person' });
  const s = ctx('Production', { batches: [b], packingLog: [] });
  s.openReopenBatch('B1');
  ok('Production is refused', s._log.toasts.some(t => /Plant Manager/.test(t)));
  eq('the batch is untouched', b.status, 'closed');
}
{
  const b = batch({ status: 'closed', closedDate: '2026-08-01', closedBy: 'Prod Person', closedBulk: true, actualYield: 5000, varianceKg: 0 });
  const s = ctx('Plant Manager', { batches: [b], packingLog: [] });
  s.openReopenBatch('B1');
  ok('the Plant Manager gets the form', /Reopen batch HG26001/.test(s._log.html));
  ok('it says the close is undone', /<b>undo the close<\/b>/.test(s._log.html));
  ok('and does NOT promise output that no screen would accept',
    !/more be added/.test(s._log.html) && /will NOT let more output be logged/.test(s._log.html));
  ok('and says what to do if more really is needed', /open a new batch/.test(s._log.html));
  ok('it notes it was closed in bulk', /closed in bulk/.test(s._log.html));
  ok('a reason is required on the form', /What happened/.test(s._log.html));

  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'no';
  s.doReopenBatch();
  eq('one word is not a reason', b.status, 'closed');

  s.reopenForm.reason = 'Closed this by mistake in the bulk list, the night shift is still running on it.';
  s.reopenForm.reasonCode = '';
  s.doReopenBatch();
  eq('and a reason code is required too', b.status, 'closed');

  s.reopenForm.reasonCode = 'keying';
  s.doReopenBatch();
  eq('with both, it reopens', b.status, 'open');
  eq('the close date is cleared', b.closedDate, null);
  eq('so is the bulk flag', b.closedBulk, false);
  eq('and it names the PERSON who reopened it, not their job title', b.reopenedBy, 'Prod Person');
  eq('it is saved', s._log.saved > 0, true);
}
{ /* what the close recorded is kept, not wiped */
  const b = batch({ status: 'closed', closedDate: '2026-08-01', closedBy: 'Prod Person',
    actualYield: 4000, varianceKg: 1000, varianceReason: 'Raw-material moisture loss', varianceNote: 'wet urea batch' });
  const s = ctx('Plant Manager', { batches: [b], packingLog: [] });
  s.openReopenBatch('B1');
  ok('the form warns the variance reason stays on record', /yield variance recorded/.test(s._log.html));
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed against the wrong batch number, this one is still producing.';
  s.doReopenBatch();
  eq('the old close is archived, not lost', (b.closeHistory || []).length, 1);
  eq('...with the variance reason intact', b.closeHistory[0].varianceReason, 'Raw-material moisture loss');
  eq('...and the note', b.closeHistory[0].varianceNote, 'wet urea batch');
  eq('...and who closed it', b.closeHistory[0].closedBy, 'Prod Person');
  eq('...and who reopened it', b.closeHistory[0].reopenedBy, 'Prod Person');
  eq('...with their role beside it', b.closeHistory[0].reopenedRole, 'Plant Manager');
  ok('...including their sentence', /wrong batch number/.test(b.closeHistory[0].reopenReason));
  eq('the live variance fields are cleared for the next close', b.varianceReason, '');
}
{ /* it lands in the corrections register like every other change to a finished record */
  const b = batch({ status: 'closed', closedDate: '2026-08-01', closedBy: 'Prod Person' });
  const s = ctx('Plant Manager', { batches: [b], packingLog: [] });
  s.openReopenBatch('B1');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake, the batch is still running on the night shift.';
  s.doReopenBatch();
  eq('one entry in the register', s.state.corrections.length, 1);
  const c = s.state.corrections[0];
  eq('...against the batch', c.entityType, 'batch');
  eq('...naming the person', c.by, 'Prod Person');
  eq('...with the role they held', c.byRole, 'Plant Manager');
  eq('...showing what changed', c.changes[0].field, 'status');
  eq('...from', c.changes[0].before.slice(0, 6), 'closed');
  eq('...to', c.changes[0].after, 'open');
  ok('...and what it means', (c.cascade || []).some(x => /Shift output can be added/.test(x)));
  const rt = JSON.parse(JSON.stringify(s.state.corrections));
  eq('and it survives being saved', rt[0].changes[0].after, 'open');
}
{ /* shipped material is called out, because reopening does not recall it */
  const b = batch({ status: 'closed', closedDate: '2026-08-01' });
  const s = ctx('Plant Manager', { batches: [b],
    packingLog: [{ baseBatchId: 'B1', shipKg: 3000, insKg: 3000 }] });
  s.openReopenBatch('B1');
  ok('the form says the material has already shipped', /already SHIPPED/.test(s._log.html));
  ok('and that reopening does not recall it', /does not recall it/.test(s._log.html));
}
{ /* reopened batch becomes closable again, and settledBatches picks it back up */
  const b = batch({ status: 'closed', closedDate: '2026-08-01' });
  const s = ctx('Plant Manager', { batches: [b], packingLog: [] });
  eq('a closed batch is not in the settled list', s.settledBatches().length, 0);
  s.openReopenBatch('B1');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake during the bulk close this morning.';
  s.doReopenBatch();
  eq('once reopened it is offered again', s.settledBatches().length, 1);
}

/* ================= 7. both are actually reachable from a screen ================= */
ok('the banner opens the review list, not a straight close',
  /onclick="openSettledClose\(\)"/.test(html));
ok('the old confirm-box call is gone from the banner',
  !/onclick="closeSettledBatches\(\)">Close all/.test(html));
ok('the Reopen button is on the batch lifecycle view',
  /openReopenBatch\(\\'/.test(html));
{
  /* the reopen button must be built BEFORE the Production-only gate, or the
     Plant Manager never sees it */
  /* The gate returns the Correct button since 25 Aug (`if(!ed)return _cb;`), so
     the anchor is the gate itself, not what it used to return. */
  const fn = H.grab('_pcLifeAction');
  const gate = fn.indexOf('if(!edAny)return');
  const btn = fn.indexOf('openReopenBatch');
  ok('and it is not hidden behind the Production gate', btn >= 0 && btn < gate,
    'button at ' + btn + ', gate at ' + gate);
}

/* ================= 8. against the real data ================= */
{
  const s = ctx('Production', { batches: JSON.parse(JSON.stringify(STATE.batches || [])), packingLog: [], orders: [] });
  const n = s.settledBatches().length;
  ok('the snapshot has settled batches to close', n > 0, 'found ' + n);
  s.openSettledClose();
  eq('and every one of them gets a row', (s._log.html.match(/<tr/g) || []).length - 1, n);
  const closedAlready = (STATE.batches || []).filter(b => b && b.status === 'closed').length;
  ok('closed batches exist that could now be reopened', closedAlready > 0, 'found ' + closedAlready);
}

/* ================= 9. what the reviewers sent it back for ================= */

/* ---- a closed batch now has a screen to live on ---- */
{
  const closed = batch({ status: 'closed', closedDate: '2026-08-01', closedBy: 'Prod Person' });
  const s = ctx('Plant Manager', { batches: [closed], packingLog: [] });
  eq('closedBatches finds it', s.closedBatches().length, 1);
  const h = s.closedBatchesCard();
  ok('the card names it', /HG26001/.test(h));
  ok('shows what it produced', /5000/.test(h));
  ok('shows who closed it and when', /2026-08-01/.test(h) && /Prod Person/.test(h));
  ok('and offers Reopen to the Plant Manager', /openReopenBatch/.test(h));
  /* The row must NOT navigate. Drilling into a batch goes through a list that
     excludes closed ones and falls back to whichever is first, so three of these
     rows opened a different batch's page — and its Reopen button belonged to
     that other batch. The button on the row carries the right id. */
  ok('the row does not navigate anywhere', !/prodDrill=true/.test(h));
  ok('but the button carries this batch id', /openReopenBatch\('B1'\)/.test(h));

  const prod = ctx('Production', { batches: [closed], packingLog: [] });
  const h2 = prod.closedBatchesCard();
  ok('Production sees the batch but not the button', /HG26001/.test(h2) && !/openReopenBatch/.test(h2));
  ok('and is told who can', /Plant Manager reopens/.test(h2));
}
{
  const s = ctx('Production', { batches: [], packingLog: [] });
  ok('with nothing closed it says so rather than showing an empty table',
    /Nothing closed yet/.test(s.closedBatchesCard()));
}
ok('the Completed tab renders the card', /\+closedBatchesCard\(\)/.test(html));
ok('...on the empty branch too', (html.match(/\+closedBatchesCard\(\)/g) || []).length >= 2);

/* ---- the close-while-someone-is-logging-output case ---- */
{
  const s = ctx('Production', { batches: [], packingLog: [] });
  eq('a batch closed at what it produced is fine',
    s.batchYieldMismatch(batch({ status: 'closed', actualYield: 5000 })), 0);
  eq('one closed at less than it produced is flagged',
    s.batchYieldMismatch(batch({ status: 'closed', producedKg: 5250, actualYield: 5000 })), 250);
  eq('an open batch is never flagged', s.batchYieldMismatch(batch({ actualYield: 1 })), 0);
}
{
  const bad = batch({ status: 'closed', closedDate: '2026-08-01', producedKg: 5250, actualYield: 5000 });
  const s = ctx('Plant Manager', { batches: [bad], packingLog: [] });
  const h = s.closedBatchesCard();
  ok('the card warns about it in plain words', /no longer matches what the batch produced/.test(h));
  ok('and explains how it happens', /logged while somebody has the close list open/.test(h));
  ok('the row shows both numbers', /5250/.test(h) && /closed at 5000/.test(h));
  const prod = ctx('Production', { batches: [bad], packingLog: [] });
  ok('Production is told to ask the Plant Manager',
    /Ask the Plant Manager/.test(prod.closedBatchesCard()));
  eq('and a wrong yield can always be reopened, headroom or not',
    s.batchReopenBlocked(batch({ status: 'closed', producedKg: 5250, actualYield: 5000, plannedKg: 5000 })), null);
}

/* ---- reopening promises only what it can deliver ---- */
{
  const s = ctx('Plant Manager', { batches: [], orders: [], packingLog: [] });
  eq('a batch at plan has 5% of headroom', s.batchReopenHeadroom(batch()), 250);
  eq('one at the 105% cap has none', s.batchReopenHeadroom(batch({ producedKg: 5250 })), 0);
  /* A batch with no headroom is STILL reopenable. Refusing it was my own bug:
     a settled batch is at or above plan by definition, so the refusal fired on
     exactly the batches the bulk button closes — 6 of the 16 in the live list
     could not have been undone by anyone, including the COO. */
  eq('a batch with no headroom can still be reopened', s.batchReopenBlocked(batch({ status: 'closed', producedKg: 5250 })), null);
  eq('and so can one at plan', s.batchReopenBlocked(batch({ status: 'closed' })), null);
}
{
  /* a PO batch whose order is fully produced can take nothing, whatever the cap says */
  const b = batch({ kind: 'po', po: 'PO-1', lineId: 'L1', status: 'closed' });
  const s = ctx('Plant Manager', { batches: [b], packingLog: [],
    orders: [{ po: 'PO-1', lines: [{ id: 'L1', ordered: 5000, produced: 5000 }] }] });
  eq('the order leaves no room', s.batchReopenHeadroom(b), 0);
  eq('but the close can still be undone', s.batchReopenBlocked(b), null);
  s.reopenForm = null; s.openReopenBatch('B1');
  ok('the dialogue says the same thing for a PO batch with no room',
    /will NOT let more output be logged/.test(s._log.html));
  ok('...and points at a new batch', /open a new batch/i.test(s._log.html));
}

/* ---- a reopened batch does not quietly get closed again ---- */
{
  const plain = batch({ id: 'B1' });
  const reop = batch({ id: 'B2', batchNo: 'HG26002', closeHistory: [{ id: 'CH1', reopenReason: 'Night shift still running on it.' }] });
  const s = ctx('Production', { batches: [plain, reop], packingLog: [] });
  s.openSettledClose();
  eq('the untouched one is ticked', s.settledForm.pick.B1, true);
  eq('the reopened one is NOT', s.settledForm.pick.B2, false);
  ok('the row says it was reopened', /reopened<\/span>/.test(s._log.html));
  ok('and shows why', /Night shift still running/.test(s._log.html));
  ok('only one is being closed', /Closing <b>1<\/b> of 2/.test(s._log.html));
  s.closeSettledBatches();
  eq('so the reopened one stays open', reop.status, 'open');
}

/* ---- the PO tracker stops saying Produced ---- */
{
  const b = batch({ kind: 'po', po: 'PO-1', lineId: 'L1', status: 'closed', closedDate: '2026-08-01', plannedKg: 5000, producedKg: 4000 });
  const l = { id: 'L1', brand: 'Humi Grow', ordered: 6000, produced: 4000, prodComplete: '2026-08-01' };
  const s = ctx('Plant Manager', { batches: [b], packingLog: [], orders: [{ po: 'PO-1', lines: [l] }] });
  s.openReopenBatch('B1');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake in the bulk list this morning.';
  s.doReopenBatch();
  eq('the order line is no longer marked produced', l.prodComplete, '');
  ok('and the register says so', (s.state.corrections[0].cascade || []).some(x => /no longer marked Produced/.test(x)));
}
{
  /* a date set by some OTHER batch must not be cleared */
  const b = batch({ kind: 'po', po: 'PO-1', lineId: 'L1', status: 'closed', closedDate: '2026-08-01', producedKg: 4000 });
  const l = { id: 'L1', ordered: 6000, produced: 4000, prodComplete: '2026-07-15' };
  const s = ctx('Plant Manager', { batches: [b], packingLog: [], orders: [{ po: 'PO-1', lines: [l] }] });
  s.openReopenBatch('B1');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake in the bulk list this morning.';
  s.doReopenBatch();
  eq('a date this batch did not set is left alone', l.prodComplete, '2026-07-15');
}

/* ---- two people reopening the same batch keep both records ---- */
{
  const b = batch({ status: 'closed', closedDate: '2026-08-01', producedKg: 4000 });
  const s = ctx('Plant Manager', { batches: [b], packingLog: [], orders: [] });
  s.openReopenBatch('B1');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake in the bulk list this morning.';
  s.doReopenBatch();
  ok('each history entry carries an id so a merge keeps both',
    !!(b.closeHistory[0] || {}).id);
}

/* ---- filed under an operation the Plant Manager is actually allowed ---- */
{
  const b = batch({ status: 'closed', closedDate: '2026-08-01', producedKg: 4000 });
  const s = ctx('Plant Manager', { batches: [b], packingLog: [], orders: [] });
  s.openReopenBatch('B1');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake in the bulk list this morning.';
  s.doReopenBatch();
  eq('recorded as a REVERSE, which is the Plant Manager\'s to do', s.state.corrections[0].op, 'REVERSE');
  /* A reopen writes its own REVERSE row through recordCorrection — it does not
     go through applyCorrect, so what authorises it is doReopenBatch's own
     hardRole(['Plant Manager']) gate, not the registry's `reverse` list. Those
     are two different things, and this test used to conflate them.
     The registry's list is deliberately EMPTY: the batch entity has no
     doReverse, so a generic REVERSE would fall through to rec.reversed=true,
     which nothing reads for a batch — a no-op that told the Plant Manager the
     batch had been struck through while it carried on shipping. */
  const reg = H.grabObj('CORRECT_ENTITY');
  const seg = reg.slice(reg.indexOf('batch:{'));
  ok('the reopen is authorised by doReopenBatch itself',
     /hardRole\(\['Plant Manager'\]\)/.test(H.grab('doReopenBatch')));
  ok('and the registry grants the generic REVERSE to nobody, because it would do nothing',
     /reverse:\[\]/.test(seg), seg.slice(0, 200));
  ok('...while AMEND on a batch is still somebody\'s',
     /amend:\['Production','COO'\]/.test(seg));
}

/* ---- the stale variance notice is cleared ---- */
{
  const b = batch({ status: 'closed', closedDate: '2026-08-01', producedKg: 4000,
    varianceKg: 1000, varianceReason: 'Wastage', varianceNotify: { to: 'Plant Manager', ack: false } });
  const s = ctx('Plant Manager', { batches: [b], packingLog: [], orders: [] });
  s.openReopenBatch('B1');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed against the wrong batch, this one is still running.';
  s.doReopenBatch();
  eq('the notice about a variance that no longer exists is cleared', b.varianceNotify, null);
  eq('but the variance itself is kept in history', b.closeHistory[0].varianceReason, 'Wastage');
}

/* ---- the scroll position survives a tick ---- */
ok('the list has a scroll container that can be restored', /id="settledScroll"/.test(html));
ok('and ticking saves and restores it', /settledForm\.scroll=sc\?sc\.scrollTop:0/.test(html));

/* ================= 10. the second round of review findings ================= */

/* ---- log rows carry an id, so a merge keeps everybody's ---- */
{
  const s = ctx('Production', { batches: [batch()], packingLog: [], orders: [] });
  s.openSettledClose(); s.closeSettledBatches();
  ok('the action log row has an id, so a merge can match it', !!(s.state.actionLog[0] || {}).id);
  /* NO audit row is written by the bulk close, on purpose. Writing an id'd one
     while the other 24 audit writers stay bare makes the merge take the
     id-matching path and silently drop every bare row from the other person's
     copy — so it deleted more than it recorded. */
  eq('the bulk close writes no audit row', (s.state.audit || []).length, 0);
  ok('and the reason is written down where the next edit will hit it',
    /THE AUDIT TRAIL IS NOT SAFE TO HALF-FIX/.test(html));
  ok('with no half-usable helper left lying about', !/^function auditRow\(/m.test(html));
}
{
  /* run the file's OWN merge over a bulk close colliding with somebody else's
     work. Without ids the whole array is replaced and one side's rows vanish. */
  const M = (() => {
    const vm2 = require('vm');
    const src = [H.grab('merge3'), H.grab('_arrId'), H.grab('_eq')].join('\n');
    const box = { console, JSON, Object, Array, Math, Date };
    box.globalThis = box; vm2.createContext(box); vm2.runInContext(src, box); return box;
  })();
  const base = { actionLog: [{ id: 'AL1', what: 'earlier' }] };
  const mine = { actionLog: [{ id: 'AL3', what: 'my bulk close' }, { id: 'AL1', what: 'earlier' }] };
  const theirs = { actionLog: [{ id: 'AL2', what: 'somebody else' }, { id: 'AL1', what: 'earlier' }] };
  const out = M.merge3(base, mine, theirs);
  const what = out.actionLog.map(r => r.what).sort().join('|');
  ok('a bulk close no longer deletes the other person\'s log rows',
    /my bulk close/.test(what) && /somebody else/.test(what), what);
}

/* ---- Tick all does not override a deliberate reopen ---- */
{
  const plain = batch({ id: 'B1' });
  const reop = batch({ id: 'B2', closeHistory: [{ id: 'CH1', reopenReason: 'still running' }] });
  const s = ctx('Production', { batches: [plain, reop], packingLog: [] });
  s.openSettledClose();
  s.settledPickAll(true);
  eq('Tick all ticks the ordinary one', s.settledForm.pick.B1, true);
  eq('but does not pick up the reopened one', s.settledForm.pick.B2, false);
  /* and if the person read it and ticked it themselves, Tick all must not
     silently take their decision away again */
  s.settledPick('B2', true);
  eq('a hand-ticked reopened batch is ticked', s.settledForm.pick.B2, true);
  s.settledPickAll(true);
  eq('...and Tick all leaves it ticked', s.settledForm.pick.B2, true);
  s.settledPickAll(false);
  eq('Untick all still unticks everything', s.settledForm.pick.B1, false);
  eq('...including the reopened one', s.settledForm.pick.B2, false);
}

/* ---- the worklist stops asking for a reopened batch to be closed ---- */
{
  const AI = (() => {
    const vm2 = require('vm');
    const src = [H.grab('coaItemOf'), H.grab('batchRemainderKg')].join('\n');
    const box = { console, Math, fmt: n => String(n) };
    box.globalThis = box; vm2.createContext(box); vm2.runInContext(src, box); return box;
  })();
  /* built for real, not grepped: the row is a single clipped line, so the batch
     number has to come near the front or the reader sees a warning about a batch
     they cannot identify. */
  const mk = (b) => {
    const _esc = t => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const _re = (b.closeHistory && b.closeHistory[0]) || null;
    let _why = _re ? _esc(_re.reopenReason || 'no reason given') : '';
    if (_why.length > 70) _why = _why.slice(0, 70) + '…';
    return (_re ? 'REOPENED · ' : 'Close batch ') + (b.batchNo || b.id) + ' — ' + _esc('Humi Grow')
      + ' · 5000 Kg/L, all placed · on plan'
      + (_re ? (' · reopened by ' + _esc(_re.reopenedBy || 'the Plant Manager') + ': ' + _why) : '');
  };
  const line = mk(batch({ closeHistory: [{ id: 'CH1', reopenedBy: 'Asif Raza', reopenReason: 'Night shift still running on it.' }] }));
  ok('the line flags the reopen', /^REOPENED/.test(line));
  ok('and the batch number is near the front', line.indexOf('HG26001') < 25, 'at ' + line.indexOf('HG26001'));
  ok('who reopened it is in there', /Asif Raza/.test(line));
  ok('and why', /Night shift still running/.test(line));
  const nasty = mk(batch({ closeHistory: [{ id: 'CH1', reopenedBy: 'X', reopenReason: 'moisture <20% <img src=x onerror=alert(1)>' }] }));
  ok('a reason containing markup is escaped, not rendered',
    !/<img/.test(nasty) && /&lt;img/.test(nasty));
  const longOne = mk(batch({ closeHistory: [{ id: 'CH1', reopenedBy: 'X', reopenReason: 'x'.repeat(300) }] }));
  ok('and a very long reason is trimmed', longOne.length < 260, 'len ' + longOne.length);
  ok('the code itself leads with the batch', /\(_re\?'REOPENED · ':'Close batch '\)/.test(html));
  ok('and escapes what it is given', /var _esc=function\(t\)/.test(html));
  ok('the button changes so nobody closes it on reflex', /Reopened . check first/.test(html));
}

/* ---- a reopen that cannot be recorded is undone completely ---- */
{
  const b = batch({ kind: 'po', po: 'PO-1', lineId: 'L1', status: 'closed', closedDate: '2026-08-01',
    closedBy: 'Prod Person', closedBulk: true, actualYield: 4000, producedKg: 4000,
    varianceKg: 1000, varianceReason: 'Wastage', varianceNotify: { to: 'Plant Manager', ack: false } });
  const l = { id: 'L1', ordered: 6000, produced: 4000, prodComplete: '2026-08-01' };
  const s = ctx('Plant Manager', { batches: [b], packingLog: [], orders: [{ po: 'PO-1', lines: [l] }] });
  s.recordCorrection = function () { throw new Error('register unavailable'); };
  s.openReopenBatch('B1');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake in the bulk list this morning.';
  s.doReopenBatch();
  eq('the batch is still closed', b.status, 'closed');
  eq('the close date is back', b.closedDate, '2026-08-01');
  eq('so is the variance reason', b.varianceReason, 'Wastage');
  ok('so is the variance notice', !!b.varianceNotify);
  eq('the history is not left with a phantom entry', (b.closeHistory || []).length, 0);
  eq('and the PO line still reads Produced', l.prodComplete, '2026-08-01');
  ok('the person is told nothing changed', s._log.toasts.some(t => /Nothing was changed/.test(t)));
  eq('nothing was saved', s._log.saved, 0);
  eq('and the register does not claim it happened', (s.state.corrections || []).length, 0);
}
{
  /* The real partial failure: recordCorrection files the entry and THEN throws
     while building its summary. Replacing the whole function with a thrower, as
     the check above does, never reaches that state. */
  const b = batch({ status: 'closed', closedDate: '2026-08-01', closedBy: 'Prod Person', producedKg: 4000 });
  const s = ctx('Plant Manager', { batches: [b], packingLog: [], orders: [] });
  const real = s.recordCorrection;
  s.recordCorrection = function (op, type, id, label, changes, code, reason, casc) {
    s.state.corrections.unshift({ id: 'CR9', op: op, entityType: type, entityId: id, changes: changes });
    throw new Error('failed while writing the summary');
  };
  s.openReopenBatch('B1');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake in the bulk list this morning.';
  s.doReopenBatch();
  eq('the batch is put back', b.status, 'closed');
  eq('and the half-written register row is taken back out', (s.state.corrections || []).length, 0);
}

/* ---- against the real data: can a mis-click actually be undone? ---- */
{
  const batches = JSON.parse(JSON.stringify(STATE.batches || []));
  const orders = JSON.parse(JSON.stringify(STATE.orders || []));
  const s = ctx('Production', { batches, orders, packingLog: [] });
  const list = s.settledBatches();
  ok('there are settled batches on the real data', list.length > 0, 'found ' + list.length);
  s.openSettledClose(); s.closeSettledBatches();

  const pm = ctx('Plant Manager', { batches, orders, packingLog: [] });
  const stuck = list.filter(b => pm.batchReopenBlocked(b) !== null);
  eq('every batch the bulk close just closed can be reopened again', stuck.length, 0,
    'stuck: ' + stuck.map(b => b.batchNo).join(', '));

  const noRoom = list.filter(b => pm.batchReopenHeadroom(b) <= 0.5).length;
  ok('and several of them genuinely have no production headroom, which is fine', noRoom > 0,
    noRoom + ' of ' + list.length + ' have no headroom and are still reopenable');
}

/* ================= 11. the fourth round of review findings ================= */

/* ---- the close modal shows what there is to check ---- */
{
  const vm2 = require('vm');
  const src = [H.grab('renderCloseBatch'), H.grab('coaItemOf')].join('\n');
  let out = '';
  const modal = { className: '', set innerHTML(v) { out = v; }, get innerHTML() { return out; } };
  const box = { console, Date, fmt: n => String(n), _pe: v => String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;'),
    _tx: v => String(v||''), $: () => modal, closeModal: () => {} };
  box.state = { role: 'Production', masters: { varianceReasons: ['Wastage'] },
    batches: [batch({ id: 'B1', status: 'open',
      closeHistory: [{ id: 'CH1', reopenedBy: 'Asif Raza', reopenedAt: '2026-08-22', reopenReason: 'Night shift still running on it.' }] })] };
  box.closeForm = { bid: 'B1', reason: '', note: '' };
  box.globalThis = box; vm2.createContext(box); vm2.runInContext(src, box);
  box.renderCloseBatch();
  ok('the close modal says the batch was reopened', /was reopened/.test(out));
  ok('...by whom', /Asif Raza/.test(out));
  ok('...and why', /Night shift still running/.test(out));
  ok('...and what that means', /Close it again only if that has been dealt with/.test(out));

  /* an ordinary batch shows no such banner */
  box.state.batches = [batch({ id: 'B1', status: 'open' })];
  box.renderCloseBatch();
  ok('an ordinary batch gets no banner', !/was reopened/.test(out));

  /* and a reason containing markup does not become markup */
  box.state.batches = [batch({ id: 'B1', status: 'open',
    closeHistory: [{ id: 'CH1', reopenReason: 'moisture <20% <img src=x>' }] })];
  box.renderCloseBatch();
  ok('the reason is escaped here too', !/<img/.test(out) && /&lt;img/.test(out));
}

/* ---- a failed reopen must not eat an EARLIER genuine correction ---- */
{
  const b = batch({ status: 'closed', closedDate: '2026-08-01', producedKg: 4000 });
  const s = ctx('Plant Manager', { batches: [b], packingLog: [], orders: [] });
  /* an earlier, real reopen of the SAME batch is already on the register */
  s.state.corrections.push({ id: 'CR1', op: 'REVERSE', entityType: 'batch', entityId: 'B1', reason: 'the first genuine reopen' });
  s.recordCorrection = function (op, type, id, label, changes) {
    s.state.corrections.unshift({ id: 'CR9', op: op, entityType: type, entityId: id, changes: changes });
    throw new Error('failed while writing the summary');
  };
  s.openReopenBatch('B1');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake in the bulk list this morning.';
  s.doReopenBatch();
  eq('the half-written row is removed', s.state.corrections.filter(c => c.id === 'CR9').length, 0);
  eq('and the earlier genuine one is still there', s.state.corrections.filter(c => c.id === 'CR1').length, 1);
  eq('the ledger is back to exactly what it was', s.state.corrections.length, 1);
}

/* ---- a PO line marked by a sibling batch keeps its date ---- */
{
  const a = batch({ id: 'BA', batchNo: 'RUOK26004', kind: 'po', po: 'PO-1', lineId: 'L1',
    status: 'closed', closedDate: '2026-08-22', producedKg: 4000 });
  const bb = batch({ id: 'BB', batchNo: 'RUOK26005', kind: 'po', po: 'PO-1', lineId: 'L1',
    status: 'closed', closedDate: '2026-08-22', producedKg: 4000 });
  const l = { id: 'L1', brand: 'Orbit-K', ordered: 20000, produced: 8000, prodComplete: '2026-08-22' };
  const s = ctx('Plant Manager', { batches: [a, bb], packingLog: [], orders: [{ po: 'PO-1', lines: [l] }] });
  s.openReopenBatch('BA');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'This one was closed by mistake, the other was fine.';
  s.doReopenBatch();
  eq('reopening one of two keeps the line marked Produced', l.prodComplete, '2026-08-22');
  ok('and the cascade does not claim otherwise',
    !(s.state.corrections[0].cascade || []).some(x => /no longer marked Produced/.test(x)));

  /* now reopen the second one too: with no closed sibling left, it clears */
  const s2 = ctx('Plant Manager', { batches: [a, bb], packingLog: [], orders: [{ po: 'PO-1', lines: [l] }] });
  s2.openReopenBatch('BB');
  s2.reopenForm.reasonCode = 'keying';
  s2.reopenForm.reason = 'This one was closed by mistake as well.';
  s2.doReopenBatch();
  eq('once the last closed batch on the line is reopened, it clears', l.prodComplete, '');
}

/* ---- the trim counts characters a person reads ---- */
{
  const trim = raw => { let w = String(raw || ''); if (w.length > 70) w = w.slice(0, 70) + '…'; return w; };
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ampy = 'moisture & temp & weight & yield & spec & lot & bag & date & shift & run & more text here';
  const shown = esc(trim(ampy));
  const readable = shown.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  ok('an ampersand-heavy reason still shows about 70 real characters',
    readable.length >= 68 && readable.length <= 72, 'got ' + readable.length);
  ok('and the cut never lands inside an entity', !/&[a-z]{1,4}$/.test(shown) && !/&$/.test(shown));
  ok('the code trims the raw text before escaping', /_whyRaw=_whyRaw\.slice\(0,70\)/.test(html));
}

/* ---- the migration log writers carry ids too ---- */
{
  ok('the one-shot migrations that write the action log give their rows ids',
    !/\(s\.actionLog=s\.actionLog\|\|\[\]\)\.unshift\(\{t:/.test(html));
  const writers = (html.match(/actionLog=s\.actionLog\|\|\[\]\)\.unshift/g) || []).length;
  ok('and every one of them was covered', writers > 0);
}

/* ================= 12. round five ================= */

/* ---- a sibling closed on a DIFFERENT day still keeps the line marked ---- */
{
  const mk = (id, no, closed) => batch({ id, batchNo: no, kind: 'po', po: 'PO-1', lineId: 'L1',
    status: 'closed', closedDate: closed, producedKg: 4000 });
  const a = mk('BA', 'RUOK26004', '2026-08-18');
  const bb = mk('BB', 'RUOK26005', '2026-08-20');          // closed two days later
  const l = { id: 'L1', brand: 'Orbit-K', ordered: 20000, produced: 8000, prodComplete: '2026-08-18' };
  const s = ctx('Plant Manager', { batches: [a, bb], packingLog: [], orders: [{ po: 'PO-1', lines: [l] }] });
  s.openReopenBatch('BA');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake, the other one was genuinely finished.';
  s.doReopenBatch();
  eq('a sibling closed on another day still keeps the line Produced', l.prodComplete, '2026-08-18');
}
{
  /* fresh objects, so this does not depend on the block above having run */
  const mk = (id, no, closed) => batch({ id, batchNo: no, kind: 'po', po: 'PO-1', lineId: 'L1',
    status: 'closed', closedDate: closed, producedKg: 4000 });
  const only = mk('BC', 'RUOK26006', '2026-08-18');
  const l = { id: 'L1', brand: 'Orbit-K', ordered: 20000, produced: 4000, prodComplete: '2026-08-18' };
  const s = ctx('Plant Manager', { batches: [only], packingLog: [], orders: [{ po: 'PO-1', lines: [l] }] });
  s.openReopenBatch('BC');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake, nothing else on this line is closed.';
  s.doReopenBatch();
  eq('with no closed sibling left, the date clears', l.prodComplete, '');
  ok('and the register says so', (s.state.corrections[0].cascade || []).some(x => /no longer marked Produced/.test(x)));
}
{
  /* a batch on a DIFFERENT line must not keep this line marked */
  const mine = batch({ id: 'BD', kind: 'po', po: 'PO-1', lineId: 'L1', status: 'closed', closedDate: '2026-08-18', producedKg: 4000 });
  const other = batch({ id: 'BE', kind: 'po', po: 'PO-1', lineId: 'L2', status: 'closed', closedDate: '2026-08-18', producedKg: 4000 });
  const l = { id: 'L1', brand: 'Orbit-K', ordered: 9000, produced: 4000, prodComplete: '2026-08-18' };
  const s = ctx('Plant Manager', { batches: [mine, other], packingLog: [],
    orders: [{ po: 'PO-1', lines: [l, { id: 'L2', prodComplete: '2026-08-18' }] }] });
  s.openReopenBatch('BD');
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake on this line only.';
  s.doReopenBatch();
  eq('another line does not keep this one marked', l.prodComplete, '');
}

/* ---- the free-typed batch number is escaped in the worklist ---- */
{
  const src = html;
  ok('the batch number goes through the escaper', /\+_esc\(b\.batchNo\|\|b\.id\)/.test(src));
  ok('so does the product name', /_esc\(coaItemOf\?coaItemOf\(b\)/.test(src));
  ok('and the reopen reason', /var _why=_esc\(_whyRaw\)/.test(src));
}

/* ---- nothing left promising output ---- */
{
  const s = ctx('Plant Manager', { batches: [batch({ status: 'closed', closedDate: '2026-08-01' })], packingLog: [], orders: [] });
  s.openReopenBatch('B1');
  ok('the dialogue never mentions adding output', !/more be added/.test(s._log.html));
  s.reopenForm.reasonCode = 'keying';
  s.reopenForm.reason = 'Closed by mistake in the bulk list this morning.';
  s.doReopenBatch();
  ok('and neither does the confirmation',
    s._log.toasts.some(t => /the close is undone/.test(t)) &&
    !s._log.toasts.some(t => /can be added/.test(t)));
}

console.log('\nBatch close and reopen: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
