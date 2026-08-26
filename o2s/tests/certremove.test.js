/* AP26012-L2, 26 August 2026 (afternoon) — the certified duplicate.

   The morning's build put a Remove control on each lot and, on the COO's
   decision, made it refuse any lot the lab has touched. Then the lab certified
   the duplicate lot by mistake. The refusal was right; the way back was not
   there:

     - the only correction a signed certificate takes is SUPERSEDE (SPEC-03);
     - the ONLY button that starts one lives on the certificate sheet
       (renderCOAModal);
     - and no screen ever opened that sheet for an APPROVED certificate. Lab QC
       offered Print COA and nothing else. Every earlier version did the same —
       the baselines in this folder are rendered below to prove it.

   So the COO stood in front of a refusal with no route out, and 2,020 Kg read
   as packable on a batch that made 1,010.

   Three changes, all checked here by RENDERING and CLICKING through the
   interface, not by calling functions (the first check of this fault called
   openCorrect() directly, passed, and was wrong about the screen):
     1. Lab QC → Approved offers Open beside Print COA. The sheet is read-only;
        Supersede inside it is still QCM / COO (correctAllowed).
     2. The Remove refusals name the way back: Supersede for a certified lot,
        Reject for one in the chain.
     3. The register line for a removed lot names a superseded certificate —
        number, revision, approver, date, who superseded it — because the
        printable copy leaves with the lot (COO's decision, 26 Aug).

   Run: node certremove.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;
const BLOCKS = [...H.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

/* the batch as the COO saw it after the lab's mistake: BOTH lots certified */
const AP = () => ({
  id: 'B-AP26012', batchNo: 'AP26012', base: 'V-Ammonium Phosphate',
  brand: 'V-Ammonium Phosphate', kind: 'bulk', status: 'open', openedDate: '2026-08-20',
  plannedKg: 2710, producedKg: 2020, packedKg: 0, disposedKg: 0,
  lots: [
    { id: 'LOT-A', lotNo: 'AP26012-L1', qty: 1010, date: '2026-08-21', shift: 'Morning',
      incharge: 'Muhammad Imran',
      coa: { status: 'approved', certifiedKg: 1010, qcNo: 'Q-1', rev: 0, tests: [],
             approver: { name: 'QCM One', date: '2026-08-25' }, approvedDate: '2026-08-25' } },
    { id: 'LOT-B', lotNo: 'AP26012-L2', qty: 1010, date: '2026-08-21', shift: 'Morning',
      incharge: 'Muhammad Imran',
      coa: { status: 'approved', certifiedKg: 1010, qcNo: 'Q-2', rev: 0, tests: [],
             approver: { name: 'QCM One', date: '2026-08-26' }, approvedDate: '2026-08-26' } },
  ],
});

/* ---- a sandbox whose elements PERSIST by id, so what render() wrote can be read ---- */
function app(role, file) {
  const html = file ? fs.readFileSync(path.join(__dirname, '..', file), 'utf8') : H.html;
  const blocks = file ? [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]) : BLOCKS;
  const els = {};
  const el = (id) => {
    if (id && els[id]) return els[id];
    const o = { id: id || '', innerHTML: '', textContent: '', value: '', style: {}, _cls: {},
      classList: { add(k) { o._cls[k] = 1; }, remove(k) { delete o._cls[k]; }, contains(k) { return !!o._cls[k]; }, toggle() {} },
      addEventListener() {}, appendChild() {}, querySelector() { return el(); },
      querySelectorAll() { return []; }, focus() {}, click() {}, getAttribute() { return null; },
      setAttribute() {}, remove() {}, dataset: {}, children: [], parentNode: null, scrollIntoView() {},
      insertAdjacentHTML(p, h) { o.innerHTML += h; } };
    if (id) els[id] = o;
    return o;
  };
  const doc = { getElementById(id) { return el(id); }, querySelector() { return el(); },
    querySelectorAll() { return []; }, createElement() { return el(); },
    body: el('body'), documentElement: el('html'), head: el('head'), addEventListener() {} };
  const c = { console, JSON, Math, Date, String, Number, Array, Object, Boolean, RegExp, Error,
    isNaN, parseInt, parseFloat, Promise, Intl, URL, encodeURIComponent, decodeURIComponent,
    document: doc, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch() { return Promise.resolve({ json: () => ({}) }); },
    alert() {}, confirm() { return true; }, prompt() { return 'x'; },
    location: { href: '', search: '', reload() {} }, navigator: { userAgent: 'node' },
    history: { pushState() {} }, requestAnimationFrame() {}, performance: { now() { return 0; } },
    Blob: function () {}, btoa: s => s, atob: s => s };
  c.window = c; c.globalThis = c; c.self = c;
  vm.createContext(c);
  blocks.forEach(b => vm.runInContext(b, c));
  c.__st = JSON.parse(JSON.stringify(STATE));
  c.__b = AP();
  vm.runInContext('state = __st; state.role = ' + JSON.stringify(role) + ';'
    + ' state.currentUser = { name: "Tahir Abbas", username: "tahir" };'
    + ' state.batches = state.batches || []; state.batches.push(__b);'
    + ' toasts = []; toast = function(m){ toasts.push(String(m)); }; save = function(){};', c);
  c.__els = els;
  return c;
}
const run = (c, src) => vm.runInContext(src, c);
const B = c => run(c, 'state.batches[state.batches.length-1]');
const lot = (c, id) => B(c).lots.find(l => l.id === id);
const clear = c => Object.values(c.__els).forEach(e => { e.innerHTML = ''; });
const page = c => Object.values(c.__els).map(e => e.innerHTML).join('\n');
/* "click": find the first onclick whose code matches, run exactly that code */
function click(c, html, re) {
  const m = [...html.matchAll(/onclick="([^"]*)"/g)].map(x => x[1]).find(code => re.test(code));
  if (!m) return null;
  run(c, m.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
  return m;
}
const qcApproved = (c) => { clear(c); run(c, 'state.screen = "qc"; qcTab = "approved"; render();'); return page(c); };
/* the passport is reached the way a person reaches it: the batch row in the
   list (prodBatchSel + prodDrill), then the Lots tab */
const lotsTab = (c) => { clear(c); run(c, 'state.screen = "prod"; prodView = "lifecycle"; prodFilter = "all"; prodDrill = false; prodBatchSel = ""; render();');
  const list = page(c);
  const row = click(c, list, /^prodBatchSel='B-AP26012';prodDrill=true;render\(\)$/);
  if (!row) return list;   /* no row to click — the caller's checks say what that means */
  clear(c); run(c, 'prodBatchTab = "lots"; render();'); return page(c); };
const strip = s => String(s).replace(/<[^>]*>/g, '|').replace(/\s+/g, ' ').slice(0, 300);

/* ================= 1. the fault, measured on every baseline ================= */
{
  const BASELINES = fs.readdirSync(__dirname).filter(f => /^_before-.*\.html$/.test(f)).sort().map(f => 'tests/' + f);
  ok('there are baseline files to render', BASELINES.length >= 2, BASELINES.join(', '));
  BASELINES.forEach(f => {
    const c = app('COO', f);
    const qc = qcApproved(c);
    ok(f + ': Lab QC → Approved listed the certified lot', /AP26012-L2/.test(qc));
    ok(f + ': ...offered Print COA', /printCOA\('B-AP26012','LOT-B'/.test(qc));
    ok(f + ': ...and NO way to open the certificate sheet', !/openBatchCOA\('B-AP26012','LOT-B'\)/.test(qc));
    ok(f + ': ...and no Supersede anywhere on the page', !/openCorrect\('coa'/.test(qc));
    /* every other screen too, as the COO */
    const screens = run(c, 'SCREENS.map(function(s){return s.id;})');
    let anywhere = false;
    screens.forEach(id => { try { clear(c); run(c, 'state.screen = ' + JSON.stringify(id) + '; render();'); if (/openBatchCOA\('B-AP26012','LOT-B'\)|openCorrect\('coa'/.test(page(c))) anywhere = true; } catch (e) {} });
    ok(f + ': ...nor on any other screen the COO can open', !anywhere);
  });
  /* and the reason it mattered: the sheet is where Supersede lives, and only there */
  const sites = (H.html.match(/openCorrect\('coa'/g) || []).length;
  eq('the Supersede button for a certificate is offered in exactly one place', sites, 1);
  ok('...and that place is the certificate sheet', /openCorrect\('coa'/.test(H.grab('renderCOAModal')));
}

/* ================= 2. the danger while it stood ================= */
{
  const c = app('COO');
  eq('with the duplicate certified, the app believed 2,020 Kg was cleared', c.batchClearedKg(B(c)), 2020);
  eq('...and packable — on a batch that made 1,010', c.batchPackableKg(B(c)), 2020);
  ok('and Remove was (rightly) refused on the certified duplicate',
     /certified/.test(c.lotRemoveBlockedBy(B(c), lot(c, 'LOT-B')) || ''));
  ok('...with no Remove control drawn for it', !/openRemoveLot\('B-AP26012','LOT-B'\)/.test(lotsTab(c)));
}

/* ================= 3. the refusal now names the way back ================= */
{
  const c = app('COO');
  const withStatus = (st) => { const b = AP(); b.lots[1].coa = st ? { status: st, qcNo: 'Q-2' } : null; return b; };
  const msgA = c.lotRemoveBlockedBy(B(c), lot(c, 'LOT-B')) || '';
  ok('certified: still says certified material exists', /certified material exists/.test(msgA), msgA);
  ok('certified: still says dispose of it if it has gone', /dispose of it/.test(msgA), msgA);
  ok('certified: NOW names Supersede', /supersede/i.test(msgA), msgA);
  ok('certified: ...and where to find it', /Lab QC/.test(msgA) && /Approved/.test(msgA) && /Open/.test(msgA), msgA);
  ok('certified: ...and who — QCM or COO', /QCM or COO/.test(msgA), msgA);
  ['analysed', 'reviewed'].forEach(st => {
    const m = c.lotRemoveBlockedBy(withStatus(st), withStatus(st).lots[1]) || '';
    ok(st + ': still "in hand"', /in hand/.test(m), m);
    ok(st + ': says Reject, the button\'s real name', /Reject/.test(m), m);
    ok(st + ': no longer says "withdraw", which is not a button', !/withdraw/.test(m), m);
    ok(st + ': names the AQCM / QCM', /AQCM \/ QCM/.test(m), m);
  });
  ok('UNFIT message unchanged — a decision, not a deletion',
     /UNFIT/.test(c.lotRemoveBlockedBy(withStatus('failed'), withStatus('failed').lots[1]) || '')
     && /deviation/.test(c.lotRemoveBlockedBy(withStatus('failed'), withStatus('failed').lots[1]) || ''));
  eq('draft: still allowed', c.lotRemoveBlockedBy(withStatus('draft'), withStatus('draft').lots[1]), null);
  eq('no certificate: still allowed', c.lotRemoveBlockedBy(withStatus(null), withStatus(null).lots[1]), null);
  ok('the rights-catalogue note carries the same exception',
     /supersedes it first/.test(H.grabTopVar('RIGHTS', '[')));
}

/* ================= 4. Open appears, and only opens ================= */
{
  ['COO', 'QCM', 'AQCM', 'Lab Rep', 'Plant Manager'].forEach(role => {
    const c = app(role);
    ok(role + ' can view Lab QC', run(c, 'canView(state.role,"qc")') === true);
    const qc = qcApproved(c);
    ok(role + ': Approved tab lists L2', /AP26012-L2/.test(qc));
    ok(role + ': Open is offered on the certified lot', /openBatchCOA\('B-AP26012','LOT-B'\)/.test(qc), strip(qc.slice(qc.indexOf('AP26012-L2'), qc.indexOf('AP26012-L2') + 600)));
    ok(role + ': Print COA is still there', /printCOA\('B-AP26012','LOT-B'/.test(qc));
    /* opening must not write anything — the sheet is read-only once approved */
    const before = JSON.stringify(B(c));
    const code = click(c, qc, /openBatchCOA\('B-AP26012','LOT-B'\)/);
    ok(role + ': the click ran', !!code, code);
    eq(role + ': opening changed nothing on the batch', JSON.stringify(B(c)), before);
    const sheet = c.__els.coaFS ? c.__els.coaFS.innerHTML : '';
    ok(role + ': the sheet drew', sheet.length > 1000, String(sheet.length));
    ok(role + ': ...read-only (every field disabled)',
       /<input class="ufld" disabled/.test(sheet) && !/<input class="ufld"  value=/.test(sheet));
    ok(role + ': ...marked APPROVED', /APPROVED/.test(sheet));
    ok(role + ': ...offers Print', /printCOA\('B-AP26012','LOT-B'\)/.test(sheet));
    const canSup = run(c, 'correctAllowed("coa","SUPERSEDE")');
    eq(role + ': Supersede offered only to QCM / COO', /openCorrect\('coa','B-AP26012\|LOT-B'\)/.test(sheet), canSup);
    eq(role + ': ...which is ' + (role === 'COO' || role === 'QCM'), canSup, role === 'COO' || role === 'QCM');
  });
  /* a role that cannot see Lab QC never reaches it */
  const c = app('KAM');
  ok('a KAM cannot view Lab QC at all', run(c, 'canView(state.role,"qc")') === false);
}

/* ================= 5. the whole route, clicked, as the COO ================= */
{
  const c = app('COO');
  /* Lab QC → Approved → Open */
  const qc = qcApproved(c);
  click(c, qc, /openBatchCOA\('B-AP26012','LOT-B'\)/);
  const sheet = c.__els.coaFS.innerHTML;
  /* → Supersede — re-issue */
  const sup = click(c, sheet, /openCorrect\('coa','B-AP26012\|LOT-B'\)/);
  ok('Supersede — re-issue opens the correction dialogue', !!sup, sup);
  ok('...and closes the sheet underneath (the 21 Aug z-index lesson)', !c.__els.coaFS.classList.contains('open'));
  const modal = c.__els.modal.innerHTML;
  ok('the dialogue is on SUPERSEDE', /Supersede — issue a revision/.test(modal), strip(modal));
  ok('...names the certificate', /COA Q-2/.test(modal) && /AP26012-L2/.test(modal), strip(modal));
  ok('...says Rev 0 stays on file and still prints', /Rev 0 is stamped SUPERSEDED/.test(modal));
  ok('...and that 1,010 Kg cannot be packed until Rev 1 is approved', /1,010 Kg is not yet packed and CANNOT be packed/.test(modal));
  ok('...and does not offer Amend or Reverse for a certificate', !/correctSetOp\('AMEND'\)/.test(modal) && !/correctSetOp\('REVERSE'\)/.test(modal));
  /* reason, then apply */
  run(c, 'correctForm.reasonCode = "duplicate"; correctForm.reason = "Certificate issued against AP26012-L2, a duplicate of L1 — the lot was never made.";');
  ok('Apply is the button on the dialogue', !!click(c, modal, /^applyCorrect\(\)$/));
  eq('the certificate on L2 is now a DRAFT (Rev 1)', lot(c, 'LOT-B').coa.status, 'draft');
  eq('...Rev 1', +lot(c, 'LOT-B').coa.rev, 1);
  eq('...Rev 0 is on file as superseded', lot(c, 'LOT-B').coaHistory[0].status, 'superseded');
  eq('...and certifiedKg is cleared, so nothing on L2 is packable', lot(c, 'LOT-B').certifiedKg, null);
  eq('packable drops to the real 1,010 at once', c.batchPackableKg(B(c)), 1010);
  eq('produced is still 2,020 — supersede alone does not un-make anything', B(c).producedKg, 2020);
  eq('L1 untouched', lot(c, 'LOT-A').coa.status, 'approved');
  const reg1 = run(c, 'state.corrections[0]');
  eq('register: SUPERSEDE entry', reg1.op, 'SUPERSEDE');
  ok('...names Rev 0 → Rev 1', /Rev 0/.test(reg1.entityLabel) && /Rev 1/.test(reg1.changes[0].after), JSON.stringify(reg1.changes));

  /* Production → batch passport → Lots → Remove on L2 */
  const lots = lotsTab(c);
  ok('Lots tab now draws Remove on L2', /openRemoveLot\('B-AP26012','LOT-B'\)/.test(lots), strip(lots.slice(lots.indexOf('AP26012-L2') - 100, lots.indexOf('AP26012-L2') + 700)));
  ok('...and still NOT on L1, which is certified', !/openRemoveLot\('B-AP26012','LOT-A'\)/.test(lots));
  ok('...L2 reads Draft — not Pending (it carries a certificate) and not In review (nobody is reviewing it)',
     /AP26012-L2[\s\S]{0,400}?respill[^>]*>Draft</.test(lots), strip(lots.slice(lots.indexOf('AP26012-L2'), lots.indexOf('AP26012-L2') + 500)));
  const rm = click(c, lots, /openRemoveLot\('B-AP26012','LOT-B'\)/);
  ok('Remove opens', !!rm && c.__els.modalBg.classList.contains('open'));
  const rmModal = c.__els.modal.innerHTML;
  ok('the dialogue says produced goes 2,020 → 1,010', /2,020/.test(rmModal) && /1,010/.test(rmModal), strip(rmModal));
  run(c, 'rmLotForm.reasonCode = "duplicate"; rmLotForm.reason = "The same shift was logged twice; only one lot of 1,010 was made.";');
  ok('Remove this output is the button', !!click(c, rmModal, /^doRemoveLot\(\)$/));
  eq('one lot left', B(c).lots.length, 1);
  eq('...it is L1', B(c).lots[0].id, 'LOT-A');
  eq('produced 1,010', B(c).producedKg, 1010);
  eq('cleared 1,010', c.batchClearedKg(B(c)), 1010);
  eq('packable 1,010', c.batchPackableKg(B(c)), 1010);
  ok('the batch offers Pack 1,010 Kg cleared', /Pack 1,010 Kg cleared/.test(run(c, '_pcLifeAction')(B(c), run(c, 'window.ProductionCenter').derive(B(c)))));
  const last = run(c, 'toasts[toasts.length-1]');
  ok('the toast reports the cascade', /2,020 → 1,010/.test(last) && /Ready to pack is now 1,010/.test(last), last);

  /* the register line — the printable copy has gone with the lot, so this must say what it was */
  const reg2 = run(c, 'state.corrections[0]');
  eq('register: Removed shift output entry', reg2.op, 'Removed shift output');
  const coaLine = reg2.changes.find(x => x.field === 'coa');
  ok('...has the certificate line', !!coaLine);
  ok('...current state: draft, Q-2, Rev 1', /^draft · Q-2 · Rev 1/.test(coaLine.before), coaLine.before);
  ok('...names Rev 0 and its number', /Rev 0 Q-2/.test(coaLine.before), coaLine.before);
  ok('...who approved it and when', /approved by QCM One on 2026-08-26/.test(coaLine.before), coaLine.before);
  ok('...who superseded it', /superseded on \d{4}-\d{2}-\d{2} by Tahir Abbas/.test(coaLine.before), coaLine.before);
  ok('...and why', /duplicate of L1/.test(coaLine.before), coaLine.before);
  eq('...after: removed with the lot', coaLine.after, 'removed with the lot');
  ok('...cascade says Rev 0 is no longer printable and points at the SUPERSEDE entry',
     reg2.cascade.some(x => /Certificate Q-2 Rev 0 \(superseded\) is no longer printable/.test(x) && /SUPERSEDE entry/.test(x)), JSON.stringify(reg2.cascade));
  eq('two register entries, in order: remove above supersede', run(c, 'state.corrections[1].op'), 'SUPERSEDE');
  ok('both carry the COO\'s name', reg1.by === 'Tahir Abbas' && reg2.by === 'Tahir Abbas');
}

/* ================= 6. the same route with two people, as it will really run ================= */
{
  const c = app('QCM');
  const qc = qcApproved(c);
  click(c, qc, /openBatchCOA\('B-AP26012','LOT-B'\)/);
  ok('QCM: the sheet offers Supersede', !!click(c, c.__els.coaFS.innerHTML, /openCorrect\('coa','B-AP26012\|LOT-B'\)/));
  run(c, 'correctForm.reasonCode = "duplicate"; correctForm.reason = "Certificate issued against a lot that was never made.";');
  click(c, c.__els.modal.innerHTML, /^applyCorrect\(\)$/);
  eq('QCM superseded it', lot(c, 'LOT-B').coa.status, 'draft');
  /* the QCM cannot remove the lot — that is the Plant Manager's right */
  ok('QCM holds no removal right', run(c, 'may("production.void")') === false);
  ok('...and nothing the QCM can open draws a Remove', !/openRemoveLot\(/.test(lotsTab(c)));
  /* hand over to the Plant Manager */
  run(c, 'state.role = "Plant Manager"; state.currentUser = { name: "PM One", username: "pm" };');
  const lots = lotsTab(c);
  ok('Plant Manager: Remove on L2 is drawn', /openRemoveLot\('B-AP26012','LOT-B'\)/.test(lots));
  click(c, lots, /openRemoveLot\('B-AP26012','LOT-B'\)/);
  run(c, 'rmLotForm.reasonCode = "duplicate"; rmLotForm.reason = "The same shift was logged twice; one lot was made.";');
  click(c, c.__els.modal.innerHTML, /^doRemoveLot\(\)$/);
  eq('Plant Manager removed it', B(c).lots.length, 1);
  eq('produced 1,010', B(c).producedKg, 1010);
  const reg = run(c, 'state.corrections.map(function(x){return x.op+":"+x.by;})');
  eq('the register shows two people, two acts', reg.slice(0, 2).join(' | '), 'Removed shift output:PM One | SUPERSEDE:Tahir Abbas');
}

/* ================= 7. what has NOT changed ================= */
{
  /* a floor role cannot start a supersede from anywhere, sheet included */
  const c = app('Lab Rep');
  const qc = qcApproved(c);
  click(c, qc, /openBatchCOA\('B-AP26012','LOT-B'\)/);
  ok('Lab Rep: the sheet has no Supersede', !/openCorrect\('coa'/.test(c.__els.coaFS.innerHTML));
  run(c, 'openCorrect("coa","B-AP26012|LOT-B")');
  ok('...and calling it anyway is refused', /do not have authority/.test(run(c, 'toasts[toasts.length-1]') || ''), run(c, 'toasts[toasts.length-1]'));
  eq('...nothing changed', lot(c, 'LOT-B').coa.status, 'approved');

  /* an unapproved certificate cannot be superseded — the route is Reject */
  const c2 = app('COO');
  run(c2, 'state.batches[state.batches.length-1].lots[1].coa.status = "reviewed";');
  run(c2, 'openCorrect("coa","B-AP26012|LOT-B"); correctForm.op = "SUPERSEDE";');
  const m2 = run(c2, 'renderCorrect(); document.getElementById("modal").innerHTML');
  ok('a reviewed certificate: the dialogue says reject it back instead', /reject it back to the analyst/.test(m2), strip(m2));
  ok('...and offers no action button', !/applyCorrect\(\)/.test(m2));

  /* removing a lot that never had a certificate: the register line reads as before */
  const c3 = app('COO');
  run(c3, 'state.batches[state.batches.length-1].lots[1].coa = null; state.batches[state.batches.length-1].lots[1].coaHistory = undefined;');
  run(c3, 'state.screen = "prod"; openRemoveLot("B-AP26012","LOT-B"); rmLotForm.reasonCode = "duplicate"; rmLotForm.reason = "Logged twice by mistake on the floor."; doRemoveLot();');
  eq('no certificate: register says none', run(c3, 'state.corrections[0].changes.find(function(x){return x.field==="coa";}).before'), 'none');
  ok('...and no printable-copy cascade line', !run(c3, 'state.corrections[0].cascade.some(function(x){return /printable/.test(x);})'));
  const c4 = app('COO');
  run(c4, 'state.batches[state.batches.length-1].lots[1].coa = { status: "draft", qcNo: "Q-9" };');
  run(c4, 'state.screen = "prod"; openRemoveLot("B-AP26012","LOT-B"); rmLotForm.reasonCode = "duplicate"; rmLotForm.reason = "Logged twice by mistake on the floor."; doRemoveLot();');
  eq('a plain draft: register reads "draft · Q-9" as before', run(c4, 'state.corrections[0].changes.find(function(x){return x.field==="coa";}).before'), 'draft · Q-9');

  /* the guards the morning's review pinned are still where they were */
  ok('openRemoveLot still asks may(production.void)', /may\('production\.void'\)/.test(H.grab('openRemoveLot')));
  ok('doRemoveLot still asks may(production.void)', /may\('production\.void'\)/.test(H.grab('doRemoveLot')));
  ok('doRemoveLot still re-asks lotRemoveBlockedBy before touching b.lots',
     H.grab('doRemoveLot').indexOf('lotRemoveBlockedBy') < H.grab('doRemoveLot').indexOf('b.lots='));
  ok('the COA entity still takes no AMEND and no REVERSE', /coa:\{[\s\S]*?amend:\[\], reverse:\[\], supersede:\['QCM','COO'\]/.test(H.html));
  ok('batchStage untouched', /if\(b\.status==='open' && prod<plan-0\.5\) return 'producing';/.test(H.grab('batchStage')));
}

/* ================= 8. the reason is WRITTEN WHERE THE PERSON STANDS ================= */
/* The first version of this change put the way back into the refusal message and
   nowhere else — and the Lots tab draws no Remove on a refused lot, so the message
   could only ever reach a toast in the modal-open race. Four independent reviewers
   found the same thing: the COO's screen was unchanged. Rendered here, per role. */
{
  const seen = {};
  ['COO', 'Plant Manager', 'Production', 'QCM', 'Lab Rep'].forEach(role => {
    const c = app(role);
    const lots = lotsTab(c);
    const mayRm = run(c, 'may("production.void")');
    seen[role] = mayRm;
    const l2 = lots.slice(lots.indexOf('AP26012-L2'), lots.indexOf('AP26012-L2') + 1200);
    if (mayRm) {
      ok(role + ': a greyed Remove is drawn on the certified L2', /<button class="sm ghost" disabled title="[^"]*certified[^"]*"[^>]*>Remove<\/button>/.test(l2), strip(l2));
      ok(role + ': ...its tooltip carries the whole reason', /title="[^"]*Lab QC → Approved → Open → Supersede[^"]*"/.test(l2), strip(l2));
      /* a certified lot is the normal state, so the visible line is short and muted — not the 400-character refusal, not amber */
      const vis = l2.replace(/title="[^"]*"/g, '');
      ok(role + ': ...and a SHORT line is written under the lot, visibly', /Certified — cannot be un-logged\./.test(vis), strip(vis));
      ok(role + ': ...naming the route', /Lab QC → Approved → Open → Supersede/.test(vis), strip(vis));
      ok(role + ': ...and who — QCM or COO', /QCM or COO/.test(vis));
      ok(role + ': ...not the full refusal, not in amber', !/Cannot be removed:/.test(vis.slice(0, vis.indexOf('</div></div>') + 1)) && !/color:var\(--amber[^>]*>Certified/.test(vis), strip(vis));
      ok(role + ': no live Remove on L2', !/onclick="openRemoveLot\('B-AP26012','LOT-B'\)"/.test(l2));
    } else {
      ok(role + ': holds no removal right, so no Remove control, live or greyed', !/>Remove<\/button>/.test(lots) && !/Cannot be removed/.test(lots), strip(lots.slice(lots.indexOf('AP26012-L1'), lots.indexOf('AP26012-L1') + 800)));
    }
  });
  ok('the right sits with Plant Manager and COO', seen['COO'] === true && seen['Plant Manager'] === true);
  ok('...and not the floor, the QCM or the lab', seen['Production'] === false && seen['QCM'] === false && seen['Lab Rep'] === false);
  /* a lot in the chain: the note names Reject */
  const c = app('COO');
  run(c, 'state.batches[state.batches.length-1].lots[1].coa.status = "reviewed";');
  const lots = lotsTab(c);
  const l2 = lots.slice(lots.indexOf('AP26012-L2'), lots.indexOf('AP26012-L2') + 1200).replace(/title="[^"]*"/g, '');
  ok('a reviewed lot: the FULL reason under it, in amber, saying Reject', /color:var\(--amber[^>]*>Cannot be removed: The lab has lot AP26012-L2 in hand \(COA reviewed\)/.test(l2) && /press Reject/.test(l2), strip(l2));
  /* the message no longer promises removal unconditionally */
  const msg = c.lotRemoveBlockedBy(B(c), lot(c, 'LOT-A')) || '';
  ok('the certified refusal says the other checks still apply', /the other checks still apply/.test(msg), msg);
  ok('...and no longer says "this lot can be removed" flat', !/this lot can be removed\./.test(msg), msg);
}

/* ================= 9. the removal that comes back, and the second Remove ================= */
/* The 3-way merge (merge3) cannot express a deleted row: an id-keyed array merges as
   "every local row plus every server row not seen locally". A lot removed in one tab
   returns the moment any other tab's copy is merged in, while produced — a plain
   number — keeps the lowered value. Measured here with the real merge3, because a
   described risk gets argued with. Then: the certified floor refuses the second
   Remove that would otherwise take produced to 0 under a certified 1,010, and the
   Lots tab states the two figures. */
{
  const c = app('COO');
  /* Supersede then Remove, as in §5, but keep a copy of the state BEFORE the removal
     as another tab (and the server) would hold it */
  const qc = qcApproved(c);
  click(c, qc, /openBatchCOA\('B-AP26012','LOT-B'\)/);
  click(c, c.__els.coaFS.innerHTML, /openCorrect\('coa','B-AP26012\|LOT-B'\)/);
  run(c, 'correctForm.reasonCode = "duplicate"; correctForm.reason = "Certificate issued against a lot that was never made.";');
  click(c, c.__els.modal.innerHTML, /^applyCorrect\(\)$/);
  run(c, '__base = JSON.parse(JSON.stringify(dataOnly(state)));');            /* what this tab last saw the server hold */
  const lots = lotsTab(c);
  click(c, lots, /openRemoveLot\('B-AP26012','LOT-B'\)/);
  run(c, 'rmLotForm.reasonCode = "duplicate"; rmLotForm.reason = "The same shift was logged twice; one lot was made.";');
  click(c, c.__els.modal.innerHTML, /^doRemoveLot\(\)$/);
  eq('this tab: one lot, produced 1,010', B(c).lots.length + '/' + B(c).producedKg, '1/1010');
  /* the server meanwhile took an unrelated save from another tab (a note on a different batch) */
  run(c, '__srv = JSON.parse(JSON.stringify(__base)); __srv.batches[0].note = "touched by another tab";');
  run(c, '__merged = ensureState(merge3(__base, dataOnly(state), __srv));');
  const mb = run(c, '__merged.batches.find(function(b){ return b.id === "B-AP26012"; })');
  eq('MEASURED: after the merge the removed lot is back', mb.lots.length, 2);
  eq('...while produced keeps the lowered figure', mb.producedKg, 1010);
  eq('...the lots total 2,020', mb.lots.reduce((a, l) => a + (+l.qty || 0), 0), 2020);
  ok('...and the register entry for the removal survived the merge', run(c, '__merged.corrections.some(function(x){ return x.op === "Removed shift output"; })'));
  /* now the app is looking at that merged state */
  run(c, 'var _cu = state.currentUser; state = __merged; state.currentUser = _cu; state.role = "COO";');
  const l2 = B(c).lots.find(l => l.id === 'LOT-B');
  const why = c.lotRemoveBlockedBy(B(c), l2) || '';
  ok('the certified floor refuses a second Remove', /below the 1,010 Kg the lab has certified/.test(why), why);
  ok('...says produced would go to 0', /take produced to 0 Kg/.test(why), why);
  ok('...and tells the person to reload and tell the COO, not remove again', /reload the page first and tell the COO/.test(why) && /do not remove again/.test(why), why);
  const lots2 = lotsTab(c);
  ok('the Lots tab states the two figures', /lots on this batch total <b>2,020 Kg<\/b> but produced reads <b>1,010 Kg<\/b>/.test(lots2), strip(lots2.slice(0, 600)));
  ok('...and says reload before acting', /Reload the page before acting/.test(lots2));
  ok('...and names the three things NOT to do', /do not remove again, do not correct produced upward and do not log a shift/.test(lots2));
  ok('...as one block, not a flex row of words', /<div class="qbanner" style="display:block;/.test(lots2));
  ok('...with the greyed Remove and the floor\'s reason under L2', /Cannot be removed: Removing 1,010 Kg would take produced to 0 Kg/.test(lots2), strip(lots2.slice(lots2.indexOf('AP26012-L2'), lots2.indexOf('AP26012-L2') + 900)));
  /* and pressing it anyway is refused, nothing changes */
  run(c, 'openRemoveLot("B-AP26012","LOT-B")');
  ok('openRemoveLot refuses on the floor', /below the 1,010 Kg the lab has certified/.test(run(c, 'toasts[toasts.length-1]') || ''));
  eq('...lots untouched', B(c).lots.length, 2);
  eq('...produced untouched', B(c).producedKg, 1010);

  /* the note is a statement of fact, not an alarm: the snapshot trips it nowhere */
  const c2 = app('COO');
  let trips = 0, withLots = 0;
  run(c2, 'state.batches').forEach(b => { if (!b || b.voided || b.id === 'B-AP26012') return; const ls = b.lots || []; if (!ls.length) return; withLots++; const sum = ls.reduce((a, l) => a + (+l.qty || 0), 0); if (Math.abs(sum - (+b.producedKg || 0)) > 0.5) trips++; });
  ok('on the 16 July snapshot, no batch with lots has lots ≠ produced (' + withLots + ' batches checked)', withLots > 50 && trips === 0, 'trips=' + trips);
  const anyBanner = run(c2, 'state.batches').filter(b => b && !b.voided && (b.lots || []).length && b.id !== 'B-AP26012').slice(0, 20).some(b => {
    clear(c2); run(c2, 'state.screen = "prod"; prodView = "lifecycle"; prodFilter = "all"; prodDrill = true; prodBatchSel = ' + JSON.stringify(b.id) + '; prodBatchTab = "lots"; render();');
    return /lots on this batch total/.test(page(c2)); });
  ok('...so the banner appears on none of them when rendered', !anyBanner);
  /* the floor does not bite an ordinary removal: an uncertified duplicate on a consistent batch */
  const c3 = app('COO');
  run(c3, 'state.batches[state.batches.length-1].lots[1].coa = null;');
  eq('an ordinary duplicate (uncertified, produced = lots) is still removable', c3.lotRemoveBlockedBy(B(c3), lot(c3, 'LOT-B')), null);
  /* and it does bite when it should, even without a merge: produced amended down under the lots */
  const c4 = app('COO');
  run(c4, 'var b = state.batches[state.batches.length-1]; b.lots[1].coa = null; b.producedKg = 1500;');
  ok('produced 1,500, certified 1,010 on L1, removing 1,010 → 490 < 1,010: refused', /certified/.test(c4.lotRemoveBlockedBy(B(c4), lot(c4, 'LOT-B')) || ''));
}

/* ================= 10. a re-issued draft says so, everywhere the lab meets it ================= */
{
  const c = app('QCM');
  const qc = qcApproved(c);
  click(c, qc, /openBatchCOA\('B-AP26012','LOT-B'\)/);
  click(c, c.__els.coaFS.innerHTML, /openCorrect\('coa','B-AP26012\|LOT-B'\)/);
  run(c, 'correctForm.reasonCode = "duplicate"; correctForm.reason = "Certificate issued against a lot that was never made.";');
  click(c, c.__els.modal.innerHTML, /^applyCorrect\(\)$/);
  /* now as the Lab Rep, who is handed the draft */
  run(c, 'state.role = "Lab Rep"; state.currentUser = { name: "Analyst B", username: "lab" };');
  clear(c); run(c, 'state.screen = "qc"; qcTab = "awaiting"; render();');
  const awaiting = page(c);
  const row = awaiting.slice(awaiting.indexOf('AP26012-L2') - 50, awaiting.indexOf('AP26012-L2') + 900);
  ok('Lab QC → Awaiting lists the draft', /AP26012-L2/.test(awaiting));
  ok('...and says it is a re-issue, with the reason', /Re-issue of Rev 0 — Certificate issued against a lot that was never made\./.test(row), strip(row));
  ok('...beside Resume COA', /Resume COA/.test(row));
  const opened = click(c, row, /openBatchCOA\('B-AP26012','LOT-B'\)/);
  ok('Resume COA opens the sheet', !!opened);
  const sheet = c.__els.coaFS.innerHTML;
  ok('the sheet opens with the re-issue banner first', /Revision 1 — a re-issue\./.test(sheet), strip(sheet.slice(0, 900)));
  ok('...naming Rev 0, its number and approval date', /replaces Rev 0 \(Q-2\), approved 2026-08-26/.test(sheet), strip(sheet.slice(0, 900)));
  ok('...who superseded it and why', /superseded by Tahir Abbas: <i>Certificate issued against a lot that was never made\.<\/i>/.test(sheet), strip(sheet.slice(0, 900)));
  ok('...and tells the analyst not to certify it again blindly', /Do not certify this again without reading that reason/.test(sheet) && /leave this draft alone/.test(sheet));
  /* the Action Center names it too, and it is still ONE item, not a new one */
  const items = run(c, 'actionItems().filter(function(i){ return i.role === "Lab Rep" && /AP26012-L2/.test(i.what); })');
  eq('one Lab Rep item for the lot', items.length, 1);
  ok('...named as a re-issue with the reason', /re-issue of Rev 0: Certificate issued against a lot that was never made\./.test(items[0].what), items[0].what);
  /* the reason is free text typed by a QCM or COO; `what` is inserted raw by three
     sinks, so it must arrive escaped — checked on the rendered Action Center */
  const c3 = app('COO');
  run(c3, 'var l = state.batches[state.batches.length-1].lots[1]; l.coa.status = "draft"; l.coa.rev = 1; l.coa.supersedes = { rev: 0, qcNo: "Q-2", reason: "<img src=x onerror=alert(1)> & <b>bold</b>", by: "x" }; state.role = "Lab Rep";');
  const w = run(c3, 'actionItems().filter(function(i){ return i.role === "Lab Rep" && /AP26012-L2/.test(i.what); })[0].what');
  ok('the label carries the reason escaped', /&lt;img src=x onerror=alert\(1\)&gt; &amp; &lt;b&gt;bold&lt;\/b&gt;/.test(w), w);
  clear(c3); run(c3, 'state.screen = "approvals"; render();');
  const ac = page(c3);
  ok('the rendered Action Center has no live <img> from it', !/<img src=x onerror/.test(ac));
  ok('...and shows the text', /&lt;img src=x onerror=alert\(1\)&gt;/.test(ac), strip(ac.slice(ac.indexOf('AP26012-L2') - 200, ac.indexOf('AP26012-L2') + 300)));
  clear(c3); run(c3, 'state.screen = "qc"; qcTab = "awaiting"; render();');
  ok('...nor the Lab QC row', !/<img src=x onerror/.test(page(c3)) && /&lt;img src=x/.test(page(c3)));
  run(c3, 'openBatchCOA("B-AP26012","LOT-B")');
  ok('...nor the certificate sheet', !/<img src=x onerror/.test(c3.__els.coaFS.innerHTML) && /&lt;img src=x/.test(c3.__els.coaFS.innerHTML));
  /* an ordinary draft — no supersedes — has no banner and an unchanged label */
  const c2 = app('Lab Rep');
  run(c2, 'state.batches[state.batches.length-1].lots[1].coa = { status: "draft", qcNo: "Q-9", tests: [] };');
  run(c2, 'openBatchCOA("B-AP26012","LOT-B")');
  ok('an ordinary draft: no re-issue banner', !/a re-issue\./.test(c2.__els.coaFS.innerHTML));
  const it2 = run(c2, 'actionItems().filter(function(i){ return i.role === "Lab Rep" && /AP26012-L2/.test(i.what); })');
  eq('...and its Action Center label is as before', it2[0] && it2[0].what, 'Lab COA — V-Ammonium Phosphate AP26012-L2');
  const rowPlain = (() => { clear(c2); run(c2, 'state.screen = "qc"; qcTab = "awaiting"; render();'); const a = page(c2); return a.slice(a.indexOf('AP26012-L2'), a.indexOf('AP26012-L2') + 600); })();
  ok('...and no re-issue note on its Lab QC row', !/Re-issue of Rev/.test(rowPlain));
}

/* ================= 11. the Remove dialogue names what leaves with the lot ================= */
{
  const c = app('COO');
  const qc = qcApproved(c);
  click(c, qc, /openBatchCOA\('B-AP26012','LOT-B'\)/);
  click(c, c.__els.coaFS.innerHTML, /openCorrect\('coa','B-AP26012\|LOT-B'\)/);
  run(c, 'correctForm.reasonCode = "duplicate"; correctForm.reason = "Certificate issued against a lot that was never made.";');
  click(c, c.__els.modal.innerHTML, /^applyCorrect\(\)$/);
  const lots = lotsTab(c);
  click(c, lots, /openRemoveLot\('B-AP26012','LOT-B'\)/);
  const m = c.__els.modal.innerHTML;
  ok('the dialogue names the superseded certificate', /This lot carries 1 superseded certificate revision\(s\) \(Q-2 Rev 0\)/.test(m), strip(m));
  ok('...and says the printable copy goes with the lot and what the register keeps', /printable copies go with the lot; the register keeps the number, revision, who signed, when, and why/.test(m));
  const c2 = app('COO');
  run(c2, 'state.batches[state.batches.length-1].lots[1].coa = null; state.screen = "prod"; openRemoveLot("B-AP26012","LOT-B");');
  ok('a lot with no certificate history: the dialogue does not mention one', !/superseded certificate/.test(c2.__els.modal.innerHTML));
}

/* ================= 12. AP26012 is a MULTI-PO batch ================= */
/* Found by the COO at 16:20 on 26 Aug, one step into the repair: L2 read Draft with a
   greyed Remove and "This batch serves several POs by allocation…". The morning's
   build refused every multi batch flat, and every fixture above had said `bulk`.
   A multi batch spreads each shift across its linked PO lines and writes one
   production-log row per PO with the exact share; un-logging the shift takes those
   exact shares back. Built here through the REAL submitShiftLog, twice — the
   duplicate — so the rows and the lines are what the shipping code writes. */
function multiApp(role, opts) {
  opts = opts || {};
  const c = app(role);
  run(c, 'state.batches.pop();');                                   /* drop the bulk AP26012 */
  run(c, `
    state.orders.unshift(
      { id: 'O-A', po: 'PO-A', client: 'Client A', lines: [{ id: 'LA', brand: 'V-AP Bag', base: 'V-Ammonium Phosphate', ordered: ${opts.orderedA || 1500}, produced: 0, packed: 0 }] },
      { id: 'O-B', po: 'PO-B', client: 'Client B', lines: [{ id: 'LB', brand: 'V-AP Bulk', base: 'V-Ammonium Phosphate', ordered: ${opts.orderedB || 1210}, produced: 0, packed: 0 }] });
    state.batches.unshift({ id: 'B-AP26012', batchNo: 'AP26012', kind: 'multi', base: 'V-Ammonium Phosphate', brand: null,
      allocations: [{ oid: 'O-A', lid: 'LA', po: 'PO-A', client: 'Client A', brand: 'V-AP Bag', kg: ${opts.orderedA || 1500} },
                    { oid: 'O-B', lid: 'LB', po: 'PO-B', client: 'Client B', brand: 'V-AP Bulk', kg: ${opts.orderedB || 1210} }],
      plannedKg: 2710, producedKg: 0, packedKg: 0, status: 'open', openedDate: '2026-08-20', lots: [] });
    state.role = 'Production'; state.screen = 'prod';
    shiftForm = { batchId: 'B-AP26012', qty: 1010, shift: 'Morning', incharge: 'Muhammad Imran', date: '2026-08-21', beds: [] };
    submitShiftLog();
    ${opts.fillB ? 'var _lb = state.orders.find(function(o){ return o.id === "O-B"; }).lines[0]; _lb.produced = _lb.ordered;' : ''}
    shiftForm = { batchId: 'B-AP26012', qty: 1010, shift: 'Morning', incharge: 'Muhammad Imran', date: '2026-08-21', beds: [] };
    submitShiftLog();            /* first press: the duplicate warning, nothing written */
    submitShiftLog();            /* second press: confirmed */
    state.role = ${JSON.stringify(role)};
  `);
  return c;
}
const line = (c, id) => run(c, 'state.orders.flatMap(function(o){ return o.lines; }).find(function(l){ return l.id === ' + JSON.stringify(id) + '; })');
const logRows = c => run(c, 'state.productionLog.filter(function(p){ return p && p.batchNo === "AP26012"; }).map(function(p){ return p.po + ":" + p.kg; })');
const mB = c => run(c, 'state.batches.find(function(b){ return b.id === "B-AP26012"; })');
{
  const c = multiApp('COO');
  /* what the real code wrote */
  eq('two lots from the duplicate', mB(c).lots.length, 2);
  eq('produced 2,020', mB(c).producedKg, 2020);
  eq('PO-A line produced (pro-rata 1500/2710 of 1,010, twice)', line(c, 'LA').produced, 2 * Math.round(1010 * 1500 / 2710 * 100) / 100);
  eq('PO-B line produced (the residual, twice)', Math.round(line(c, 'LB').produced * 100) / 100, Math.round(2 * (1010 - Math.round(1010 * 1500 / 2710 * 100) / 100) * 100) / 100);
  const r2 = x => Math.round(x * 100) / 100;
  eq('four log rows, one per PO per submission, newest first', logRows(c).map(x => x.split(':')[0] + ':' + r2(+x.split(':')[1])).join(' '), 'PO-B:' + r2(1010 - 559.04) + ' PO-A:559.04 PO-B:' + r2(1010 - 559.04) + ' PO-A:559.04');
  const la1 = line(c, 'LA').produced, lb1 = line(c, 'LB').produced;
  const olderIds = run(c, 'state.productionLog.filter(function(p){ return p && p.batchNo === "AP26012"; }).slice(2).map(function(p){ return p.id; })');
  /* the lab certifies L1; L2 is the draft left by the supersede */
  run(c, 'var b = state.batches.find(function(x){ return x.id === "B-AP26012"; }); b.lots[0].coa = { status: "approved", certifiedKg: 1010, qcNo: "Q-1", tests: [] }; b.lots[1].coa = { status: "draft", qcNo: "Q-2", rev: 1, tests: [], supersedes: { rev: 0, qcNo: "Q-2", reason: "never made", by: "Tahir Abbas" } }; b.lots[1].coaHistory = [{ status: "superseded", rev: 0, qcNo: "Q-2", approver: { name: "QCM One" }, approvedDate: "2026-08-26", supersededBy: "Tahir Abbas", supersededAt: "2026-08-26T11:00:00Z", supersededReason: "never made" }];');
  const l2 = mB(c).lots[1];
  eq('the multi refusal is gone: the rows are on file', c.lotRemoveBlockedBy(mB(c), l2), null);
  ok('the block found for L2 is the NEWEST pair of rows', JSON.stringify(c.lotMultiLogRows(mB(c), l2)) === '[0,1]', JSON.stringify(c.lotMultiLogRows(mB(c), l2)));
  ok('...and for L1 the older pair', JSON.stringify(c.lotMultiLogRows(mB(c), mB(c).lots[0])) === '[2,3]', JSON.stringify(c.lotMultiLogRows(mB(c), mB(c).lots[0])));
  /* click it */
  const lots = lotsTab(c);
  ok('the Lots tab draws a live Remove on L2', /onclick="openRemoveLot\('B-AP26012','LOT/.test(lots) && /AP26012-L2/.test(lots), strip(lots.slice(lots.indexOf('AP26012-L2') - 100, lots.indexOf('AP26012-L2') + 600)));
  const rm = click(c, lots, new RegExp("openRemoveLot\\('B-AP26012','" + l2.id + "'\\)"));
  ok('Remove opens', !!rm);
  run(c, 'rmLotForm.reasonCode = "duplicate"; rmLotForm.reason = "The same shift was logged twice; one lot was made.";');
  click(c, c.__els.modal.innerHTML, /^doRemoveLot\(\)$/);
  eq('one lot left', mB(c).lots.length, 1);
  eq('produced 1,010', mB(c).producedKg, 1010);
  eq('PO-A line back to one share', line(c, 'LA').produced, la1 / 2);
  eq('PO-B line back to one share', Math.round(line(c, 'LB').produced * 100) / 100, Math.round(lb1 / 2 * 100) / 100);
  eq('two log rows left — the first submission\'s', logRows(c).map(x => x.split(':')[0] + ':' + r2(+x.split(':')[1])).join(' '), 'PO-B:' + r2(1010 - 559.04) + ' PO-A:559.04');
  eq('...and they are the FIRST submission\'s rows by id, not merely rows of the same size', run(c, 'state.productionLog.filter(function(p){ return p && p.batchNo === "AP26012"; }).map(function(p){ return p.id; })').join(','), olderIds.join(','));
  eq('one shift entry left', run(c, 'state.shiftEntries.filter(function(e){ return e.batchId === "B-AP26012"; }).length'), 1);
  eq('packable 1,010', c.batchPackableKg(mB(c)), 1010);
  const reg = run(c, 'state.corrections[0]');
  ok('the register cascade names both PO lines', reg.cascade.some(x => /PO PO-A · V-AP Bag produced/.test(x)) && reg.cascade.some(x => /PO PO-B · V-AP Bulk produced/.test(x)), JSON.stringify(reg.cascade));
  ok('...and the two rows', reg.cascade.some(x => /2 production log row\(s\) removed/.test(x)));
  ok('...and the superseded certificate', /Rev 0 Q-2 approved by QCM One/.test(reg.changes.find(x => x.field === 'coa').before));
  const last = run(c, 'toasts[toasts.length-1]');
  ok('the toast says so too', /2,020 → 1,010/.test(last) && /PO-A/.test(last) && /PO-B/.test(last), last);
  ok('no lots-vs-produced banner afterwards', !/lots on this batch total/.test(lotsTab(c)));
}
{
  /* the capped case: PO-B was filled by another batch between the two submissions,
     so the SECOND submission writes only one row (PO-A) and its residual goes to
     batch stock — submitShiftLog writes no row for a zero share */
  const c = multiApp('COO', { orderedA: 1500, orderedB: 1210, fillB: true });
  eq('three log rows: two for the first submission, one for the capped second', logRows(c).length, 3);
  ok('...the second submission put its residual into batch stock (PO-B full)', line(c, 'LB').produced === 1210 && mB(c).producedKg === 2020);
  run(c, 'var b = state.batches.find(function(x){ return x.id === "B-AP26012"; }); b.lots[0].coa = { status: "approved", certifiedKg: 1010, qcNo: "Q-1" }; b.lots[1].coa = null;');
  const l2 = mB(c).lots[1];
  ok('L2 owns the one-row block (rank 0)', JSON.stringify(c.lotMultiLogRows(mB(c), l2)) === '[0]', JSON.stringify(c.lotMultiLogRows(mB(c), l2)));
  ok('L1 owns the two-row block (rank 1) — not swallowed into L2\'s', JSON.stringify(c.lotMultiLogRows(mB(c), mB(c).lots[0])) === '[1,2]', JSON.stringify(c.lotMultiLogRows(mB(c), mB(c).lots[0])));
  const laBefore = line(c, 'LA').produced;
  run(c, 'state.screen = "prod"; openRemoveLot("B-AP26012", ' + JSON.stringify(l2.id) + '); rmLotForm.reasonCode = "duplicate"; rmLotForm.reason = "Logged twice by mistake on the floor."; doRemoveLot();');
  eq('produced 1,010', mB(c).producedKg, 1010);
  eq('PO-B untouched at 1,210 — the second submission never reached it', line(c, 'LB').produced, 1210);
  ok('PO-A lost exactly the second submission\'s share', Math.abs(line(c, 'LA').produced - (laBefore - 559.04)) < 0.001, String(line(c, 'LA').produced));
  eq('two rows left', logRows(c).length, 2);
}
{
  /* the rows are missing (older data, or already removed): refused, with the reason */
  const c = multiApp('COO');
  run(c, 'var b = state.batches.find(function(x){ return x.id === "B-AP26012"; }); b.lots[0].coa = { status: "approved", certifiedKg: 1010, qcNo: "Q-1" }; b.lots[1].coa = null; state.productionLog = state.productionLog.filter(function(p){ return p.batchNo !== "AP26012"; });');
  const why = c.lotRemoveBlockedBy(mB(c), mB(c).lots[1]) || '';
  ok('no rows on file: refused', /production-log rows that spread this shift across them are not on file/.test(why), why);
  ok('...pointing at the batch correction', /Correct the batch instead/.test(why));
  /* a multi batch with no allocations at all: refused the same way */
  const c2 = multiApp('COO');
  run(c2, 'var b = state.batches.find(function(x){ return x.id === "B-AP26012"; }); b.allocations = []; b.lots[1].coa = null;');
  ok('no allocations: refused', /not on file/.test(c2.lotRemoveBlockedBy(mB(c2), mB(c2).lots[1]) || ''));
  /* a PO batch and a bulk batch are untouched by the multi branch */
  const c3 = app('COO');
  run(c3, 'state.batches[state.batches.length-1].lots[1].coa = null;');
  ok('bulk: lotMultiLogRows is null and irrelevant', c3.lotMultiLogRows(B(c3), lot(c3, 'LOT-B')) === null && c3.lotRemoveBlockedBy(B(c3), lot(c3, 'LOT-B')) === null);
}

console.log('\ncertremove: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
