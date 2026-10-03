/* AP26012, 26 August 2026 — two faults reported from the floor.

   1. "Production is unable to pack a finished lot."
      V-Ammonium Phosphate, planned 2,710, produced 2,020, one lot of 1,010
      certified FIT by the lab. The bucket bar said "Ready to pack 1,010" and the
      screen offered Log shift output and Close batch — never Pack.

      NOT a regression: the same batch shape is run below through EVERY baseline
      file in this folder — the file as it stood before the authorisation work,
      before Supply Chain, before the HG26025 fix, before the Production
      conversion, before the yield work and immediately before this change. All
      of them behave identically. The cause is older than any of them. (The list
      is read off the folder rather than typed, so a baseline added later is
      checked too and a count in the prose cannot go stale. Two are kept in the
      repository — the file before the whole month's work, and the file
      immediately before this change — because they bracket every change the COO
      suspected; the rest live in the working copy and are swept when present.) A batch carries ONE stage, decided by its worst
      part: while any of the plan is unmade it is 'producing', and while any lot
      is uncertified it is 'qc'. Right for a heading, wrong for a button.

      The arithmetic was always correct — batchPackableKg counts only certified,
      undisposed, unpacked material and doPack caps at it; batchLabApproved passes
      a batch with ANY approved lot. Only the offer was missing. batchPackNow asks
      the question the screen never asked, and batchStage is left alone.

   2. "System shows 2 lots produced which is not true."
      Two lots, both 1,010 Kg, same shift, same incharge, same date — one shift
      logged twice. Nothing objected, because lot numbers are minted by counting
      the lots already there, so the repeat came out as "-L2". And nothing could
      undo it: the only unwind in the file sat below screenProd's unreachable
      return and was COO-only besides.

   Run: node lotpack.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;
const BLOCKS = [...H.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

/* the batch exactly as the floor screenshot showed it */
const AP = () => ({
  id: 'B-AP26012', batchNo: 'AP26012', base: 'V-Ammonium Phosphate',
  brand: 'V-Ammonium Phosphate', kind: 'bulk', status: 'open', openedDate: '2026-08-20',
  plannedKg: 2710, producedKg: 2020, packedKg: 0, disposedKg: 0,
  lots: [
    { id: 'LOT-A', lotNo: 'AP26012-L1', qty: 1010, date: '2026-08-21', shift: 'Morning',
      incharge: 'Muhammad Imran', coa: { status: 'approved', certifiedKg: 1010, qcNo: 'Q-1' } },
    { id: 'LOT-B', lotNo: 'AP26012-L2', qty: 1010, date: '2026-08-21', shift: 'Morning',
      incharge: 'Muhammad Imran', coa: null },
  ],
});

function app(file) {
  const html = file ? fs.readFileSync(path.join(__dirname, '..', file), 'utf8') : H.html;
  const blocks = file ? [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]) : BLOCKS;
  const el = () => ({ innerHTML: '', textContent: '', value: '', style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, querySelector() { return el(); },
    querySelectorAll() { return []; }, focus() {}, click() {}, getAttribute() { return null; },
    setAttribute() {}, remove() {}, dataset: {}, children: [], parentNode: null, scrollIntoView() {} });
  const doc = { getElementById() { return el(); }, querySelector() { return el(); },
    querySelectorAll() { return []; }, createElement() { return el(); },
    body: el(), documentElement: el(), head: el(), addEventListener() {} };
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
  vm.runInContext('state = __st; state.screen="prod"; state.role="Production";'
    + ' state.batches = state.batches || []; state.batches.push(__b);'
    + ' toasts = []; var _t = toast; toast = function(m){ toasts.push(String(m)); };', c);
  /* Production converted to RIGHTS_LIVE on 27 Aug — see batchclose.test.js's
     copy of this comment. Full-app sandbox, so the real function is right here. */
  vm.runInContext('if(typeof seedDeptRightsV1==="function") seedDeptRightsV1(state);', c);
  return c;
}
const run = (c, src) => vm.runInContext(src, c);
const B = c => run(c, 'state.batches[state.batches.length-1]');

/* ================= 1. the arithmetic was never wrong ================= */
{
  const c = app();
  const b = B(c);
  eq('the lab certified 1,010 of the 2,020 made', c.batchClearedKg(b), 1010);
  eq('so 1,010 is packable', c.batchPackableKg(b), 1010);
  ok('...and the batch passes the lab gate on ONE approved lot', c.batchLabApproved(b) === true);
  eq('but the batch reads "producing", because the plan is unfinished',
     c.batchStage(b), 'producing');
  ok('batchStage is deliberately unchanged — it drives the bar, the dots and reconcile',
     /if\(b\.status==='open' && prod<plan-0\.5\) return 'producing';/.test(H.grab('batchStage')),
     H.grab('batchStage').slice(0, 200));
  ok('the new question is asked by a separate function', c.batchPackNow(b) === true);
}

/* ================= 2. it is NOT a regression ================= */
/* Checked against the file as it stood before each of the last three changes.
   The COO believed the recent updates had caused it; they had not, and saying so
   is only worth anything if it is measured. */
{
  const BASELINES = fs.readdirSync(__dirname)
    .filter(f => /^_before-.*\.html$/.test(f)).sort().map(f => 'tests/' + f);
  ok('there are baseline files to check against', BASELINES.length >= 2, BASELINES.join(', '));
  ok('...including the one from before the whole month\'s work',
     BASELINES.indexOf('tests/_before-auth.html') >= 0, BASELINES.join(', '));
  ok('...and the one from immediately before this change',
     BASELINES.indexOf('tests/_before-lot.html') >= 0, BASELINES.join(', '));
  BASELINES.forEach(f => {
    const c = app(f);
    const b = B(c);
    const PC = run(c, 'window.ProductionCenter');
    const d = PC.derive(b);
    eq(f + ': the same batch read "producing" then too', d.stage, 'producing');
    const arity = run(c, '_pcLifeAction.length');
    const act = arity === 3 ? run(c, '_pcLifeAction')(b, d, true) : run(c, '_pcLifeAction')(b, d);
    ok(f + ': ...and offered no Pack button', !/>Pack/.test(act), act.replace(/<[^>]*>/g, '|'));
  });
}

/* ================= 3. the fix — Pack is offered beside the stage button ======= */
{
  const c = app();
  const b = B(c);
  const PC = run(c, 'window.ProductionCenter');
  const act = run(c, '_pcLifeAction')(b, PC.derive(b));
  ok('the batch now offers Pack', /Pack 1,010 Kg cleared/.test(act), act.replace(/<[^>]*>/g, '|'));
  ok('...and STILL offers Log shift output — the batch is both at once',
     /Log shift output/.test(act), act.replace(/<[^>]*>/g, '|'));
  ok('...and still offers Close batch', /Close batch/.test(act));
  ok('the Pack button opens the pack modal for this batch',
     /openPack\('B-AP26012'\)/.test(act), act.slice(0, 300));

  /* the two lists and the count */
  run(c, 'prodFilter="pack";');
  const list = run(c, 'prodStageList()');
  ok('it appears in the Ready to pack list', /AP26012/.test(list), list.slice(0, 200));
  const life = run(c, 'renderProdLifecycleBatch()');
  ok('...and in the batch lifecycle view of the same tab', /AP26012/.test(life));
  const counts = run(c, 'prodWorkCounts()');
  ok('the Ready to pack count includes it', counts.pack >= 1, 'pack=' + counts.pack);
  ok('...while Running batches still counts it too — it is genuinely both',
     counts.producing >= 1, 'producing=' + counts.producing);

  /* and nothing is offered where nothing is packable */
  const b2 = AP(); b2.id = 'B-NONE'; b2.lots.forEach(l => { l.coa = null; });
  run(c, 'state.batches.push(' + JSON.stringify(b2) + ');');
  const none = run(c, 'state.batches[state.batches.length-1]');
  eq('a batch with no certified lot is not packable', c.batchPackNow(none), false);
  const act2 = run(c, '_pcLifeAction')(none, PC.derive(none));
  ok('...and is offered no Pack button', !/>Pack/.test(act2), act2.replace(/<[^>]*>/g, '|'));
}

/* ====== 3b. the offer set: what became packable, and what did not =========== */
/* The one clause with no other cover: activeFloorBatches does NOT exclude voided
   batches, so dropping !b.voided puts a voided batch holding certified material
   straight back into Ready to pack. No real batch is affected today, which is
   exactly why nothing would notice. */
{
  const c = app();
  const shape = f => { const x = AP(); f(x); return x; };
  const cases = [
    ['uncertified (draft)',        shape(x => x.lots.forEach(l => { l.coa = { status: 'draft' }; })),  false],
    ['UNFIT',                      shape(x => x.lots.forEach(l => { l.coa = { status: 'failed' }; })), false],
    ['certified then withdrawn',   shape(x => x.lots.forEach(l => { l.coa = { status: 'draft' }; })),  false],
    ['all certified disposed',     shape(x => { x.disposedKg = 2020; }),                              false],
    ['all certified already packed', shape(x => { x.packedKg = 1010; }),                              false],
    ['a pool',                     shape(x => { x.pool = true; x.disposition = 'byproduct'; }),       false],
    ['a VOIDED batch',             shape(x => { x.voided = true; }),                                  false],
    ['reconciled, nothing disposed', shape(x => { x.reconciled = true; }),                            false],
    ['the real AP26012',           AP(),                                                              true],
  ];
  cases.forEach(([label, b, want]) => eq('packable now? ' + label, c.batchPackNow(b), want));

  /* certifiedKg below the lot quantity — only the certified part */
  const part = shape(x => { x.lots[0].coa = { status: 'approved', certifiedKg: 400 }; });
  eq('a partly-certified lot offers only the certified part', c.batchPackableKg(part), 400);
  eq('...and it is offered', c.batchPackNow(part), true);

  /* the clause is load-bearing: prove activeFloorBatches would have let it through */
  run(c, 'state.batches.push(' + JSON.stringify(shape(x => { x.id = 'B-VOID'; x.voided = true; })) + ');');
  const af = run(c, 'activeFloorBatches().map(function(x){return x.id;})');
  ok('activeFloorBatches does NOT filter voided batches — so !b.voided is the only guard',
     af.indexOf('B-VOID') >= 0, af.join(', ').slice(0, 200));
  run(c, 'prodFilter="pack";');
  ok('...and the voided batch stays out of Ready to pack',
     !/B-VOID/.test(run(c, 'prodStageList()')));
}

/* ================= 4. packing it packs exactly the certified quantity ======== */
/* The whole safety of the change rests on this: the button is new, the cap is not. */
{
  const c = app();
  run(c, 'state.role="Production"; packForm={};');
  run(c, 'openPack("B-AP26012");');
  eq('the pack form opens at the certified quantity, not the produced one',
     run(c, 'packForm.kg'), 1010);

  /* the cap itself, read off the function that applies it */
  const dp = H.grab('doPack');
  ok('doPack still caps the quantity at batchPackableKg',
     /const rem=batchPackableKg\(b\);\s*let kg=Math\.min\(\+packForm\.kg\|\|0,rem\);/.test(dp),
     dp.slice(0, 300));
  ok('...and still refuses a batch the lab has not approved at all',
     /if\(!batchLabApproved\(b\)\)\{toast\(/.test(dp), dp.slice(0, 300));

  /* driven for real, through a PO, which is the only way this app packs */
  const c2 = app();
  run(c2, 'state.role="COO";');
  const brand = run(c2, '(brandsForBase("V-Ammonium Phosphate")||[])[0] || ""');
  ok('a brand exists for this base', !!brand, String(brand));
  if (brand) {
    run(c2, 'state.orders.unshift({id:"O-T1",po:"PO-TEST-1",client:"Test Client",received:"2026-08-01",'
          + ' promised:"2026-09-01",lines:[{id:"L-T1",brand:' + JSON.stringify(brand) + ','
          + ' base:"V-Ammonium Phosphate",ordered:3000,produced:2020,packed:0,rate:100,price:100}]});');
    run(c2, 'openPack("B-AP26012"); packForm.brand=' + JSON.stringify(brand) + ';'
          + ' packForm.oid="O-T1"; packForm.lid="L-T1"; packForm.kg=2020;'
          + ' packForm.price=100; packForm.priceOk=true; toasts=[]; doPack();');
    const b = B(c2);
    const said = run(c2, 'toasts').join(' | ');
    if (b.packedKg > 0) {
      eq('asking for 2,020 packs only the 1,010 the lab certified', b.packedKg, 1010);
      eq('...and there is nothing left to pack', c2.batchPackableKg(b), 0);
      eq('...so the Pack offer goes away', c2.batchPackNow(b), false);
    } else {
      /* a pricing or dating gate refused before the cap was reached — say so
         plainly rather than reporting a pass that did not happen */
      ok('the real pack path was reached (it refused: ' + said.slice(0, 120) + ')', false, said);
    }
  }
}

/* ================= 5. removing the duplicate lot ================= */
{
  /* refused where it should be */
  const c = app();
  const b = B(c);
  ok('removing the CERTIFIED lot is refused',
     /certified/i.test(c.lotRemoveBlockedBy(b, b.lots[0]) || ''), c.lotRemoveBlockedBy(b, b.lots[0]));
  ok('...and it says dispose of it instead',
     /dispose of it/i.test(c.lotRemoveBlockedBy(b, b.lots[0]) || ''));
  eq('removing the UNCERTIFIED duplicate is allowed', c.lotRemoveBlockedBy(b, b.lots[1]), null);

  /* not below what has left the batch */
  const b3 = AP(); b3.packedKg = 1600;
  eq('a lot that would take produced below what is packed is refused',
     /already packed or disposed/.test(c.lotRemoveBlockedBy(b3, b3.lots[1]) || ''), true);

  /* a multi-PO batch is refused outright */
  const b4 = AP(); b4.kind = 'multi';
  ok('a multi-PO batch is refused, allocation cannot be unpicked',
     /several POs/.test(c.lotRemoveBlockedBy(b4, b4.lots[1]) || ''));

  /* who may */
  run(c, 'state.role="Production";');
  eq('the floor officer who logged it may not remove it', run(c, 'may("production.void")'), false);
  run(c, 'state.role="Plant Manager";');
  eq('the head above him may', run(c, 'may("production.void")'), true);
  run(c, 'state.role="COO";');
  eq('and the COO may', run(c, 'may("production.void")'), true);
}

/* ================= 6. the removal, driven end to end ================= */
{
  const c = app();
  run(c, 'state.role="COO";'
       + ' state.shiftEntries = state.shiftEntries || [];'
       + ' state.shiftEntries.unshift({id:"SE-A",batchId:"B-AP26012",batchNo:"AP26012",date:"2026-08-21",shift:"Morning",incharge:"Muhammad Imran",kg:1010});'
       + ' state.shiftEntries.unshift({id:"SE-B",batchId:"B-AP26012",batchNo:"AP26012",date:"2026-08-21",shift:"Morning",incharge:"Muhammad Imran",kg:1010});'
       + ' state.productionLog = state.productionLog || [];'
       + ' state.productionLog.unshift({id:"PL-A",date:"2026-08-21",base:"V-Ammonium Phosphate",kg:1010,shift:"Morning",incharge:"Muhammad Imran",batchNo:"AP26012",by:"Production"});'
       + ' state.productionLog.unshift({id:"PL-B",date:"2026-08-21",base:"V-Ammonium Phosphate",kg:1010,shift:"Morning",incharge:"Muhammad Imran",batchNo:"AP26012",by:"Production"});');
  const se0 = run(c, 'state.shiftEntries.length'), pl0 = run(c, 'state.productionLog.length');
  const cr0 = run(c, '(state.corrections||[]).length');

  run(c, 'openRemoveLot("B-AP26012","LOT-B");');
  ok('the modal opened on the right lot', run(c, 'rmLotForm.lid') === 'LOT-B');

  /* a reason is required, and a real one */
  run(c, 'doRemoveLot();');
  eq('nothing removed without a reason', B(c).lots.length, 2);
  ok('...and it says so', /Pick a reason/.test(run(c, 'toasts').join(' | ')));
  run(c, 'rmLotForm.reasonCode="duplicate"; rmLotForm.reason="short"; doRemoveLot();');
  eq('nothing removed on a one-word explanation', B(c).lots.length, 2);

  run(c, 'rmLotForm.reason="Morning shift was submitted twice by mistake; only one run happened."; doRemoveLot();');
  const b = B(c);
  eq('the duplicate lot is gone', b.lots.length, 1);
  eq('...and it is the RIGHT one — the certified lot survives', b.lots[0].id, 'LOT-A');
  eq('produced comes down by exactly that lot', b.producedKg, 1010);
  eq('one shift entry removed, not both', run(c, 'state.shiftEntries.length'), se0 - 1);
  eq('one production-log row removed, not both', run(c, 'state.productionLog.length'), pl0 - 1);
  eq('the certified quantity is untouched', c.batchClearedKg(b), 1010);
  eq('...so all of it is now packable', c.batchPackableKg(b), 1010);

  /* the register */
  const crs = run(c, 'state.corrections');
  eq('one correction was written', crs.length, cr0 + 1);
  const cr = crs[0];
  eq('...against the batch', cr.entityLabel, 'AP26012');
  eq('...with the reason chosen', cr.reasonCode, 'duplicate');
  ok('...naming the lot and the before/after produced',
     cr.changes.some(x => /AP26012-L2/.test(x.label)) &&
     cr.changes.some(x => x.field === 'producedKg' && /2,020/.test(String(x.before)) && /1,010/.test(String(x.after))),
     JSON.stringify(cr.changes));
  ok('...and saying what it cascaded to',
     cr.cascade.join(' ').indexOf('Ready to pack is now 1,010 Kg') >= 0, cr.cascade.join(' | '));
  ok('...recorded against the person, not the app', !!cr.byRole, JSON.stringify(cr.byRole));

  /* THE COA STATE IS IN THE REGISTER. The guard half of this was well pinned and
     this half was not: deleting the coa change row, or hardcoding it to 'none',
     passed all 5,990 assertions. Without it a removal reads the same whether the
     lab had never seen the lot or had it part-signed. */
  {
    const c2 = app();
    run(c2, 'state.role="COO"; state.batches[state.batches.length-1].lots[1].coa={status:"draft",qcNo:"QC-77"};'
          + ' rmLotForm={bid:"B-AP26012",lid:"LOT-B",reasonCode:"duplicate",'
          + ' reason:"Duplicate of the morning run, logged twice."}; doRemoveLot();');
    const ch = run(c2, 'state.corrections[0].changes');
    const coa = ch.filter(x => x.field === 'coa')[0];
    ok('the correction records that a COA existed', !!coa, JSON.stringify(ch));
    ok('...with its status and QC number', !!coa && /draft/.test(String(coa.before)) && /QC-77/.test(String(coa.before)),
       JSON.stringify(coa));

    const c3 = app();
    run(c3, 'state.role="COO"; rmLotForm={bid:"B-AP26012",lid:"LOT-B",reasonCode:"duplicate",'
          + ' reason:"Duplicate of the morning run, logged twice."}; doRemoveLot();');
    const coa3 = run(c3, 'state.corrections[0].changes').filter(x => x.field === 'coa')[0];
    ok('...and says "none" when the lab never saw it', !!coa3 && coa3.before === 'none',
       JSON.stringify(coa3));
    ok('...so the two removals do not read the same', !!coa && !!coa3 && coa.before !== coa3.before,
       JSON.stringify([coa && coa.before, coa3 && coa3.before]));
  }

  /* and it cannot be done twice */
  run(c, 'openRemoveLot("B-AP26012","LOT-B");');
  ok('removing a lot that is already gone is refused',
     /no longer on this batch/.test(run(c, 'toasts').join(' | ')));
}

/* ============ 6a. the authority gates, driven — not read off the source ====== */
/* A reviewer stripped may('production.void') from both openRemoveLot and
   doRemoveLot on 26 Aug and a KAM deleted a lot with all 11 suites green. Source
   pins are in authmodel; these drive it. */
{
  const c = app();
  run(c, 'state.shiftEntries=[]; state.productionLog=[];');
  const tryRemove = role => {
    run(c, 'state.role=' + JSON.stringify(role) + '; toasts=[];'
         + ' rmLotForm={bid:"B-AP26012",lid:"LOT-B",reasonCode:"duplicate",'
         + ' reason:"Trying to remove it as ' + role + ' for the test."};'
         + ' doRemoveLot();');
    return B(c).lots.length;
  };
  ['Production', 'KAM', 'QA Inspector', 'Supply Chain', 'Lab Rep', 'CFO'].forEach(role => {
    eq(role + ' cannot remove a lot even by calling the writer directly', tryRemove(role), 2);
    ok('...and is told which right it needs',
       /production\.void|Remov/i.test(run(c, 'toasts').join(' | ')), run(c, 'toasts').join(' | '));
  });
  /* the opener refuses too, so no form is filled in and lost */
  run(c, 'state.role="KAM"; rmLotForm={bid:"",lid:"",reasonCode:"",reason:""}; toasts=[]; openRemoveLot("B-AP26012","LOT-B");');
  eq('...and the modal never opens for him', run(c, 'rmLotForm.lid'), '');

  /* the head may, and it works */
  eq('the Plant Manager can', tryRemove('Plant Manager'), 1);
}

/* ====== 6c. certified between opening the form and pressing Remove ========== */
/* The re-check doRemoveLot's comment advertises. Removing it left every suite
   green while a certified lot was destroyed. */
{
  const c = app();
  run(c, 'state.role="COO"; openRemoveLot("B-AP26012","LOT-B");');
  eq('the modal opened on the uncertified lot', run(c, 'rmLotForm.lid'), 'LOT-B');
  /* the lab certifies it while the form is open */
  run(c, 'state.batches[state.batches.length-1].lots[1].coa={status:"approved",certifiedKg:1010,qcNo:"Q-2"};');
  run(c, 'rmLotForm.reasonCode="duplicate";'
       + ' rmLotForm.reason="Thought it was a duplicate before the lab signed it."; toasts=[];'
       + ' doRemoveLot();');
  eq('the removal is refused on the second look', B(c).lots.length, 2);
  ok('...and says the lab has certified it',
     /certified/i.test(run(c, 'toasts').join(' | ')), run(c, 'toasts').join(' | '));
  eq('...and nothing was written', B(c).producedKg, 2020);
}

/* ====== 6d. a lot the lab has in hand, not only an approved one ============= */
{
  const c = app();
  const b = B(c);
  const withStatus = st => { const x = AP(); x.lots[1].coa = st ? { status: st } : null; return x; };
  eq('a draft COA does not block — the lab has not committed to anything',
     c.lotRemoveBlockedBy(withStatus('draft'), withStatus('draft').lots[1]), null);
  ok('an UNFIT lot is refused — that is the Plant Manager\'s decision to make',
     /UNFIT/.test(c.lotRemoveBlockedBy(withStatus('failed'), withStatus('failed').lots[1]) || ''),
     c.lotRemoveBlockedBy(withStatus('failed'), withStatus('failed').lots[1]));
  ['analysed', 'reviewed'].forEach(st =>
    ok('a COA mid-signature (' + st + ') is refused',
       /in hand/.test(c.lotRemoveBlockedBy(withStatus(st), withStatus(st).lots[1]) || ''),
       c.lotRemoveBlockedBy(withStatus(st), withStatus(st).lots[1])));
  ok('...and an approved one still is', /certified/i.test(c.lotRemoveBlockedBy(b, b.lots[0]) || ''));
}

/* ================= 6b. the Remove control, as it is actually drawn ========= */
/* Drawn only where the removal would be allowed, so nobody is shown a button
   that refuses on the click — the fault the pools strip was split to avoid. */
{
  const c = app();
  const show = role => { run(c, 'state.role=' + JSON.stringify(role) + '; prodFilter="all";'
    + ' prodBatchSel="B-AP26012"; prodBatchTab="lots";');
    return run(c, 'renderProdLifecycleBatch()'); };

  const asCOO = show('COO');
  ok('the lots tab lists both lots', /AP26012-L1/.test(asCOO) && /AP26012-L2/.test(asCOO));
  ok('the COO is offered Remove', /openRemoveLot\('B-AP26012','LOT-B'\)/.test(asCOO),
     asCOO.slice(asCOO.indexOf('AP26012-L2') - 40, asCOO.indexOf('AP26012-L2') + 400));
  ok('...and NOT on the certified lot', !/openRemoveLot\('B-AP26012','LOT-A'\)/.test(asCOO));

  const asPM = show('Plant Manager');
  ok('the Plant Manager is offered Remove', /openRemoveLot\('B-AP26012','LOT-B'\)/.test(asPM));

  const asProd = show('Production');
  ok('the floor officer is offered no Remove at all', !/openRemoveLot/.test(asProd));
  ok('...but still sees the lots', /AP26012-L2/.test(asProd));

  const asKAM = show('KAM');
  ok('and neither is anyone outside Production', !/openRemoveLot/.test(asKAM));
}

/* ====== 6e. it removes the right ROW, not just the right lot =============== */
/* Two lots, same batch, date, shift and quantity, DIFFERENT incharges. The shift
   entry and the production-log row must both be matched on all four fields or the
   wrong row goes. A reviewer showed both matchers could drop `incharge` with all
   11 suites green, so the fix was in place and nothing held it there. */
{
  const c = app();
  run(c, 'state.role="COO";'
       + ' var b=state.batches[state.batches.length-1];'
       + ' b.lots=[{id:"LT-RANA",lotNo:"AP26012-L1",qty:1010,date:"2026-08-21",shift:"Morning",incharge:"Rana",coa:null},'
       + '         {id:"LT-BILAL",lotNo:"AP26012-L2",qty:1010,date:"2026-08-21",shift:"Morning",incharge:"Bilal",coa:null}];'
       + ' state.shiftEntries=[{id:"SE-RANA",batchId:"B-AP26012",batchNo:"AP26012",date:"2026-08-21",shift:"Morning",incharge:"Rana",kg:1010},'
       + '                     {id:"SE-BILAL",batchId:"B-AP26012",batchNo:"AP26012",date:"2026-08-21",shift:"Morning",incharge:"Bilal",kg:1010}];'
       + ' state.productionLog=[{id:"PL-RANA",date:"2026-08-21",base:"V-Ammonium Phosphate",kg:1010,shift:"Morning",incharge:"Rana",batchNo:"AP26012",by:"Production"},'
       + '                      {id:"PL-BILAL",date:"2026-08-21",base:"V-Ammonium Phosphate",kg:1010,shift:"Morning",incharge:"Bilal",batchNo:"AP26012",by:"Production"}];'
       + ' rmLotForm={bid:"B-AP26012",lid:"LT-BILAL",reasonCode:"wrongrec",'
       + ' reason:"Bilal\'s entry was against the wrong batch."}; doRemoveLot();');

  const b = B(c);
  eq('Bilal\'s lot is gone', b.lots.length, 1);
  eq('...and Rana\'s is the one that remains', b.lots[0].id, 'LT-RANA');
  eq('RANA\'S shift entry survives — the matcher used the incharge',
     run(c, 'state.shiftEntries.map(function(e){return e.id;}).join(",")'), 'SE-RANA');
  eq('...and so does Rana\'s production-log row',
     run(c, 'state.productionLog.map(function(p){return p.id;}).join(",")'), 'PL-RANA');
  eq('produced comes down by one lot, not two', b.producedKg, 1010);
}

/* ================= 7. the duplicate guard on logging a shift ================= */
{
  const c = app();
  run(c, 'state.role="Production"; state.shiftEntries=[]; state.productionLog=[];'
       + ' state.masters.incharges=(state.masters.incharges||[]).concat(["Muhammad Imran"]);'
       + ' openShiftLog("B-AP26012");'
       + ' shiftForm.shift="Morning"; shiftForm.incharge="Muhammad Imran";'
       + ' shiftForm.date="2026-08-22"; shiftForm.qty=300; submitShiftLog();');
  eq('the first log goes through', B(c).lots.length, 3);
  const was = B(c).producedKg;

  /* the same shift again */
  run(c, 'openShiftLog("B-AP26012"); shiftForm.shift="Morning"; shiftForm.incharge="Muhammad Imran";'
       + ' shiftForm.date="2026-08-22"; shiftForm.qty=300; toasts=[]; submitShiftLog();');
  eq('the repeat writes NOTHING the first time it is pressed', B(c).lots.length, 3);
  eq('...and produced does not move', B(c).producedKg, was);
  const t = run(c, 'toasts').join(' | ');
  ok('...it says what already exists', /Already logged/.test(t) && /Muhammad Imran/.test(t), t);
  ok('...and says how to go ahead anyway', /press Log output again to confirm/.test(t), t);

  /* pressing again confirms it */
  run(c, 'toasts=[]; submitShiftLog();');
  eq('pressing again logs the second run', B(c).lots.length, 4);
  eq('...and produced moves by exactly one shift', B(c).producedKg, was + 300);

  /* changing the incharge asks again rather than riding on the confirmation */
  run(c, 'state.masters.incharges=(state.masters.incharges||[]).concat(["Someone Else"]);'
       + ' shiftForm.incharge="Someone Else"; shiftForm.qty=100; toasts=[]; submitShiftLog();');
  eq('a different incharge is not a duplicate, so it logs', B(c).lots.length, 5);
  run(c, 'shiftForm.incharge="Someone Else"; shiftForm.qty=100; toasts=[]; submitShiftLog();');
  eq('...and repeating THAT one warns in its turn', B(c).lots.length, 5);
  ok('...with its own name in the message',
     /Someone Else/.test(run(c, 'toasts').join(' | ')), run(c, 'toasts').join(' | '));
}

console.log('\nAP26012 — pack a certified lot, remove a duplicate: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
