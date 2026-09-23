/* ONE REASON PER LATE ORDER — R14, the night of 23 September 2026.

   Tahir: "Yes — one reason per order, line override allowed. 18 rows become 7
   questions." The live Action Center was asking the Plant Manager to explain 18
   late LINES one at a time, and 8 of them belonged to one order.

   openDelayReasonOrder(oid) opens every late line of the order in one modal:
   one reason and one responsible department for the order, and a per-line
   override that defaults to the order's choice. submitDelayReasonOrder() writes
   each line exactly as submitDelayReason() always has (l.delayReason,
   l.respDept, one log line per line), so nothing downstream changes. The
   per-line modal stays for the single-line case and for the Tracker.

   Run: node latereasons.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const open = grab('openDelayReasonOrder');
const submit = grab('submitDelayReasonOrder');
ok('openDelayReasonOrder exists', open.length > 100);
ok('submitDelayReasonOrder exists', submit.length > 100);
ok('it lists only the lines that are actually late (pmDelayLabel), not every line', /pmDelayLabel\(o,l/.test(open));
ok('one reason and one department for the order', /delayOrderForm\.reason/.test(open) && /delayOrderForm\.dept/.test(open));
ok('a line can be overridden', /delayOrderForm\.lines\[/.test(open) || /lineReason/.test(open));
ok('the submit refuses an empty reason', /Pick a delay reason/.test(submit));
ok('the submit writes the same two fields the single-line path writes', /l\.delayReason=/.test(submit) && /l\.respDept=/.test(submit));
ok('and logs one line per line, in the same words', /logAction\(`Delay reason set \$\{o\.po\} · \$\{l\.brand\}/.test(submit));
ok('the old single-line modal still exists', /function openDelayReason\(oid,lid\)/.test(html));

/* the button on Today for a late-order group goes to the order modal */
const card = grab('tdCardHTML');
ok("a late-order group on Today opens the ORDER modal with one button", card.indexOf("openDelayReasonOrder(\\''+_tdEsc(one.o.id)+'\\')") > -1, card.slice(card.indexOf('rsn:'), card.indexOf('rsn:') + 400));
ok('and the button says what it does', /Give one reason for all/.test(card));

/* the submit, run: 3 late lines, order reason applied, one line overridden */
{
  const b = { console, logged: [], saved: 0, closed: 0, rendered: 0,
    toast: () => {}, save: () => { b.saved++; }, closeModal: () => { b.closed++; }, render: () => { b.rendered++; },
    logAction: m => b.logged.push(m),
    state: { orders: [{ id: 'o1', po: 'P-1', lines: [
      { id: 'a', brand: 'A' }, { id: 'b', brand: 'B' }, { id: 'c', brand: 'C' }, { id: 'd', brand: 'D', delayReason: 'RM late' } ] }] } };
  b.delayOrderForm = { oid: 'o1', reason: 'Capacity', dept: 'Production', lines: { a: { reason: '', dept: '' }, b: { reason: 'RM late', dept: 'Supply Chain' }, c: { reason: '', dept: '' } } };
  vm.createContext(b);
  vm.runInContext(submit, b);
  b.submitDelayReasonOrder();
  const L = b.state.orders[0].lines;
  eq('line a takes the order reason', L[0].delayReason, 'Capacity');
  eq('line a takes the order department', L[0].respDept, 'Production');
  eq('line b keeps its own override', L[1].delayReason, 'RM late');
  eq('line b keeps its own department', L[1].respDept, 'Supply Chain');
  eq('line c takes the order reason', L[2].delayReason, 'Capacity');
  eq('a line not in the form is not touched', L[3].delayReason, 'RM late');
  eq('3 log lines, one per line', b.logged.length, 3);
  ok('saved once, closed once, rendered once', b.saved === 1 && b.closed === 1 && b.rendered === 1);
}

process.exitCode = report('One reason per late order') ? 1 : 0;
