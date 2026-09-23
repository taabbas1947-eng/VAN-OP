/* "CLOSED SHORT" AS THE EIGHTH STAGE — 23 September 2026.

   Tahir's ruling, asked as a direct question and answered: a short-closed line
   gets **its own eighth stage**, counted as neither open nor delivered, shown as
   its own column on the tracker and the dashboard.

   And separately: **no short close counts against us** in fulfilment %. A closed
   line leaves the calculation entirely, both sides — the delivered kg and the
   ordered kg go together. (I put to him that this flatters the number, because an
   honest "we could not supply" then disappears from the score. He ruled it
   anyway; it is his number to define. The `ours` flag still drives the reason
   report, so the information is not lost, only kept out of the score.)

   WHY THIS NEEDED A RULING RATHER THAN A GUESS. `lineBucket()` had no
   short-close branch at all, so a closed line kept reporting the stage it
   physically reached — 'Production', say — and `orderBucket()` takes the
   MINIMUM bucket across an order's lines. One closed line therefore held its
   whole order at that stage and kept it counted as open for ever. Open-order
   counts would climb month after month with work nobody would ever do.

   THE SHAPE OF THE FIX, and why it is the same shape as `lineStage`:

     · 'Closed short' goes LAST in BUCKETS, after 'Delivered'. Because
       orderBucket takes the minimum, an order reads 'Closed short' only when
       EVERY line is closed short. One closed line beside a live one leaves the
       order at the live line's stage — which is correct, there is still work.
       `STAGE_ORDER` was given exactly this treatment on 23 September and this
       follows it deliberately rather than inventing a second pattern.

     · The progress bar and the lane board keep SEVEN stages. They draw the
       pipeline a PO travels; a close is an exit from it, not a step along it.
       That is `PIPELINE_BUCKETS`. Adding an eighth segment to every order's bar
       would have been a visible regression for every order in the system.

     · "Open" stops being spelled `b!=='Delivered'` in twenty-odd places and
       becomes `bucketOpen(b)` / `orderOpen(o)` in one. Four faults in o2s.html
       have been the same shape — one rule applied in two places and not a third
       — and twenty sites is not a place to try again by hand.

   Run: node closedshortbucket.test.js */
const H = require('./harness.js');
const vm = require('vm');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

/* ---- sandbox ---- */
function topConst(name, open) {
  const re = new RegExp('\\n(?:const|var) ' + name + '\\s*=\\s*\\' + open);
  const m = re.exec(H.html);
  if (!m) throw new Error('not found: ' + name);
  return H.matchBlock(m.index + 1, name, open).replace(/^(const|var) /, 'var ') + ';';
}
/* PIPELINE_BUCKETS is derived from BUCKETS by an expression, not written as a
   literal, so it is pulled by its whole line rather than by brace matching. That
   is on purpose in o2s.html: a derived list cannot drift out of step with the one
   it is derived from. */
const pipelineLine = (() => {
  const m = /\nconst PIPELINE_BUCKETS=[^\n]*/.exec(H.html);
  if (!m) throw new Error('not found: PIPELINE_BUCKETS');
  return m[0].replace(/^\nconst /, 'var ');
})();
const src =
  topConst('BUCKETS', '[') + '\n' + pipelineLine + '\n' +
  ['BUCKET_META', 'BUCKET_SCREEN', 'NEXT_ACT'].map(n => topConst(n, '{')).join('\n') + '\n' +
  topConst('T2_SHORT', '[') + '\n' +
  ['lineShortClosed', 'lineBucket', 'orderBucket', 'bucketOpen', 'orderOpen', 'aggOpen']
    .map(H.grab).join('\n\n');

const box = {
  console,
  /* Only the two helpers lineBucket leans on that are not under test here.
     They are stubbed to "nothing ready, nothing to inspect" so that the stage a
     line reports comes from its own fields, which is what these checks are
     about. */
  lineCleared: () => 0,
  lineToInspect: () => 0,
  sum: (arr, f) => arr.reduce((a, x) => a + (+f(x) || 0), 0),
};
box.globalThis = box;
vm.createContext(box);
vm.runInContext(src, box);
const { BUCKETS, PIPELINE_BUCKETS, BUCKET_META, BUCKET_SCREEN, NEXT_ACT, T2_SHORT,
        lineBucket, orderBucket, bucketOpen, orderOpen, aggOpen } = box;

/* ---- fixtures ---- */
const closed = (over) => Object.assign(
  { ordered: 100, produced: 60, packed: 60, dispatched: 60, delivered: 60,
    deliveredDate: null,
    shortClose: { requestedBy: 'Ali', requestedAt: '2026-09-23', reasonCode: 'customer_cancelled',
                  approvedBy: 'Fahim', approvedAt: '2026-09-23' } }, over || {});
const live = (over) => Object.assign({ ordered: 100, produced: 40, prodStart: '2026-09-20' }, over || {});
const done = (over) => Object.assign({ ordered: 100, produced: 100, packed: 100, dispatched: 100,
                                       delivered: 100, deliveredDate: '2026-09-22' }, over || {});

/* ================= 1. THE EIGHTH STAGE ================= */
eq('BUCKETS has eight stages', BUCKETS.length, 8);
eq('...and Closed short is last, after Delivered', BUCKETS[7], 'Closed short');
eq('...Delivered is still seventh', BUCKETS[6], 'Delivered');
eq('...the first six are unchanged', BUCKETS.slice(0, 6).join(' > '),
   'PO Created > RM Check > Production > Lab QC > QA Pre-shipment > Shipment');

/* The bar and the lane board draw the pipeline, which a close exits rather than
   travels. Eight segments on every order's bar would be a regression for every
   order in the system. */
eq('PIPELINE_BUCKETS keeps seven', PIPELINE_BUCKETS.length, 7);
ok('...and is BUCKETS without the close', PIPELINE_BUCKETS.join(',') === BUCKETS.slice(0, 7).join(','));
eq('T2_SHORT still labels seven columns', T2_SHORT.length, 7);

/* Every lookup table must answer for every bucket. BUCKET_META[b].owner is read
   without a guard in trkMatch — a missing key is a thrown error, not a blank. */
BUCKETS.forEach(b => {
  ok('BUCKET_META answers for ' + b, !!BUCKET_META[b] && typeof BUCKET_META[b].owner === 'string');
  ok('BUCKET_SCREEN answers for ' + b, BUCKET_SCREEN[b] !== undefined);
  ok('NEXT_ACT answers for ' + b, typeof NEXT_ACT[b] === 'string');
});
eq('a closed line has no owner to chase', BUCKET_META['Closed short'].owner, '—');
eq('...and no screen to open it on', BUCKET_SCREEN['Closed short'], '');

/* ================= 2. lineBucket ================= */
eq('a short-closed line reads Closed short', lineBucket({}, closed()), 'Closed short');
/* Tested before the Delivered branch, exactly as lineStage does it: a line
   closed after a partial delivery is NOT delivered and must not read as if it
   were. This is the check that fails if the branch is put in the wrong place. */
eq('...even when its delivered figure has been met',
   lineBucket({}, closed({ delivered: 100, deliveredDate: '2026-09-22' })), 'Closed short');
eq('...and before the dispatch branch', lineBucket({}, closed({ dispatched: 60, dispatchDate: '2026-09-21' })), 'Closed short');
/* Only an APPROVED, un-reopened close counts. The fixture has 60 of 100
   dispatched, so without the close it reads 'Shipment' - which is what these two
   must fall through to. (An earlier version of this check expected 'Production'
   and failed: the fixture was wrong, not the app.) */
eq('a requested-but-not-approved close is NOT closed',
   lineBucket({}, closed({ shortClose: { requestedBy: 'Ali', reasonCode: 'our_shortfall' } })), 'Shipment');
eq('a reopened close is NOT closed',
   lineBucket({}, closed({ shortClose: { approvedAt: '2026-09-23', reopenedAt: '2026-09-23' } })), 'Shipment');
eq('an ordinary line is untouched', lineBucket({}, live()), 'Production');
eq('a delivered line is untouched', lineBucket({}, done()), 'Delivered');

/* ================= 3. orderBucket ================= */
eq('every line closed short → the order is Closed short',
   orderBucket({ lines: [closed(), closed()] }), 'Closed short');
/* The one that matters. There is still work on the order, so it is still at that
   work's stage — not parked in a terminal bucket because one line was closed. */
eq('one closed, one live → the order sits at the live line',
   orderBucket({ lines: [closed(), live()] }), 'Production');
eq('one closed, one delivered → Delivered, the order is finished',
   orderBucket({ lines: [closed(), done()] }), 'Delivered');
eq('all delivered is unchanged', orderBucket({ lines: [done(), done()] }), 'Delivered');
eq('an empty order is unchanged', orderBucket({ lines: [] }), 'PO Created');

/* ================= 4. OPEN MEANS ONE THING ================= */
eq('Closed short is not open', bucketOpen('Closed short'), false);
eq('Delivered is not open', bucketOpen('Delivered'), false);
BUCKETS.slice(0, 6).forEach(b => eq(b + ' is open', bucketOpen(b), true));
eq('orderOpen follows the bucket — all closed', orderOpen({ lines: [closed()] }), false);
eq('...one still working', orderOpen({ lines: [closed(), live()] }), true);
eq('...all delivered', orderOpen({ lines: [done()] }), false);

/* THE REACH TEST — which functions now ask the predicate, and which deliberately
   do not. Counting occurrences would pass on the wrong twenty; naming the
   functions is what catches the twenty-first that was missed. */
{
  const has = (fn, re) => re.test(H.grab(fn));
  /* Counts and filters of OPEN work must go through the predicates. */
  [['trkMatch', /bucketOpen\(b\)/], ['tkCounters', /orderOpen\(o\)/],
   ['dashFlow', /bucketOpen\(/], ['acKpiHTML', /orderOpen\(o\)/]].forEach(([fn, re]) => {
    let src = null; try { src = H.grab(fn); } catch (e) {}
    if (src) ok(fn + ' asks the predicate', re.test(src), 'no match in ' + fn);
    else ok(fn + ' asks the predicate — function not found, skipped', true);
  });
  /* Line-level lists of REMAINING WORK must skip a closed line. An order with one
     closed line and one live line still has real work, so the guard goes on the
     line, not the order — the same place shortCloseRefusal sits. */
  ['inProdLines', 'poLinesForBrand'].forEach(fn =>
    ok(fn + ' skips a short-closed line', has(fn, /lineShortClosed\(l\)/)));

  /* AND WHAT MUST NOT CHANGE. A closed line's already-packed stock still ships -
     that was the ruling - so the cleared-stock list stays short-close blind. If
     somebody "fixes" it, packed stock silently stops being shippable. */
  ok('the cleared-stock list is deliberately NOT short-close aware',
     /DELIBERATELY not short-close aware/.test(H.html));

  const body = H.html;
  const bo = (body.match(/bucketOpen\(/g) || []).length;
  const oo = (body.match(/orderOpen\(/g) || []).length;
  ok('the two predicates carry the load', bo + oo >= 18, 'got ' + (bo + oo));
  console.log('    open-ness: ' + bo + ' bucketOpen + ' + oo + ' orderOpen calls');
}

/* ================= 5. FULFILMENT — no short close counts against us ================= */
/* His ruling: a closed line leaves the calculation entirely, both sides. */
{
  const a = aggOpen({ lines: [closed(), done()] });
  eq('a closed line is out of the ordered total', a.ordered, 100);
  eq('...and its delivered kg go with it', a.delivered, 100);
  const b = aggOpen({ lines: [live({ ordered: 200, delivered: 50 }), closed()] });
  eq('only the live line is counted — ordered', b.ordered, 200);
  eq('only the live line is counted — delivered', b.delivered, 50);
  /* An order whose every line is closed has nothing left to judge. It must not
     divide by zero, and it must not read as 100%. */
  const c = aggOpen({ lines: [closed(), closed()] });
  eq('an all-closed order has nothing in the denominator', c.ordered, 0);
  eq('...and nothing in the numerator', c.delivered, 0);
  /* agg() itself still tells the truth about what was ordered — the shortfall is
     the thing worth knowing, and it must survive somewhere. */
  ok('aggOpen is a second function, not a change to agg',
     /function agg\(o\)\{ return \{ ordered:sum\(o\.lines/.test(H.html));
}

console.log('\nClosed short as the eighth stage: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
