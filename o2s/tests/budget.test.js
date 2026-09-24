/* MONEY, AND THE BUDGET TREE — R6, R8, R18, the night of 23 September 2026.

   R6  Report Center is open to everyone, read-only. Anything with a money
       figure inside it: COO, CFO, Plant Manager, the 2 KAMs only. That closes
       S-05 (the Finance dataset in the report builder was ungated).
   R8  Budget is customer-wise, in Rs, FY Jul-Jun: a channel total, then the
       clients under it. White Label per client; Cobo one figure; Dealer a
       segment total; Farmer a segment total, never per farmer.
   R18 Dealer: one total, optional per-dealer under it. No province level.

   The existing model (salesTargets[client][fy], monthly, budgetHtml) stays.
   Added: MONEY_ROLES / mayMoney(), channelTargets[channel][fy], the channel
   card in Business masters, and budgetByChannel() feeding a "By channel" block
   at the top of Sales & Budget with a traffic light.

   Run: node budget.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar, html } = H;

/* ---- 1. who sees money ---- */
let MONEY_ROLES = null;
try { const b = { console }; vm.createContext(b); vm.runInContext(grabTopVar('MONEY_ROLES', '['), b); MONEY_ROLES = b.MONEY_ROLES; } catch (e) {}
eq('MONEY_ROLES is exactly the four', (MONEY_ROLES || []).slice().sort().join(','), 'CFO,COO,KAM,Plant Manager');
ok('mayMoney() exists and asks MONEY_ROLES', /MONEY_ROLES\.indexOf\(state\.role\)/.test(grab('mayMoney')));
{
  const m = /\{id:'budget'[^\n]*owners:\[([^\]]*)\]/.exec(html);
  eq("the Sales & Budget screen's owners are the money roles", m && m[1].replace(/'/g, '').split(',').map(s => s.trim()).sort().join(','), 'CFO,COO,KAM,Plant Manager');
}
ok('the report builder offers the Finance dataset only to money roles', /function rbDatasetKeys\(\)/.test(html) && /k!=='finance'\|\|mayMoney\(\)/.test(grab('rbDatasetKeys')));
ok('the dataset picker uses rbDatasetKeys, not every key', /rbDatasetKeys\(\)\.map/.test(html) && !/Object\.keys\(RB_DATASETS\)\.map\(function\(k\)\{return '<option/.test(html));
ok('a non-money role standing on finance is moved off it', /if\(rbDS==='finance'&&!mayMoney\(\)\) rbDS='production'/.test(html));
{
  /* the Orders dataset carries price columns; they exist only for money roles */
  const b2 = { console, state: { role: 'Production' }, rbDS: 'orders', rbCols: ['po', 'value', 'pricekg'],
    RB_DATASETS: { production: { fields: [{ k: 'date' }], rows: () => [] },
      orders: { fields: [{ k: 'po' }, { k: 'pricekg' }, { k: 'pricepack' }, { k: 'value' }, { k: 'fed' }, { k: 'ordered' }], rows: () => [{ po: 'A', pricekg: 9, pricepack: 90, value: 900, fed: 45, ordered: 100 }] } } };
  vm.createContext(b2); vm.runInContext(grabTopVar('MONEY_ROLES', '[') + grab('mayMoney') + grabTopVar('RB_MONEY_FIELDS', '[') + grab('rbDef'), b2);
  const d = b2.rbDef();
  eq('Production sees the Orders dataset without the 4 money columns', d.fields.map(f => f.k).join(','), 'po,ordered');
  eq('...and the rows carry no money either', JSON.stringify(d.rows()[0]), JSON.stringify({ po: 'A', ordered: 100 }));
  eq('...and a money column already picked is dropped', b2.rbCols.join(','), 'po');
  b2.state.role = 'KAM';
  eq('a KAM sees all the columns', b2.rbDef().fields.length, 6);
}
ok('the ruled matrix opens Sales & Budget to the money roles once (V3, flagged)', /function seedAccessV3\(/.test(html) && /_accessV3/.test(grab('seedAccessV3')) && /seedAccessV3\(s\);/.test(grab('ensureState')));

/* ---- 2. the channel tree ---- */
/* 25a, Tahir 24 Sep: a sale is counted when the truck leaves, net of taxes. The
   channel totals now read the shipments (saleRows), not the delivered quantity. */
const src = ['budgetChannelOf', 'budgetByChannel', 'channelBudgetSet', 'lineNetPrice', 'saleLeft', 'saleLineOf', 'saleRows', 'saleOpenValue'].map(grab).join('\n\n');
const b = { console, logged: [], toasts: [], saved: 0, rendered: 0,
  logAction: m => b.logged.push(m), toast: m => b.toasts.push(m), save: () => b.saved++, render: () => b.rendered++,
  TODAY: new Date('2026-09-23T09:00:00'), fyKey: ds => (String(ds || '2026-09') < '2026-07' ? '2025-26' : '2026-27'), lineShortClosed: l => !!(l && l.shortClose && l.shortClose.approvedAt), pkr: n => 'PKR ' + Math.round(n),
  isDealerClient: o => o.channel === 'Dealer', budgetKey: o => (o.channel === 'Dealer' ? 'Dealers' : o.client),
  BUDGET_CHANNELS: ['White Label', 'Cobo', 'Vgreen', 'Dealer', 'Distributor', 'Farmer'],
  state: { role: 'CFO', customers: [ { name: 'ACME', segment: 'White-label' }, { name: 'Farmer Ali', segment: 'Direct Farmer' } ],
    masters: { salesTargets: { ACME: { '2026-27': 600 }, BKK: { '2026-27': 100 } }, channelTargets: { 'White Label': { '2026-27': 1000 }, Dealer: { '2026-27': 500 } } },
    orders: [
      { po: 'A1', client: 'ACME', channel: 'White Label', lines: [ { id: 'A1L', brand: 'X', ordered: 10, dispatched: 5, delivered: 0, invoicePrice: 20 } ] },
      { po: 'D1', client: 'DLR-PB-1 | Shop', channel: 'Dealer', lines: [ { id: 'D1L', brand: 'Y', ordered: 4, dispatched: 4, delivered: 4, invoicePrice: 10 } ] },
      { po: 'F1', client: 'Farmer Ali', channel: 'Farmer', lines: [ { id: 'F1L', brand: 'Z', ordered: 1, dispatched: 0, delivered: 0, invoicePrice: 50 } ] },
      { po: 'B1', client: 'BKK', channel: 'Distributor', lines: [ { id: 'B1L', brand: 'W', ordered: 2, dispatched: 1, delivered: 1, invoicePrice: 30 } ] } ],
    /* A1: 5 left the gate in August, not yet delivered - a sale. D1: 4 left and were delivered.
       B1: 1 left last financial year - not this year's sale. A planned truck is not a sale. */
    shipments: [
      { po: 'A1', lid: 'A1L', brand: 'X', kg: 5, dispCounted: true, stage: 'in_transit', approvedDate: '2026-08-10' },
      { po: 'A1', lid: 'A1L', brand: 'X', kg: 3, stage: 'truck_planned', dispatch: '2026-09-20' },
      { po: 'D1', lid: 'D1L', brand: 'Y', kg: 4, dispCounted: true, stage: 'delivered', approvedDate: '2026-08-11', delivered: '2026-08-12' },
      { po: 'B1', lid: 'B1L', brand: 'W', kg: 1, dispCounted: true, stage: 'delivered', approvedDate: '2026-06-20', delivered: '2026-06-21' } ] } };
vm.createContext(b); vm.runInContext(grabTopVar('BUDGET_CHANNELS', '[') + '\n' + src, b);
eq("a client's channel comes from its orders first", b.budgetChannelOf('BKK'), 'Distributor');
eq("...and from the customer segment when it has no order", b.budgetChannelOf('Farmer Ali'), 'Farmer');
eq("'Dealers' is the Dealer channel", b.budgetChannelOf('Dealers'), 'Dealer');
const rows = b.budgetByChannel('2026-27');
eq('one row per channel, in the fixed order', rows.map(r => r.channel).join(','), 'White Label,Cobo,Vgreen,Dealer,Distributor,Farmer');
const wl = rows.find(r => r.channel === 'White Label');
eq('White Label: target', wl.target, 1000);
eq('White Label: allocated to clients', wl.allocated, 600);
eq('White Label: unallocated', wl.unallocated, 400);
eq('White Label: open orders (not yet dispatched x price)', wl.booked, 100);
eq('White Label: sold (left the gate this year x price), though not yet delivered', wl.sold, 100);
eq('...a planned truck is not a sale', wl.sold, 100);
eq('White Label: % of target', wl.pct, 10);
const dl = rows.find(r => r.channel === 'Dealer');
eq('Dealer: target', dl.target, 500);
eq('Dealer: sold rolls up every dealer', dl.sold, 40);
eq('Dealer: no allocation expected (segment total)', dl.allocated, 0);
const ds = rows.find(r => r.channel === 'Distributor');
eq('Distributor: a client allocation with no channel target still shows', ds.allocated, 100);
eq('Distributor: target 0', ds.target, 0);
eq('Distributor: a truck that left last financial year is not this year\'s sale', ds.sold, 0);
eq('Distributor: open orders', ds.booked, 30);
/* setting a channel total */
b.state.role = 'Production'; b.channelBudgetSet('Cobo', 250);
ok('a non-money role is refused', b.toasts.some(t => /COO \/ CFO/.test(t)) && !(b.state.masters.channelTargets.Cobo));
b.state.role = 'CFO'; b.channelBudgetSet('Cobo', 250);
eq('the CFO sets a channel total', b.state.masters.channelTargets.Cobo['2026-27'], 250);
ok('it is logged', b.logged.some(l => /Cobo/.test(l) && /250/.test(l)));
b.channelBudgetSet('Cobo', 0);
ok('0 clears it', !b.state.masters.channelTargets.Cobo['2026-27']);

/* ---- 3. the screen ---- */
ok('Sales & Budget opens with the By channel block', /By channel/.test(grab('budgetHtml')) && /budgetByChannel\(fy\)/.test(grab('budgetHtml')));
ok('it says what Dealer and Farmer totals mean', /segment total/.test(grab('budgetHtml')));
ok('the channel card exists in Business masters for COO / CFO', /function channelBudgetCard\(/.test(html) && /channelBudgetCard\(\)/.test(html));
ok('no money reaches Today', !/pkr\(|invoicePrice/.test(grab('screenToday') + grab('tdCardHTML') + grab('tdRowHTML')));

/* ---- 25a: one rule for a sale, everywhere ---- */
{
  const bh = grab('budgetHtml'), md = grab('monthlyDeliveredTotals');
  ok('Sales & Budget reads sales from saleRows (truck left the gate)', /saleRows\(\)/.test(bh) && /saleRows\(\)/.test(md));
  ok('...for this financial year only', /x\.fy===fy/.test(bh));
  ok('...and open orders from saleOpenValue', /saleOpenValue\(o,l\)/.test(bh));
  ok('the screen says what a sale is', /A sale is counted when the truck leaves the gate/.test(bh));
  ok('the words are Sold, not Delivered', /Sold/.test(bh) && !/Delivered \(achieved\)/.test(bh));
  const sb = { console, fyKey: ds => '2026-27', budgetKey: o => o.client, lineShortClosed: l => !!(l.shortClose && l.shortClose.approvedAt),
    state: { orders: [ { po: 'P', client: 'C', foc: false, lines: [ { id: 'L1', brand: 'X', ordered: 10, dispatched: 2, invoicePrice: 5, shortClose: { approvedAt: 'x' } }, { id: 'L2', brand: 'X', ordered: 6, dispatched: 0, invoicePrice: 7 } ] },
                     { po: 'F', client: 'C', foc: true, lines: [ { id: 'F1', brand: 'X', ordered: 3, dispatched: 3, invoicePrice: 9 } ] } ],
             shipments: [ { po: 'P', lid: 'L1', brand: 'X', kg: 2, dispCounted: true, approvedDate: '2026-08-01' }, { po: 'P', lid: 'L2', brand: 'X', kg: 1, voided: true, dispCounted: true, approvedDate: '2026-08-02' },
                          { po: 'F', lid: 'F1', brand: 'X', kg: 3, dispCounted: true, approvedDate: '2026-08-03' }, { po: 'P', lid: 'L2', brand: 'X', kg: 4, stage: 'pending_approval', dcStatus: 'pending', dispId: 'D9' } ] } };
  vm.createContext(sb); vm.runInContext(['lineNetPrice', 'saleLeft', 'saleLineOf', 'saleRows', 'saleOpenValue'].map(grab).join('\n'), sb);
  const r = sb.saleRows();
  eq('a voided truck and one waiting for approval are not sales', r.length, 2);
  eq('the price comes from the line the truck carried (by line id)', r[0].value, 10);
  eq('an FOC sample is a sale of 0', r[1].value, 0);
  eq('a line closed short has no open value', sb.saleOpenValue(sb.state.orders[0], sb.state.orders[0].lines[0]), 0);
  eq('open value is what has not left yet', sb.saleOpenValue(sb.state.orders[0], sb.state.orders[0].lines[1]), 42);
}
process.exitCode = report('Money and the budget tree') ? 1 : 0;
