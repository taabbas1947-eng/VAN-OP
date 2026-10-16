/* 16b (Tahir, 15 and 16 Oct 2026): the month on the bag, and the inspector from the login.
   - Mfg on the bag = the month of the packing date; expiry = same month + 24 (Production may pick 25 to 36, never shorter)
   - Pack and Pack on a run: the officer picks the month printed on the bags; a different month is saved and flagged to QA
   - the 3 correction sheets take the worked-out month and the shelf life already chosen for that batch number (24 if none)
   - a Night shift may be dated tomorrow, the day it ends (Night only)
   - 1 batch number packed in 2 months (same product, all POs): saved at once, the Production Manager confirms with a note;
     cancelling a run so only 1 month is left takes the job away by itself
   - QA: a flagged run answered Dates match needs a remark; made-on of an open batch says Batch not closed yet
   - the inspector is the signed-in person, locked, and nobody inspects a run they keyed
   - 3 old rules change: no levelling (syncPackBatchDates), bfxChecks no longer refuses on a date, Anomalies shows Packed in 2 months
   Run: node audit16b.test.js */
const vm = require('vm');
const H = require('./harness.js');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));
const html = H.html;
const fnSrc = (n) => H.grab(n);

const SRC = H.bagSrc() + '\n' + ['lotBaseNo', 'lotBrandNo', '_uRole', '_pe', 'bpEsc', 'openTwoMonth', 'twoMonthConfirm'].map(H.grab).join('\n') + '\nvar tmForm=null;';
function box(state) {
  const toasts = [], logs = [], modal = { innerHTML: '' };
  const b = { console, state, toasts, logs, modal,
    fmt: x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
    toast: m => toasts.push(m), logAction: m => logs.push(m), save() { b.saved = (b.saved || 0) + 1; }, closeModal() {}, render() {},
    $: id => id === 'modal' ? modal : { classList: { add() {}, remove() {} } } };
  b.globalThis = b; vm.createContext(b); vm.runInContext(SRC, b); return b;
}
const run = (o) => Object.assign({ id: 'P' + Math.random().toString(36).slice(2, 7), brand: 'Brand A', brandBatchNo: 'B-101', kg: 1000, po: 'PO-1', date: '2026-10-16' }, o);

/* ---------- 1. the month and the expiry ---------- */
{ const b = box({ packingLog: [], currentUser: { name: 'Sana', username: 'sana' } });
  let x = b.packBagFields('2026-10-16', 24, '2026-10');
  eq('1a mfg = month of the packing date', x.bagMfg, '2026-10');
  eq('1b expiry = same month + 24', x.bagExp, '2028-10');
  eq('1c printed month kept', x.printedMfg, '2026-10');
  ok('1d same month: no flag', !x.bagMonthDiff);
  eq('1e the officer who keyed it', x.byUser, 'sana');
  eq('1f 36 months allowed', b.packBagFields('2026-10-16', 36).bagExp, '2029-10');
  eq('1g 30 months', b.packBagFields('2026-01-31', 30).bagExp, '2028-07');
  eq('1h never shorter than 24', b.packBagFields('2026-10-16', 12).bagExp, '2028-10');
  eq('1i over 36 is not allowed: 24', b.packBagFields('2026-10-16', 48).bagExp, '2028-10');
  eq('1j December rolls the year', b.bagAddMonths('2026-12', 24), '2028-12');
  eq('1k November + 2', b.bagAddMonths('2026-11', 2), '2027-01');
  eq('1l label', b.bagMonthLabel('2026-10'), 'Oct-2026');
  x = b.packBagFields('2026-10-01', 24, '2026-09');
  ok('1m a different month is saved and flagged', x.bagMonthDiff === true && x.printedMfg === '2026-09' && x.bagMfg === '2026-10');
  x = b.packBagFields('2026-10-01', 24);
  ok('1n correction sheets: no printed month, no flag', !('printedMfg' in x) && !x.bagMonthDiff);
  eq('1o a Night shift ending 1 Nov is November', b.packBagFields('2026-11-01', 24).bagMfg, '2026-11');
}

/* ---------- 2. the shelf life already chosen for that batch number ---------- */
{ const b = box({ packingLog: [
    run({ id: 'a', date: '2026-10-01', shelfMonths: 30 }),
    run({ id: 'b', date: '2026-10-05', shelfMonths: 36 }),
    run({ id: 'c', date: '2026-10-09', shelfMonths: 24, reversed: true }),
    run({ id: 'd', date: '2026-10-09', shelfMonths: 24, brand: 'Brand B' }) ] });
  eq('2a the latest run not cancelled', b.bagShelfFor('Brand A', 'B-101'), 36);
  eq('2b none: 24', b.bagShelfFor('Brand A', 'X-9'), 24);
  eq('2c another product does not count', b.bagShelfFor('Brand B', 'B-101'), 24);
}

/* ---------- 3. what the bag should show: new runs bag months, old runs as before ---------- */
{ const b = box({ packingLog: [], batches: [{ id: 'BB1', closedDate: '2026-10-02' }, { id: 'BB2' }, { id: 'BB3', closed: true }] });
  const nw = b.lotBagDates({ bagMfg: '2026-10', bagExp: '2028-10', mfgDate: '2026-10-02', expDate: '2028-10-02' });
  ok('3a a 16b run shows bag months', nw.bag && nw.mfg === 'Oct-2026' && nw.exp === 'Oct-2028');
  const old = b.lotBagDates({ mfgDate: '2026-09-02', expDate: '2028-09-02' });
  ok('3b an old run keeps what it shows today, no flag', !old.bag && old.mfg === '2026-09-02' && old.exp === '2028-09-02');
  eq('3c made-on: the close date', b.lotMadeOn({ baseBatchId: 'BB1' }), '2026-10-02');
  eq('3d made-on: open batch', b.lotMadeOn({ baseBatchId: 'BB2' }), 'Batch not closed yet');
  eq('3e made-on: closed, no date', b.lotMadeOn({ baseBatchId: 'BB3' }), 'closed, no date');
  const lines = b.bagRunLines([{ brandBatchNo: 'B-101', date: '2026-10-01', kg: 500, bagMfg: '2026-10', bagExp: '2028-10', printedMfg: '2026-09', bagMonthDiff: true, baseBatchId: 'BB2' },
                               { brandBatchNo: 'B-101', date: '2026-10-03', kg: 700, bagMfg: '2026-10', bagExp: '2028-10' }]);
  ok('3f the QA sheet shows each run with its month', (lines.match(/expected Mfg/g) || []).length === 2 && /Oct-2026/.test(lines));
  ok('3g the flag shows the month picked', /picked <b>Sep-2026<\/b>/.test(lines));
  ok('3h made-on shows', /Batch not closed yet/.test(lines));
}

/* ---------- 4. QA: remark on a flagged Dates match ---------- */
{ const b = box({ packingLog: [] });
  const fl = [{ bagMonthDiff: true }], cl = [{}];
  ok('4a flagged + Dates match + no remark: refused', !!b.bagRemarkGate('pass', fl, ''));
  ok('4b flagged + Dates match + remark: allowed', b.bagRemarkGate('pass', fl, 'bags show Oct, seen') === null);
  ok('4c flagged + Dates differ: no remark needed here', b.bagRemarkGate('fail', fl, '') === null);
  ok('4d not flagged: no remark needed', b.bagRemarkGate('pass', cl, '') === null);
}

/* ---------- 5. the inspector from the login ---------- */
{ const b = box({ packingLog: [], currentUser: { name: 'Muhammad Ehtisham', username: 'ehtisham' } });
  eq('5a the name is the login', b.inspectorName(), 'Muhammad Ehtisham');
  ok('5b a run keyed by someone else: allowed', b.inspectorGate([{ byUser: 'sana', by: 'Sana', brandBatchNo: 'B1' }]) === null);
  ok('5c a run the same login keyed: refused', /cannot inspect/.test(b.inspectorGate([{ byUser: 'ehtisham', brandBatchNo: 'B1' }]) || ''));
  ok('5d an old run with only a name: refused on the same name', /cannot inspect/.test(b.inspectorGate([{ by: 'Muhammad Ehtisham', brandBatchNo: 'B1' }]) || ''));
  ok('5e the row is locked text, no input', /cannot be changed/.test(b.inspectorRow()) && !/<input/.test(b.inspectorRow()));
  b.state.currentUser = null;
  ok('5f nobody signed in: refused', /Sign in/.test(b.inspectorGate([]) || ''));
  b.state.currentUser = { name: 'QA Shared', username: 'qa' };
  ok('5g a shared QA login records its own name', b.inspectorName() === 'QA Shared' && b.inspectorGate([{ byUser: 'sana' }]) === null);
}

/* ---------- 6. a batch number packed in 2 months ---------- */
{ const st = { role: 'Production Manager', currentUser: { name: 'Sajid', username: 'sajid' }, twoMonthNotes: [], packingLog: [
    run({ id: 'r1', po: 'PO-1', date: '2026-09-30', bagMfg: '2026-09' }),
    run({ id: 'r2', po: 'PO-2', date: '2026-10-02', bagMfg: '2026-10' }),
    run({ id: 'r3', po: 'PO-2', date: '2026-10-02', bagMfg: '2026-10', brandBatchNo: 'B-202' }),
    run({ id: 'r4', po: 'PO-3', date: '2026-09-20', mfgDate: '2026-09-20', brandBatchNo: 'B-303' }),   /* old runs only, 2 dates: stays in Anomalies */
    run({ id: 'r4b', po: 'PO-3', date: '2026-08-02', mfgDate: '2026-08-01', brandBatchNo: 'B-303' }),
    run({ id: 'r5', po: 'PO-4', date: '2026-09-30', bagMfg: '2026-09', brand: 'Brand B' }) ] };
  const b = box(st);
  let j = b.twoMonthJobs();
  eq('6a 1 job across POs', j.length, 1);
  ok('6b job for the Production Manager, Packed in 2 months', j[0] && j[0].role === 'Production Manager' && j[0].label === 'Packed in 2 months' && j[0].tmk === 'Brand A|B-101');
  ok('6c another product with the same number does not join', !/Brand B/.test(j[0].what));
  ok('6d a number with older runs only raises nothing (Anomalies keeps it)', !b.twoMonthGroups().some(g => g.no === 'B-303'));
  ok('6e the button opens with the key', /openTwoMonth\(decodeURIComponent\('Brand%20A%7CB-101'\)\)/.test(j[0].act));
  b.openTwoMonth('Brand A|B-101');
  ok('6f the sheet lists both runs', (b.modal.innerHTML.match(/<tr><td>/g) || []).length === 2 && /Sep-2026/.test(b.modal.innerHTML) && /Oct-2026/.test(b.modal.innerHTML));
  vm.runInContext('tmForm.note="ok"', b); b.twoMonthConfirm();
  ok('6g a short note is refused', b.state.twoMonthNotes.length === 0 && /at least 5/.test(b.toasts.pop()));
  b.state.role = 'Production'; vm.runInContext('tmForm.note="checked with in-charge"', b); b.twoMonthConfirm();
  ok('6h only the Production Manager confirms', b.state.twoMonthNotes.length === 0);
  b.state.role = 'Production Manager'; b.twoMonthConfirm();
  eq('6i the note is saved', b.state.twoMonthNotes.length, 1);
  ok('6j the note carries who and the months', b.state.twoMonthNotes[0].by === 'Sajid' && b.state.twoMonthNotes[0].months === '2026-09,2026-10' && b.state.twoMonthNotes[0].key === 'Brand A|B-101');
  ok('6k logged and saved', b.logs.length === 1 && b.saved === 1);
  eq('6l the job is gone', b.twoMonthJobs().length, 0);
  b.state.packingLog.push(run({ id: 'r6', po: 'PO-5', date: '2026-11-01', bagMfg: '2026-11' }));
  eq('6m a 3rd month asks again', b.twoMonthJobs().length, 1);
  b.state.packingLog.pop();
  /* Tahir 16 Oct: older runs count with their printed month when the number also has a 16b run */
  b.state.packingLog.push(run({ id: 'r7', po: 'PO-6', date: '2026-07-01', mfgDate: '2026-06-30', brandBatchNo: 'B-202' }));
  const g2 = b.twoMonthGroups().filter(g => g.no === 'B-202')[0];
  ok('6p old run + 16b run of 1 number: raised, with the old bag month', !!g2 && g2.monthKey === '2026-06,2026-10');
  b.openTwoMonth('Brand A|B-202');
  ok('6q the sheet marks the older run', /packed before 16b/.test(b.modal.innerHTML) && /Jun-2026/.test(b.modal.innerHTML));
  b.state.packingLog.pop();
  /* a note for 3 months still covers 2 after a run is cancelled */
  b.state.packingLog.push(run({ id: 'r8', po: 'PO-5', date: '2026-11-01', bagMfg: '2026-11' }));
  b.state.twoMonthNotes.push({ id: 'TMx', key: 'Brand A|B-101', months: '2026-09,2026-10,2026-11', note: 'checked all 3' });
  eq('6r a note for the 3 months closes the job', b.twoMonthJobs().length, 0);
  b.state.packingLog.find(p => p.id === 'r8').reversed = true;
  eq('6s a run cancelled later: still covered, no new job', b.twoMonthJobs().length, 0);
  const c = box({ role: 'Production Manager', twoMonthNotes: [], packingLog: [run({ bagMfg: '2026-09' }), run({ bagMfg: '2026-10', reversed: true }), run({ bagMfg: '2026-10', void: true }), run({ bagMfg: '2026-10', kg: 0 })] });
  eq('6n a cancelled run leaves 1 month: no job', c.twoMonthJobs().length, 0);
  c.openTwoMonth('Brand A|B-101');
  ok('6o opening a gone job says so', /1 month only/.test(c.toasts.pop() || ''));
}

/* ---------- 7. Night shift may be dated tomorrow ---------- */
{ const s = ['evToday', 'evTomorrow', 'evDaysLate', 'evThreshold', 'evDateGate'].map(H.grab).join('\n');
  const b = { TODAY: new Date('2026-10-16T10:00:00Z'), state: { masters: {} }, EV_DEFAULT_THRESHOLD: {}, calDays: (a, c) => Math.round((Date.parse(c) - Date.parse(a)) / 864e5) };
  vm.createContext(b); vm.runInContext(s, b);
  eq('7a tomorrow', b.evTomorrow(), '2026-10-17');
  ok('7b Night dated tomorrow: allowed', b.evDateGate({ shift: 'Night', d: '2026-10-17' }, 'd', 'pack') === null);
  ok('7c Day dated tomorrow: refused', /future/.test(b.evDateGate({ shift: 'Day', d: '2026-10-17' }, 'd', 'pack') || ''));
  ok('7d Night dated 2 days ahead: refused', /tomorrow at most/.test(b.evDateGate({ shift: 'Night', d: '2026-10-18' }, 'd', 'pack') || ''));
  ok('7e no shift dated tomorrow: refused', /future/.test(b.evDateGate({ d: '2026-10-17' }, 'd', 'pack') || ''));
  ok('7f the date box allows tomorrow only where there is a shift', /\('shift' in form\)\)\?evTomorrow\(\):evToday\(\)/.test(fnSrc('evDateField')));
}

/* ---------- 8. the 5 packing paths ---------- */
{ const dp = fnSrc('doPack'), pq = fnSrc('submitProdQty');
  ok('8a Pack: refused until the printed month is picked', /if\(!packForm\.printedMfg\)\{toast\('Pick the Mfg month printed on the bags/.test(dp));
  ok('8b Pack: bag fields with the printed month', /packBagFields\([^)]*packForm\.printedMfg\)/.test(dp));
  ok('8c Pack on a run: refused until picked', /if\(!pqForm\.printedMfg\)/.test(pq));
  ok('8d Pack on a run: bag fields with the printed month', /packBagFields\([^)]*pqForm\.printedMfg\)/.test(pq));
  for (const [n, f] of [['Add missing packing', 'dfSubmitPacking'], ['Write the packing record', 'lineFixRecord'], ['QC-cleared diverted', 'submitDivert']]) {
    const s = fnSrc(f);
    ok('8e ' + n + ': the shelf life already chosen', /bagShelfFor\(/.test(s));
    ok('8f ' + n + ': the worked-out month, no printed pick', /packBagFields\([^,]+,[^,)]+\)/.test(s) && !/printedMfg/.test(s));
  }
  ok('8g the picker starts empty', /— pick the month —/.test(fnSrc('packDatesBlock')));
}

/* ---------- 9. the 3 old rules ---------- */
{ const calls = html.match(/syncPackBatchDates\(/g) || [];
  eq('9a levelling stopped: only the old function is left, nothing calls it', calls.length, 1);
  const bf = ['fyKey', 'lotBaseNo', 'lotBrandNo', 'bfxChecks'].map(H.grab).join('\n');
  const b = { state: { batches: [], packingLog: [{ id: 'x', brand: 'A', brandBatchNo: 'N1', date: '2026-10-02', mfgDate: '2026-10-01' }] } };
  try { vm.createContext(b); vm.runInContext(bf, b);
    const r = b.bfxChecks({ id: 'y', brand: 'A', date: '2026-10-05', mfgDate: '2026-09-01' }, 'N1');
    eq('9b a different date no longer refuses', r.block.length, 0);
    const r2 = b.bfxChecks({ id: 'y', brand: 'B', date: '2026-10-05' }, 'N1');
    eq('9c another brand on the number still refuses', r2.block.length, 1);
  } catch (e) { ok('9b bfxChecks runs', false, e.message); }
  ok('9d Anomalies: 16b runs are left out of the old fault', /if\(!p\|\|p\.reversed\) return; if\(p\.bagMfg\) return;/.test(html));
  ok('9e Anomalies: Packed in 2 months rows', /type:'Packed in 2 months'/.test(html) && /Waiting for the Production Manager to confirm/.test(html));
}

/* ---------- 10. QA sheets ---------- */
ok('10a the dates question names the bag months', /Mfg &amp; expiry on the bags match the expected months/.test(html));
ok('10b the inspector comes from the login on the sheets', (html.match(/f\.officer=inspectorName\(\)|officer=inspectorName\(\)/g) || []).length >= 1 && (html.match(/inspectorRow\(\)/g) || []).length >= 3);
ok('10c the 3 sheets check the inspector', (html.match(/inspectorGate\(/g) || []).length >= 4);
ok('10d the 3 sheets check the remark', (html.match(/bagRemarkGate\(/g) || []).length >= 4);
ok('10e lot QA asks the dates', /lotQAForm\.dates/.test(html));

/* ---------- 11. readers ---------- */
ok('11a the pre-shipment report and papers read bag months', /lotBagDates\(/.test(fnSrc('psiLinesFor')));
ok('11b batch trace reads bag months', /lotBagDates\(/.test(fnSrc('batchTrace')));
ok('11c the truck lines read bag months', /lotBagDates\(/.test(fnSrc('dcBatchLines')));

/* ---------- 12. Correct a record ---------- */
{ const i = html.indexOf('packingLot:'); const blk = html.slice(i, i + 20000);
  ok('12a bag month field', /k:'bagMfg'/.test(blk));
  ok('12b printed month field', /k:'printedMfg'/.test(blk));
  ok('12c a cleared run is locked: withdraw the inspection first', /Withdraw the inspection first/.test(blk));
  ok('12d expiry follows a corrected month', /tgt\.bagExp=bagAddMonths\(tgt\.bagMfg, bagShelfMonths\(tgt\.shelfMonths\)\)/.test(html));
}

/* ---------- 13. Today, Guide, changelog, build ---------- */
ok('13a Today lists the job', /twoMonthJobs\(\)/.test(html.replace(/function twoMonthJobs\(\)/, '')));
ok('13b job owner', /'Packed in 2 months':\s*'Production Manager'/.test(html));
ok('13c job title', /'Packed in 2 months': \{title:'A batch number packed in 2 months', verb:'Confirm it'\}/.test(html));
ok('13d the job key', /tmk/.test(fnSrc('acKey')));
ok('13e stage: Production', /Packed in 2 months/.test(fnSrc('acStageOf')));
ok('13f Guide rule', /The month on the bag/.test(fnSrc('guideRules')));
ok('13g rule number R-038', /'The month on the bag':'R-038'/.test(html));
ok('13h changelog 16b', /'2026-10-16b'/.test(H.grabTopVar('CHANGELOG', '[')));
ok('13i build 16b or later', /var BUILD_ID='2026-10-16[b-z]'/.test(html));
ok('13j My job note for 16b', /New on 16 Oct \(16b\)/.test(html));


/* ---------- 14. review fixes (16 Oct): Correct the month from Batch trace, papers, made-on, picker ---------- */
{ const SRCC = H.bagSrc() + '\n' + [H.grabObj('CORRECT_REASONS'), H.grabObj('CORRECT_ENTITY')].join('\n') + '\n'
    + ['correctTarget', 'openCorrect', 'renderCorrect', 'correctSetOp', 'applyCorrect', 'correctAllowed', 'correctFieldOK', 'correctAnyField', 'correctCanAmend', 'lotBaseNo', 'lotBrandNo', '_pe', 'bpEsc', 'btMonthMay', 'btMonthPicker'].map(H.grab).join('\n') + '\nvar correctForm=null; var BT_MONTH_FIELDS=[\'bagMfg\',\'printedMfg\'];';
  const mk = (role) => { const log = { toasts: [], reg: [], html: '' };
    const modal = { className: '', classList: { add() {}, remove() {} }, set innerHTML(v) { log.html = v; }, get innerHTML() { return log.html; } };
    const st = { role, currentUser: { name: 'Ali', username: 'ali' }, packingLog: [
      { id: 'PK1', brand: 'A', brandBatchNo: 'N1', kg: 100, po: 'P1', date: '2026-10-16', bagMfg: '2026-10', bagExp: '2028-10', shelfMonths: 24, printedMfg: '2026-10', insKg: 0, shipKg: 0 },
      { id: 'PK2', brand: 'A', brandBatchNo: 'N2', kg: 100, po: 'P1', date: '2026-10-16', bagMfg: '2026-10', bagExp: '2028-10', shelfMonths: 24, printedMfg: '2026-10', insKg: 100, shipKg: 0 },
      { id: 'PK3', brand: 'A', brandBatchNo: 'N3', kg: 100, po: 'P1', date: '2026-09-01', mfgDate: '2026-06-01' } ] };
    const b = { console, state: st, log, fmt: x => String(x), toast: m => log.toasts.push(m), save() {}, render() {}, closeModal() {}, logAction() {},
      _av: x => String(x), _tx: x => String(x), qsEsc: x => String(x), evToday: () => '2026-10-16', hardRole: r => r.indexOf(st.role) >= 0 || st.role === 'COO',
      recordCorrection: (...a) => log.reg.push(a), document: { getElementById: () => null }, $: id => id === 'modal' ? modal : { classList: { add() {}, remove() {} } } };
    b.globalThis = b; vm.createContext(b); vm.runInContext(SRCC, b); return b; };
  let b = mk('Production');
  const G = { lots: [{ id: 'PK1' }, { id: 'PK3' }] };
  const pk = b.btMonthPicker(G);
  ok('14a Batch trace: 1 picker under the table, Correct the month', /Correct the month/.test(pk) && (pk.match(/<button/g) || []).length === 1 && /BT_MONTH_FIELDS/.test(pk));
  ok('14b the picker lists 16b runs only', /PK1/.test(pk) && !/PK3/.test(pk));
  b.openCorrect('packingLot', 'PK1', ['bagMfg', 'printedMfg']);
  ok('14c the sheet shows the 2 month fields only', /Mfg month on the bag/.test(b.log.html) && /Mfg month printed on the bags/.test(b.log.html) && !/Batch # printed|Price printed on the pack/.test(b.log.html));
  ok('14d no Reverse and no Supersede offered', !/Reverse it/.test(b.log.html) && !/Supersede/.test(b.log.html));
  b.correctSetOp('REVERSE'); eq('14e cannot switch to Reverse', b.correctForm.op, 'AMEND');
  vm.runInContext("correctForm.vals.printedMfg='2026-09'; correctForm.vals.printedPrice=99; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='bags read Sep at the store check';", b);
  b.applyCorrect();
  const p1 = b.state.packingLog[0];
  ok('14f the month is corrected, a field outside the list is not', p1.printedMfg === '2026-09' && p1.printedPrice === undefined);
  ok('14g the flag follows, and the register says so', p1.bagMonthDiff === true && b.log.reg.length === 1 && b.log.reg[0][4].some(c => c.field === 'bagMonthDiff' && c.after === 'yes'));
  b.openCorrect('packingLot', 'PK1', ['bagMfg', 'printedMfg']);
  vm.runInContext("correctForm.vals.bagMfg='2026-09'; correctForm.reasonCode=CORRECT_REASONS[0].k; correctForm.reason='packed on 30 Sep, Night shift';", b); b.applyCorrect();
  ok('14h a corrected bag month carries its expiry; the flag goes', p1.bagMfg === '2026-09' && p1.bagExp === '2028-09' && !p1.bagMonthDiff);
  b.openCorrect('packingLot', 'PK2', ['bagMfg', 'printedMfg']);
  ok('14i a cleared run is locked: withdraw the inspection first', /Withdraw the inspection first/.test(b.log.html));
  ok('14t the lock on a run on a truck says so truthfully', /on a truck \(planned, loading or gone\)/.test(html));
  b = mk('QA Inspector'); b.openCorrect('packingLot', 'PK1', ['bagMfg', 'printedMfg']);
  ok('14j QA cannot correct the month', !b.correctForm && b.log.toasts.length === 1);
  eq('14k no picker for QA', b.btMonthPicker(G), '');
  b = mk('Plant Manager'); b.openCorrect('packingLot', 'PK1', ['bagMfg', 'printedMfg']);
  ok('14u the Plant Manager gets no empty sheet and no picker', !b.correctForm && b.btMonthPicker(G) === '');
}
{ /* the pre-shipment report: 1 line per batch number AND bag month; older runs print as before */
  const s = ['psiLinesFor', 'lotBaseNo', 'lotBrandNo'].map(H.grab).join('\n') + '\n' + H.bagSrc();
  const b = { state: { packingLog: [
      { id: 'n2', po: 'P', brand: 'A', brandBatchNo: 'B1', bagMfg: '2026-10', bagExp: '2028-10' },
      { id: 'n1', po: 'P', brand: 'A', brandBatchNo: 'B1', bagMfg: '2026-09', bagExp: '2028-09' },
      { id: 'o2', po: 'P', brand: 'A', brandBatchNo: 'C1', mfgDate: '2026-06-01', expDate: '2028-06-01' },
      { id: 'o1', po: 'P', brand: 'A', brandBatchNo: 'C1', mfgDate: '2026-05-01', expDate: '2028-05-01' } ] }, linePackSize: () => 25 };
  vm.createContext(b); vm.runInContext(s, b);
  const out = b.psiLinesFor({ po: 'P', rows: [{ po: 'P', brand: 'A', batches: [{ lotId: 'n1', brand: 'B1', batch: 'X', kg: 400 }, { lotId: 'n2', brand: 'B1', batch: 'X', kg: 600 }, { lotId: 'o1', brand: 'C1', batch: 'Y', kg: 100 }] }] });
  ok('14l a number packed in 2 months prints 2 lines, each with its own month', out.length === 3 && out[0].mfg === 'Sep-2026' && out[0].kg === 400 && out[1].mfg === 'Oct-2026' && out[1].kg === 600);
  ok('14m an older run prints what it printed before (the first run of that number)', !!out[2] && out[2].mfg === '2026-06-01' && out[2].packNo === 'C1');
}
function b0print(){ const b = box({ packingLog: [] }); const pr = b.bagDatesPrint([{ mfgDate: '2026-06-01', expDate: '2028-06-01' }, { bagMfg: '2026-10', bagExp: '2028-10' }]); return /2026-06-01/.test(pr) && /Oct-2026/.test(pr); }
{ /* the inspection paper: the months only, no screen instructions */
  const t = fnSrc('printInspect');
  ok('14n the paper prints bagDatesPrint, never bagRunLines', /bagDatesPrint\(runs\)/.test(t) && !/ex\.dates/.test(t));
  ok('14v a record with an older run and a 16b run prints both', /if\(!runs\.some\(function\(p\)\{ return p\.bagMfg; \}\)\) runs=\[\];/.test(t) && b0print());
  const b = box({ packingLog: [] });
  const pr = b.bagDatesPrint([{ bagMfg: '2026-10', bagExp: '2028-10', bagMonthDiff: true, printedMfg: '2026-09' }, { bagMfg: '2026-10', bagExp: '2028-10' }]);
  ok('14o 1 line per month pair, no instruction text', pr === 'expected Mfg <b>Oct-2026</b> · Exp <b>Oct-2028</b>' && !/Look closely|Made on/.test(pr));
  ok('14p an older inspection prints exactly as before', /expected mfg <b>'\+\(lot\.mfgDate\|\|'—'\)\+'<\/b> · exp <b>'\+\(lot\.expDate/.test(t));
}
{ const b = box({ packingLog: [], batches: [{ id: 'POOL1', pool: true, status: 'open' }] });
  eq('14q a divert pool shows no made-on', b.lotMadeOn({ baseBatchId: 'POOL1' }), '');
  ok('14r a month picked before the date moved stays in the list', /if\(pick&&mos\.indexOf\(pick\)<0\)/.test(fnSrc('packDatesBlock')));
  ok('14s System documentation version moves with the build', /SYSDOC_VER='2026-10-16[b-z]'/.test(html));
}
/* ---------- 15. + Log a shift: always the list (Tahir 16 Oct, after Abdul Majid) ---------- */
{ const s = ['shiftPickRows', 'tdLogShift', 'batchLogRoom', 'batchReopenHeadroom', 'batchCeilingKg', 'batchOverPct', '_pe'].map(H.grab).join('\n');
  const log = { html: '', toasts: [] };
  const b = { state: { orders: [], batches: [
      { id: 'b1', batchNo: 'HG1', base: 'PH', status: 'open', plannedKg: 25000, producedKg: 22000, openedDate: '2026-10-10' },
      { id: 'b2', batchNo: 'HG2', base: 'PH', status: 'open', plannedKg: 25000, producedKg: 25000, openedDate: '2026-10-12' },
      { id: 'b3', batchNo: 'HG3', base: 'PH', status: 'open', plannedKg: 1000, producedKg: 1150, openedDate: '2026-10-12' },
      { id: 'b4', batchNo: 'HG4', base: 'PH', status: 'closed', plannedKg: 1000, producedKg: 500 },
      { id: 'b5', batchNo: 'POOL', pool: true, status: 'open', plannedKg: 1000, producedKg: 0 } ] },
    fmt: x => String(x), batchPOsLabel: () => '', toast: m => log.toasts.push(m),
    $: id => id === 'modal' ? { set innerHTML(v) { log.html = v; } } : { classList: { add() {} } } };
  vm.createContext(b); vm.runInContext(s, b);
  const rows = b.shiftPickRows().map(r => r.b.batchNo);
  ok('15a every open batch that can take output, short of plan first', rows.join(',') === 'HG1,HG2');
  b.tdLogShift();
  ok('15b the list shows even with 1 batch short of plan', /Pick the batch this shift made/.test(log.html) && (log.html.match(/Log shift<\/button>/g) || []).length === 2);
  ok('15c it says what is left', /3000<\/b> still to make/.test(log.html) && /plan made · 3750 room left/.test(log.html));
  b.state.batches = []; b.tdLogShift(); ok('15d none open: says so', /Open a batch first/.test(log.toasts.pop() || ''));
}
console.log('\n16b month on the bag + inspector: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
