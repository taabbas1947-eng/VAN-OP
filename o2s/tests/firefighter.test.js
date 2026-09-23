/* THE FIREFIGHTER DASHBOARD — P6, the night of 23 September 2026.

   Tahir: "the system dashboard is actually a Firefighter dashboard: a dedicated
   screen highlighting delayed orders, material bottlenecks, or shipping holds so
   staff can react instantly." And P2: "traffic-light systems, real-time status
   bars instead of raw data rows."

   dashFireHtml() is the first tab of the Dashboard and the default for every
   role. Three fires, each with a count, a colour and the worst case on top:
     delayed orders     - order lines past their promised date, days late
     material bottlenecks - lines waiting on raw material (short / partial /
                            an open PR), and what is blocked behind them
     shipping holds     - trucks waiting on QA, a gate pass, a release, a DC
                          approval, or a delivery confirmation
   Every row carries the job's own action, so a fire is put out from here.
   It reads actionItems(), orders and dispatchGroups(); it writes nothing.

   Run: node firefighter.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

ok('dashFireHtml exists', grab('dashFireHtml').length > 400);
ok('it is the first dashboard tab', /\[\['fire','Firefighter'\],\['overview','Overview'\]/.test(grab('dashTabBar')));
ok('it is the default for everyone', /return 'fire'/.test(grab('dashDefaultTab')) && !/return 'overview'; \}$/.test(grab('dashDefaultTab').trim()));
ok('screenDash renders it', /dashTab==='fire'\?dashFireHtml\(\)/.test(grab('screenDash')));
const fires = grab('fireLists');
ok('the three fires are computed in one place', fires.length > 300);
ok('delayed orders come from the overdue lines', /lineOverdue\(o,l\)/.test(fires));
ok('material bottlenecks come from RM status and open PRs', /rmStatus/.test(fires) && /rmPR/.test(fires));
ok('shipping holds come from the dispatch pipeline', /dispatchGroups\(\)/.test(fires) && /qa==='pending'/.test(fires) && /gatePass/.test(fires));
ok('every row carries the action that puts the fire out', /act:/.test(fires));
ok('rows are sorted worst first', /sort\(/.test(fires));
ok('the screen shows a traffic light per fire', /fireLight\(/.test(grab('dashFireHtml')) && /function fireLight\(/.test(html));
ok('no money on the Firefighter', !/pkr\(|invoicePrice/.test(grab('dashFireHtml') + fires));

/* run fireLists on a small state */
{
  const b = { console, TODAY: new Date('2026-09-23T09:00:00'),
    state: { orders: [
      { id: 'o1', po: 'P1', client: 'A', promised: '2026-09-01', lines: [ { id: 'l1', brand: 'X', committed: '2026-09-01', ordered: 100, produced: 0, rmStatus: 'short', rmPR: { qty: 100, cfoApproved: false } }, { id: 'l2', brand: 'Y', committed: '2026-10-01', ordered: 50, produced: 50, rmStatus: 'full' } ] },
      { id: 'o2', po: 'P2', client: 'B', promised: '2026-09-20', lines: [ { id: 'l3', brand: 'Z', committed: '2026-09-20', ordered: 10, produced: 0, rmStatus: 'partial' } ] } ],
      prs: [] },
    lineOverdue: (o, l) => l.committed < '2026-09-23' && (l.produced || 0) < (l.ordered || 0),
    lineShortClosed: () => false, lineBucket: () => 'Production', fmt: n => String(n),
    dispatchGroups: () => [ { dispId: 'D1', po: 'P1', client: 'A', stage: 'loading', gatePass: '', qa: 'pass', dcStatus: 'approved', rows: [1], kg: 500, date: '2026-09-21', delivered: false },
                            { dispId: 'D2', po: 'P2', client: 'B', stage: 'loading', gatePass: 'GP1', qa: 'pending', dcStatus: 'approved', rows: [1, 2], kg: 900, date: '2026-09-22', delivered: false },
                            { dispId: 'D3', po: 'P2', client: 'B', stage: 'in_transit', gatePass: 'GP2', qa: 'pass', dcStatus: 'pending', rows: [1], kg: 100, date: '2026-09-10', delivered: false } ] };
  vm.createContext(b); vm.runInContext(fires, b);
  const f = b.fireLists();
  eq('2 delayed lines', f.delayed.length, 2);
  eq('worst first: 22 days late', f.delayed[0].days, 22);
  eq('2 material bottlenecks', f.material.length, 2);
  ok('the one with an unapproved PR says so', /PR/.test(f.material.find(r => r.po === 'P1').why));
  eq('3 shipping holds', f.holds.length, 3);
  ok('a truck without a gate pass is a hold', f.holds.some(r => /gate pass/i.test(r.why)));
  ok('a truck waiting on QA is a hold', f.holds.some(r => /inspection/i.test(r.why)));
  ok('a DC waiting for approval is a hold', f.holds.some(r => /DC/.test(r.why)));
  ok('holds are sorted oldest first', f.holds[0].dispId === 'D3');
}

process.exitCode = report('The Firefighter dashboard') ? 1 : 0;
