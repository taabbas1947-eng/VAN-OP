/* THE SHORT-CLOSE REPORT — shortfall by reason and by month. 23 September 2026.

   The last open item on the short-close feature. It was blocked on the BUCKETS
   ruling and is not blocked any more.

   IT IS A DATASET, NOT A SCREEN. Reports already has a Report Builder driven by
   `RB_DATASETS`: each entry declares its rows, its dimensions and measures, its
   date key and its filters, and the builder supplies grouping, the period bar,
   summarise, chart and export. "By reason and by month" is then two dimensions
   the user picks, not two hard-coded reports that go stale the first time he
   wants it by client instead. Nine datasets already work this way; this is the
   tenth, and it is about sixty lines rather than a new screen.

   THREE THINGS THIS FILE PINS THAT ARE EASY TO GET WRONG:

   1. THE FIGURES ARE THE FROZEN ONES. `shortClose.orderedAtClose` and
      `deliveredAtClose` are written when the close is approved precisely so the
      shortfall still reads correctly a year later if the line's own numbers move
      underneath it. A report that read `l.ordered` would drift away from the
      decision it is reporting on.

   2. A REOPENED CLOSE IS STILL A ROW, WITH A ZERO SHORTFALL. It happened, and
      hiding it would make the reopen invisible; but counting its kg as shortfall
      would double-count work that went back into production. So it carries
      status 'Reopened', shortfall 0, and its kg sit in a separate `reopened`
      measure. Summing shortfall by reason is therefore honest with no filter
      applied - which is the only way a default view can be trusted.

   3. 'OURS' FOLLOWS THE REASON, AND AN UNREASONED CLOSE COUNTS AGAINST US.
      Same rule as `shortCloseAgainstUs`, not a second copy of the judgement.

   Run: node shortclosereport.test.js */
const H = require('./harness.js');
const vm = require('vm');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

/* ---- pull just the one dataset entry out of RB_DATASETS ---- */
const dsSrc = (() => {
  const i = H.html.indexOf('\n  shortclose:{');
  if (i < 0) throw new Error('not found: RB_DATASETS.shortclose');
  /* matchBlock slices from the index it is GIVEN, not from the brace it finds -
     grabTopVar relies on that to keep the `var NAME =` in front. So the entry's
     own `shortclose:` label has to be trimmed off here, or the sandbox is asked
     to evaluate a labelled statement and dies on the colon. */
  const blk = H.matchBlock(i, 'shortclose', '{');
  return 'var DS=' + blk.slice(blk.indexOf('{')) + ';';
})();

const box = { console };
box.globalThis = box;
vm.createContext(box);
vm.runInContext(
  H.grabTopVar('SHORTCLOSE_REASONS', '[') + '\n' +
  ['scReason', 'lineShortClosed', 'shortCloseGap', 'shortCloseAgainstUs'].map(H.grab).join('\n') +
  '\nvar state={orders:[]};\n' + dsSrc, box);
const DS = box.DS;

/* ---- fixtures ---- */
const sc = (over) => Object.assign({
  requestedBy: 'Ali Raza', requestedAt: '2026-08-10',
  approvedBy: 'Fahim Asghar', approvedAt: '2026-08-12',
  reasonCode: 'customer_cancelled', orderedAtClose: 100, deliveredAtClose: 60,
}, over || {});
const line = (over) => Object.assign({ brand: 'Vital Potash', base: 'Potassium Humate',
                                       ordered: 100, delivered: 60 }, over || {});
const order = (lines, over) => Object.assign({ po: 'PO-1', client: 'Excel Chemical',
                                               channel: 'Distributor', lines }, over || {});
const run = (orders) => { box.state.orders = orders; return DS.rows(); };

/* ================= 1. THE DATASET IS REGISTERED AND SHAPED ================= */
ok('RB_DATASETS carries a shortclose entry', /\n  shortclose:\{/.test(H.html));
ok('...with a label naming the shortfall', /label:'[^']*[Ss]hort/.test(dsSrc), DS.label);
eq('...keyed on the date the close was approved', DS.dateKey, 'date');
ok('...and declares its fields', Array.isArray(DS.fields) && DS.fields.length >= 10);
ok('...and its filters', Array.isArray(DS.filters) && DS.filters.length >= 4);

{
  const dims = DS.fields.filter(f => f.t === 'dim').map(f => f.k);
  const meas = DS.fields.filter(f => f.t === 'meas').map(f => f.k);
  /* "By reason and by month" is these two being groupable dimensions. Without
     `month` as a dimension of its own the builder can only group by the exact
     date, which for a report read once a quarter is no grouping at all. */
  ok('reason is a dimension', dims.indexOf('reason') > -1, dims.join(','));
  ok('month is a dimension', dims.indexOf('month') > -1, dims.join(','));
  ['po', 'client', 'product', 'side', 'status'].forEach(k =>
    ok(k + ' is a dimension', dims.indexOf(k) > -1, dims.join(',')));
  ['shortfall', 'reopened', 'ordered', 'delivered'].forEach(k =>
    ok(k + ' is a measure', meas.indexOf(k) > -1, meas.join(',')));
  ['reason', 'side', 'status', 'client'].forEach(k =>
    ok(k + ' can be filtered', DS.filters.indexOf(k) > -1, DS.filters.join(',')));
  /* Every declared field must exist on a row, or a column silently shows "—"
     for ever and nobody can tell a missing value from a missing field. */
  const r = run([order([line({ shortClose: sc() })])])[0];
  DS.fields.forEach(f => ok('rows carry the declared field ' + f.k, r[f.k] !== undefined));
}

/* ================= 2. WHICH LINES APPEAR ================= */
eq('an approved close is a row', run([order([line({ shortClose: sc() })])]).length, 1);
eq('a line with no close is not', run([order([line()])]).length, 0);
/* Asked for but not yet approved is a pending decision, not a closed line. It
   belongs in My Actions, where it already is, not in the shortfall report. */
eq('a requested-but-unapproved close is not a row',
   run([order([line({ shortClose: sc({ approvedAt: null, approvedBy: null }) })])]).length, 0);
eq('a reopened close IS a row', run([order([line({ shortClose: sc({ reopenedAt: '2026-09-01' }) })])]).length, 1);
eq('several orders and lines all come through',
   run([order([line({ shortClose: sc() }), line({ shortClose: sc() })]),
        order([line({ shortClose: sc() })], { po: 'PO-2' })]).length, 3);

/* ================= 3. THE FIGURES ARE THE FROZEN ONES ================= */
{
  /* The line's own numbers have moved since the close. The report must still
     report the close. */
  const r = run([order([line({ ordered: 500, delivered: 480,
                               shortClose: sc({ orderedAtClose: 100, deliveredAtClose: 60 }) })])])[0];
  eq('ordered is the figure at the close, not today', r.ordered, 100);
  eq('delivered is the figure at the close', r.delivered, 60);
  eq('shortfall is the gap between them', r.shortfall, 40);
  eq('...and matches shortCloseGap exactly', r.shortfall,
     box.shortCloseGap({ shortClose: sc({ orderedAtClose: 100, deliveredAtClose: 60 }) }));
}

/* ================= 4. A REOPEN COSTS NOTHING AND HIDES NOTHING ================= */
{
  const r = run([order([line({ shortClose: sc({ reopenedAt: '2026-09-01' }) })])])[0];
  eq('a reopened close is marked as such', r.status, 'Reopened');
  eq('...contributes no shortfall', r.shortfall, 0);
  eq('...but its kg are still visible', r.reopened, 40);
  const c = run([order([line({ shortClose: sc() })])])[0];
  eq('a live close is marked Closed', c.status, 'Closed');
  eq('...carries the shortfall', c.shortfall, 40);
  eq('...and nothing in reopened', c.reopened, 0);
  /* The point of the split: summing shortfall with no filter is honest. */
  const rows = run([order([line({ shortClose: sc() }),
                           line({ shortClose: sc({ reopenedAt: '2026-09-01' }) })])]);
  eq('shortfall summed over both is the closed one only',
     rows.reduce((s, x) => s + x.shortfall, 0), 40);
  eq('...and reopened summed is the other', rows.reduce((s, x) => s + x.reopened, 0), 40);
}

/* ================= 5. REASON, SIDE AND MONTH ================= */
{
  const r = run([order([line({ shortClose: sc({ reasonCode: 'customer_cancelled' }) })])])[0];
  eq('the reason is spelled out, not left as a code', r.reason, 'Customer cancelled the balance');
  eq('a customer-side close is not ours', r.side, 'Customer');
  const o = run([order([line({ shortClose: sc({ reasonCode: 'our_shortfall' }) })])])[0];
  eq('our own shortfall is ours', o.side, 'Ours');
  eq('...and says so plainly', o.reason, 'We could not supply');
  /* Same rule as shortCloseAgainstUs, not a second copy of the judgement: an
     unreasoned close must never quietly improve the numbers. */
  const u = run([order([line({ shortClose: sc({ reasonCode: '' }) })])])[0];
  eq('a close with no reason counts against us', u.side, 'Ours');
  ok('...and says the reason is missing rather than showing a blank',
     /no reason/i.test(String(u.reason)), u.reason);

  eq('month is the year and month of the approval', r.month, '2026-08');
  eq('date is the approval date', r.date, '2026-08-12');
  eq('the request date is kept too', r.requestedon, '2026-08-10');
  eq('who asked', r.requestedby, 'Ali Raza');
  eq('who approved', r.approvedby, 'Fahim Asghar');
}

/* ================= 6. BY REASON AND BY MONTH ================= */
/* The question the report was asked for, answered by grouping the rows the
   builder would group. Two months, two reasons, one reopen that must not count. */
{
  const rows = run([
    order([line({ shortClose: sc({ approvedAt: '2026-08-12', reasonCode: 'customer_cancelled',
                                  orderedAtClose: 100, deliveredAtClose: 60 }) }),
           line({ shortClose: sc({ approvedAt: '2026-08-20', reasonCode: 'our_shortfall',
                                  orderedAtClose: 200, deliveredAtClose: 150 }) })]),
    order([line({ shortClose: sc({ approvedAt: '2026-09-03', reasonCode: 'customer_cancelled',
                                  orderedAtClose: 80, deliveredAtClose: 30 }) }),
           line({ shortClose: sc({ approvedAt: '2026-09-05', reasonCode: 'our_shortfall',
                                  orderedAtClose: 90, deliveredAtClose: 90, reopenedAt: '2026-09-09' }) })],
          { po: 'PO-2' })]);
  const by = (a, b) => {
    const m = {};
    rows.forEach(r => { const k = r[a] + ' / ' + r[b]; m[k] = (m[k] || 0) + r.shortfall; });
    return Object.keys(m).sort().map(k => k + ' = ' + m[k]).join(' | ');
  };
  eq('shortfall by month and reason',
     by('month', 'reason'),
     '2026-08 / Customer cancelled the balance = 40 | 2026-08 / We could not supply = 50 | '
   + '2026-09 / Customer cancelled the balance = 50 | 2026-09 / We could not supply = 0');
  const side = {};
  rows.forEach(r => { side[r.side] = (side[r.side] || 0) + r.shortfall; });
  eq('...and split by whose fault it was', side.Customer + ' customer / ' + side.Ours + ' ours',
     '90 customer / 50 ours');
}

console.log('\nShort-close report — shortfall by reason and by month: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
