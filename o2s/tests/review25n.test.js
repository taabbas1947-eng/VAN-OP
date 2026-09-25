/* 25n — fixes from the second round of independent review (25 Sep 2026).
   Run: node review25n.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, html } = H;
/* kg on a truck not yet out is not free to backfill */
{ const b = { console, state: { shipments: [
    { po: 'P', lid: 'L', brand: 'X', kg: 200, stage: 'truck_planned', dispId: 'D1' },
    { po: 'P', lid: 'L', brand: 'X', kg: 50, stage: 'loading', dispId: 'D2' },
    { po: 'P', lid: 'L', brand: 'X', kg: 30, dcStatus: 'pending', dispId: 'D3' },
    { po: 'P', lid: 'L', brand: 'X', kg: 999, stage: 'in_transit', dispCounted: true, dispId: 'D4' },
    { po: 'P', lid: 'L', brand: 'X', kg: 999, stage: 'truck_planned', voided: true, dispId: 'D5' },
    { po: 'P', lid: 'M', brand: 'X', kg: 999, stage: 'truck_planned', dispId: 'D6' }] } };
  vm.createContext(b); vm.runInContext(grab('lineOnTruckKg'), b);
  eq('planned + loading + old-style pending, not counted or voided or other lines', b.lineOnTruckKg({ po: 'P' }, { id: 'L', brand: 'X' }), 280); }
ok('the backfill room takes off what is on a truck', /-_onT\)/.test(grab('dfSubmitShipment')) && /lid:l\.id/.test(grab('dfSubmitShipment')));
/* old trucks with a dispatch id count as sold */
{ const b = { console }; vm.createContext(b); vm.runInContext(grab('saleLeft'), b);
  ok('an old approved truck with a dispatch id is a sale', b.saleLeft({ dispId: 'DSP1477', dcStatus: 'approved', kg: 10 }));
  ok('an old truck waiting approval is not', !b.saleLeft({ dispId: 'X', dcStatus: 'pending' }));
  ok('an old truck that failed inspection is not', !b.saleLeft({ dispId: 'X', dcStatus: 'approved', qa: { fail: true } }));
  ok('a planned staged truck is not', !b.saleLeft({ dispId: 'X', stage: 'truck_planned', dcStatus: 'pending' }));
  ok('a voided one is not', !b.saleLeft({ voided: true, dcStatus: 'approved' })); }
/* a plain-name target for a split customer is not counted twice */
{ const b = { console, BUDGET_SEP: ' @ ', state: { orders: [{ client: 'BKK', channel: 'Distributor' }, { client: 'BKK', channel: 'White Label' }, { client: 'SYN', channel: 'White Label' }], customers: [] }, budgetKey: o => o.client, SEGMENT_CHANNEL: {} };
  vm.createContext(b); vm.runInContext(['budgetSplitKey', 'budgetChannelsOfName', 'budgetKeyLive'].map(grab).join('\n'), b);
  ok('BKK @ White Label counts', b.budgetKeyLive('BKK @ White Label'));
  ok('plain BKK does not, once it is split', !b.budgetKeyLive('BKK'));
  ok('a one-channel customer counts', b.budgetKeyLive('SYN')); }
ok('allocations, the split total and How are we doing skip it', /budgetKeyLive\(c\)/.test(grab('budgetByChannel')) && /budgetKeyLive\(k\)/.test(grab('sbData')) && /budgetKeyLive\(c\)/.test(grab('howSales')));
/* numbers are never issued twice */
{ const b = { console, state: { shipments: [{ dc: '5075' }, { dc: '5076', gatePass: 'GP-0002', voided: true }] } };
  vm.createContext(b); vm.runInContext(grab('nextDCNo') + grab('nextGatePassNo'), b);
  eq('a voided truck’s DC number is not reused', b.nextDCNo(), '5077'); eq('nor its gate pass', b.nextGatePassNo(), 'GP-0003'); }
/* the delivery ladder can act */
{ const g = { dispId: 'D', po: 'P', rows: [{ gatePassByUser: 'shoaib', gatePassBy: 'Shoaib', gatePassByRole: 'Warehouse' }], approvedDate: '2026-09-22' };
  const mk = (role, user, right) => { const b = { console, state: { role }, may: () => right, dispatchGroups: () => [g], _uRole: () => ({ user }), evToday: () => '2026-09-25', usersList: [] };
    vm.createContext(b); vm.runInContext(['truckDispatcher', '_calDays', 'deliveryJobs', 'deliveryMayConfirm'].map(grab).join('\n'), b); return b; };
  ok('the Plant Manager can confirm once it has reached him', mk('Plant Manager', 'fahim', false).deliveryMayConfirm('D'));
  ok('Saad can from day 1', mk('Supply Chain', 'saad', false).deliveryMayConfirm('D'));
  ok('another warehouse user without the right cannot', !mk('Warehouse', 'zain', false).deliveryMayConfirm('D'));
  ok('the dispatcher can', mk('Warehouse', 'shoaib', false).deliveryMayConfirm('D'));
  ok('the opener and the writer both use it', /deliveryMayConfirm\(dispId\)/.test(grab('openDeliveryConfirm')) && /deliveryMayConfirm\(delivForm\.dispId\)/.test(grab('confirmDelivery'))); }
ok('one inspection per truck; not on a voided or gone truck', /filter\(function\(s\)\{ return s&&!s\.voided; \}\)/.test(grab('dispQASubmit')) && /already been inspected, or has left the gate/.test(grab('dispQASubmit')));
ok('an old DC waiting approval or inspection is not edited', /r\.s\.dcStatus==='pending'\|\|r\.s\.qa===null/.test(grab('saveShipEdit')) && /before:_before/.test(grab('saveShipEdit')));
ok('only a DC still waiting can be rejected', /Only a DC still waiting for approval can be rejected/.test(grab('rejectDC')));
ok('the Plant Manager does not cancel trucks; a truck out of the gate is the COO’s', /state\.role!=='Plant Manager'/.test(grab('cancelShip')) && /Only the COO can cancel it now/.test(grab('cancelShip')));
ok('the gate pass job waits for QA; an old truck in transit gets its delivery job', /st==='loading' && !g\.gatePass && g\.qa!=='pending' && g\.qa!=='fail'/.test(grab('actionItems')) && /stN==='in_transit' && !g\.delivered/.test(grab('actionItems')));
ok('New order keeps KAM, priority, PO # and dates when the price-on-pack answer redraws it', /entrySnap\(\); screenEntry\(\); entryRestore/.test(grab('setPrintOn')) && /entrySnap\(\); screenEntry\(\); entryRestore/.test(grab('onClientChange')) && /'e_kam','e_pri','e_po','e_recv','e_prom'/.test(html));
ok('New order lists what is still needed', /Still needed before you can submit/.test(grab('validate')) && /<div id="e_missing"><\/div>/.test(html));
ok('TODAY is Pakistan time and moves on', /var TODAY = new Date\(Date\.now\(\)\+5\*3600000\);/.test(html) && /TODAY=new Date\(Date\.now\(\)\+5\*3600000\)/.test(html) && !/TODAY\.getFullYear\(\)|TODAY\.getMonth\(\)/.test(html));
ok('How are we doing: the stuck tiles add up; repeated jobs listed once', /other stages · oldest/.test(grab('screenHow')) && /findIndex/.test(grab('howStuck')));
ok('Sales & Budget: covers % stops once the budget is reached; phone keeps Sold', /the FY budget is already reached/.test(grab('budgetHtml')) && /sb-hide2/.test(grab('budgetHtml')));
process.exitCode = report('Fixes from the second independent review (25n)') ? 1 : 0;
