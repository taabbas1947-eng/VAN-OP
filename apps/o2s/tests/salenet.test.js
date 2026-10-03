/* 25b — THE AUDIT OF EVERY MONEY FIGURE AFTER 25a. Tahir, 24 Sep 2026:
   "If there is any change in logic, formula, computation, make sure the new
   rules don't leave the calculation incorrect ... check carefully, audit,
   double check." And: "FED is sale tax" - FED is the only tax on the price.

   Found and fixed:
   1. On an order whose FED mode is Inclusive the typed invoice price holds the
      5% FED (fedSplit takes it out as value/1.05 on the PO). Sales used
      qty x price, i.e. gross. Now lineNetPrice() = price/1.05 for Inclusive.
   2. Sales & Budget line rows under a client still showed delivered x price
      (all years) and ordered x price, under the columns "Sold" and "Open
      orders" whose client totals use the new rule. Now the same rule.
   3. The old executive dashboard: delivered x price, all years, against an FY
      budget. Now sold this FY; booked = sold this FY + still to leave.
   4. Report builder Finance: every shipment, including trucks not yet out,
      dated the planning day, priced by PO+brand. Now only trucks out, dated the
      day they left, net price of the line they carried.
   5. Report builder Orders: FED split evenly across lines. Now each line's own.
   6. PO register Value: grandTotal (incl. FED) when set, net otherwise - mixed
      in one column. Now net everywhere, labelled.
   Run: node salenet.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const sb = { console, TODAY: new Date('2026-09-24T09:00:00'),
  fyKey: ds => (String(ds) < '2026-07' ? '2025-26' : '2026-27'), budgetKey: o => o.client,
  lineShortClosed: l => !!(l && l.shortClose && l.shortClose.approvedAt), _r2: n => Math.round(n * 100) / 100,
  state: { orders: [
    { po: 'IN1', client: 'A', channel: 'White Label', fedMode: 'Inclusive', lines: [{ id: 'L1', brand: 'X', ordered: 100, dispatched: 40, invoicePrice: 105 }] },
    { po: 'EX1', client: 'B', channel: 'White Label', fedMode: 'Exclusive', lines: [{ id: 'L2', brand: 'Y', ordered: 10, dispatched: 0, invoicePrice: 200 }] },
    { po: 'FOC', client: 'C', channel: 'Farmer', foc: true, fedMode: 'None', lines: [{ id: 'L3', brand: 'Z', ordered: 5, dispatched: 5, invoicePrice: 99 }] } ],
    shipments: [
      { po: 'IN1', lid: 'L1', brand: 'X', kg: 40, dispCounted: true, stage: 'in_transit', approvedDate: '2026-09-01' },
      { po: 'FOC', lid: 'L3', brand: 'Z', kg: 5, dispCounted: true, stage: 'delivered', approvedDate: '2026-09-02' } ] } };
vm.createContext(sb);
vm.runInContext(['lineNetPrice', 'fedSplit', 'saleLeft', 'saleLineOf', 'saleRows', 'saleOpenValue'].map(grab).join('\n'), sb);
const [oIn, oEx, oFoc] = sb.state.orders;
eq('Inclusive: net price is price / 1.05', sb.lineNetPrice(oIn, oIn.lines[0]), 100);
eq('Exclusive: the typed price is already net', sb.lineNetPrice(oEx, oEx.lines[0]), 200);
eq('FOC: 0', sb.lineNetPrice(oFoc, oFoc.lines[0]), 0);
eq('an order with no FED mode: price as typed', sb.lineNetPrice({}, { invoicePrice: 7 }), 7);
const r = sb.saleRows();
eq('an Inclusive truck of 40 at 105 is a sale of 4,000 net, not 4,200', r[0].value, 4000);
eq('...and it matches the PO split: fedSplit(4200,Inclusive).sub', sb.fedSplit(4200, 'Inclusive').sub, 4000);
eq('the sale row carries the line id', r[0].lid, 'L1');
eq('Inclusive open value: 60 x 100', sb.saleOpenValue(oIn, oIn.lines[0]), 6000);
eq('Exclusive open value: 10 x 200', sb.saleOpenValue(oEx, oEx.lines[0]), 2000);
eq('FOC truck: a sale of 0', r[1].value, 0);

/* the audit, as source checks: no money figure multiplies the raw price any more */
ok('saleRows prices by lineNetPrice', /lineNetPrice\(o,l\)/.test(grab('saleRows')));
ok('saleOpenValue prices by lineNetPrice', /lineNetPrice\(o,l\)/.test(grab('saleOpenValue')));
ok('Budget rows: sold from saleRows in the period, open from saleOpenValue (25k: sbData)', /saleRows\(\)/.test(grab('sbData')) && /saleOpenValue\(o,l\)/.test(grab('sbData')) || /saleRows\(\)/.test(grab('bgtSubRows')) && /saleOpenValue\(o,l\)/.test(grab('bgtSubRows')) && !/l\.delivered\|\|0\)\*ip/.test(grab('bgtSubRows')));
ok('Executive metrics: sold from saleRows this FY', /saleRows\(\)\.forEach\(x=>\{ if\(x\.fy!==fy\) return;/.test(grab('execMetrics')) && !/l\.delivered\|\|0\)\*ip/.test(grab('execMetrics')));
ok('Targets panel: sold from saleRows this FY', /saleRows\(\)/.test(grab('dashTargetsPanel')) && !/l\.delivered\|\|0\)\*\(\+l\.invoicePrice/.test(grab('dashTargetsPanel')));
ok('Report builder Finance: only trucks out (saleLeft), net price', /saleLeft\(s\)/.test(html) && /var price=lineNetPrice\(_r\.o,_r\.l\)/.test(html));
ok('Report builder Orders: FED per line, value net', /value:Math\.round\(\(\+l\.delivered\|\|0\)\*lineNetPrice\(o,l\)\)/.test(html) && !/fedAmount\|\|0\)\/nL/.test(html));
ok('PO register Value: net, one rule, labelled', /lineNetPrice\(o,l\)\);\},0\); \/\* 25b/.test(grab('rpPos')) && !/o\.grandTotal\|\|0\)\|\|lines/.test(grab('rpPos')) && /Value \(net of FED\)/.test(html));
ok('nowhere else multiplies delivered or dispatched by the raw invoice price', !/(delivered|dispatched)\|\|0\)\*\(\+l\.invoicePrice/.test(html));
process.exitCode = report('Every money figure, net of FED (25b audit)') ? 1 : 0;
