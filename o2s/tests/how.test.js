/* 25h — How are we doing (the Dashboard, reimagined with Tahir).
   Run: node how.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, html, grabTopVar } = H;
const sb = { console, TODAY: new Date('2026-09-24T10:00:00'), fmt: n => String(n), qsEsc: x => String(x == null ? '' : x),
  fyKey: d => (String(d) < '2026-07' ? '2025-26' : '2026-27'), lineShortClosed: () => false, usersList: [{ role: 'Warehouse', name: 'Muhammad Shoaib' }],
  lineOverdue: (o, l) => String(l.committed) < '2026-09-24' && (+l.delivered || 0) < (+l.ordered || 0),
  saleRows: () => [{ month: '2026-09', fy: '2026-27', value: 100 }, { month: '2026-08', fy: '2026-27', value: 300 }, { month: '2026-05', fy: '2025-26', value: 999 }],
  saleOpenValue: (o, l) => Math.max(0, (+l.ordered || 0) - (+l.dispatched || 0)) * 10, monthlyTargetTotals: () => ({ '2026-09': 200 }), budgetByChannel: () => [],
  actionItems: () => [{ label: 'Gate Pass', role: 'Warehouse', what: 'Issue Gate Pass — P1', _d: 5 }, { label: 'Lab QC', role: 'Lab Rep', what: 'Lab COA — X', _d: 1 }],
  actTiming: it => ({ days: it._d }), acStageOf: l => (l === 'Gate Pass' ? 'Shipment' : 'Lab QC'), psiRegisterRows: () => [{ date: '2026-09-10', pass: false }, { date: '2026-08-10', pass: true }], labLateBy: () => 0,
  state: { role: 'CFO', masters: { salesTargets: { A: { '2026-27': 1600 } } },
    orders: [{ po: 'P1', client: 'A', promised: '2026-09-01', lines: [
      { brand: 'X', ordered: 10, delivered: 10, dispatched: 10, committed: '2026-09-05', deliveredDate: '2026-09-04' },
      { brand: 'Y', ordered: 10, delivered: 10, dispatched: 10, committed: '2026-08-05', deliveredDate: '2026-08-09' },
      { brand: 'Z', ordered: 10, delivered: 0, dispatched: 0, committed: '2026-09-20' } ] }],
    batches: [{ lots: [{ coa: { status: 'approved', approvedDate: '2026-09-02' } }, { coa: { status: 'approved', approvedDate: '2026-09-03', rejected: { why: 'x' } } }, { coa: { status: 'approved', approvedDate: '2026-09-03', repOf: { lotNo: 'L1' } } }, { coa: { status: 'failed' } }] }] } };
vm.createContext(sb);
vm.runInContext(grabTopVar('HOW_ROLES', '[') + ['howMay', 'howPeriod', 'howIn', 'howSales', 'howOnTime', 'howStuck', 'howQuality'].map(grab).join('\n'), sb);
eq('who may see it: COO, CFO, Plant Manager', sb.HOW_ROLES.join(','), 'COO,CFO,Plant Manager');
const S = sb.howSales();
eq('sold this month (net, trucks out)', S.soldM, 100); eq('sold this FY', S.soldF, 400); eq('FY budget', S.tF, 1600); eq('% of budget', S.pctF, 25);
eq('month target and %', S.tM + ' ' + S.pctM, '200 50'); eq('open orders still to leave', S.open, 100);
ok('share of the year gone is about 23% on 24 Sep', Math.abs(S.gone - 85 / 365) < 0.01);
const O = sb.howOnTime();
eq('on time this month: 1 of 1', O.m.ok + '/' + O.m.n, '1/1'); eq('on time this FY: 1 of 2 = 50%', O.pf, 50);
eq('lines past promise now', O.late.length, 1); eq('...worth', O.lateVal, 100);
const K = sb.howStuck();
eq('oldest wait first, with the person', K.top[0].days + ' ' + K.top[0].who, '5 Muhammad Shoaib'); eq('3 days or more', K.over, 1);
const Q = sb.howQuality();
eq('first-time pass: copies of a tested lot are not counted; a rejected one is not first-time', Q.f.first + '/' + Q.f.n, '1/2');
eq('unfit now', Q.failedNow, 1); eq('trucks failed inspection this month', Q.ins.m.fail + '/' + Q.ins.m.n, '1/1');
ok('the old Dashboard is How are we doing', /function screenDash\(\)\{ screenHow\(\); \}/.test(html));
ok('Sales & Budget still opens, without the old tabs', /function screenBudget\(\)\{ dashTab='sales'; screenDashOld\(\); \}/.test(html) && /state\.screen==='budget'\)\?'':dashTabBar\(\)/.test(html));
ok('the screen owners are the 3 leaders', /\{id:'dash', name:'How are we doing'[^}]*owners:\['Plant Manager','CFO','COO'\]/.test(html));
ok('anyone else is told where their work is', /This page is for the COO, the CFO and the Plant Manager/.test(grab('screenHow')));
ok('each block opens the detail behind it', ["setScreen('budget')", "rpOpen('late')", "setScreen('plant')", "rpOpen('coa')"].every(x => grab('screenHow').indexOf(x) > -1));
ok('a truck for a PSI-with-DC customer says so on its jobs and card', /pre-shipment report goes with the DC/.test(grab('actionItems')) && /pre-shipment report goes with the DC/.test(grab('shipCard')));
ok('Saad reviews from the truck card; the Plant Manager approves there', /reviewTruck\(/.test(grab('shipCard')) && /Approve DC &amp; release/.test(grab('shipCard')));
process.exitCode = report('How are we doing (25h)') ? 1 : 0;
