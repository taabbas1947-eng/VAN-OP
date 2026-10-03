/* 25m — the fixes from the independent review (bugs agent, 25 Sep 2026).
   Run: node review25m.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, html } = H;
/* dates, Pakistan time: TODAY is "now" shifted to local, as the app builds it */
{ const now = new Date('2026-09-25T04:30:00Z'); /* 09:30 in Karachi */
  const sb = { console, TODAY: new Date(now.getTime() + 5 * 3600000), state: {}, Date: class extends Date { getTimezoneOffset() { return -300; } } };
  vm.createContext(sb); vm.runInContext(['evToday', 'localDateOf', 'calDays', 'ymdUTC', 'evDaysLate', 'periodWindow'].map(grab).join('\n'), sb);
  eq('today is today', sb.evToday(), '2026-09-25');
  eq('an entry dated today is 0 days late at 09:30', sb.evDaysLate('2026-09-25'), 0);
  eq('yesterday is 1', sb.evDaysLate('2026-09-24'), 1);
  eq('This month starts on the 1st', JSON.stringify(sb.periodWindow('This month')), JSON.stringify({ from: '2026-09-01', to: '2026-09-25' }));
  eq('Last month is 1 Aug to 31 Aug', JSON.stringify(sb.periodWindow('Last month')), JSON.stringify({ from: '2026-08-01', to: '2026-08-31' }));
  eq('FY to date starts 1 Jul', sb.periodWindow('FY to date').from, '2026-07-01');
  eq('Last quarter is Apr to Jun', JSON.stringify(sb.periodWindow('Last quarter')), JSON.stringify({ from: '2026-04-01', to: '2026-06-30' })); }
ok('no hour arithmetic on TODAY is left', !/Math\.round\(\(TODAY/.test(html));
/* the same stock cannot go on 2 trucks */
{ const b = { console }; vm.createContext(b); vm.runInContext(grab('reconcileLotShipKgV1'), b);
  const s = { orders: [{ po: 'P', lines: [{ id: 'L', brand: 'X', dispatched: 0 }] }], packingLog: [{ id: 'K', po: 'P', lid: 'L', brand: 'X', kg: 120, insKg: 120, shipKg: 120, date: '2026-09-01' }],
    shipments: [{ po: 'P', lid: 'L', brand: 'X', kg: 120, stage: 'truck_planned', dispId: 'D1' }] };
  b.reconcileLotShipKgV1(s); eq('a planned truck keeps its material claimed after a reload', s.packingLog[0].shipKg, 120);
  s.shipments[0].voided = true; b.reconcileLotShipKgV1(s); eq('...and gives it back when the truck is cancelled', s.packingLog[0].shipKg, 0); }
ok('the duplicate-truck cleaner looks only at trucks already counted', /x\.dispCounted\|\|!\(x\.stage\|\|x\.dispId\)/.test(grab('dedupeShipmentsV1')));
ok('Plan the truck starts a staged truck', /stage:\(_ctrlOn\?'truck_planned':''\)/.test(grab('saveDispatch')));
ok('approveDC refuses a staged truck and one with no passed inspection', /rows\.some\(function\(s\)\{ return s\.stage; \}\)/.test(grab('approveDC')) && /no passed pre-shipment inspection/.test(grab('approveDC')));
ok('a truck is edited only after it left, never its quantity, and it is recorded', /has not left the gate/.test(grab('saveShipEdit')) && /quantity on a truck is not typed here/.test(grab('saveShipEdit')) && /recordCorrection\('AMEND','shipment'/.test(grab('saveShipEdit')));
ok('the shipment backfill is the COO’s and capped', /Back-filling a truck is the COO/.test(grab('dfSubmitShipment')) && /_room/.test(grab('dfSubmitShipment')));
ok('a failed inspection subtracts only what was counted and gives the lots back', /if\(l&&s\.dispCounted\)/.test(grab('dispQASubmit')) && /_releaseShip\(o,l,s\.batches/.test(grab('dispQASubmit')));
ok('approve only when reviewed; review only when analysed', /h\.coa\.status!=='reviewed'/.test(grab('coaApprove')) && /h\.coa\.status!=='analysed'/.test(grab('coaReview')));
ok('divert uses its own form', !/divertForm/.test(grab('submitDivert')));
ok('REG is declared', /\nvar REG=\{\};/.test(html));
ok('one groupOf (product group); the nav one is navGroupOf', (html.match(/function groupOf\(/g) || []).length === 1 && /function navGroupOf\(/.test(html));
ok('POs with prices print for money roles only', /The PO carries prices/.test(grab('printPO')));
ok('Sales & Budget is for money roles only', /function screenBudget\(\)\{ if\(typeof mayMoney==='function'&&!mayMoney\(\)\)/.test(html));
ok('dealers not pending or inactive are offered on New order', /st!=='Pending approval'&&!\/inactive\|deactivat\|reject\|blocked\/i\.test\(st\)/.test(grab('clientsForChannel')));
ok('What to make escapes the typed text', /<div class="wtm-t1">'\+qsEsc\(x\.brand\)/.test(html) && /<b>'\+qsEsc\(x\.po\)\+'<\/b>/.test(html));
ok('the order sheet no longer sends anyone to All actions', /const BUCKET_SCREEN=\{'PO Created':'today','RM Check':'today'/.test(html));
process.exitCode = report('Fixes from the independent review (25m)') ? 1 : 0;
