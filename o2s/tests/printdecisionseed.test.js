/* PRINT-ON-PACK: THE OLD ORDERS ARE ANSWERED "NO" — R2, the night of 23 Sep 2026.

   44 orders were raised before the print-on-pack question existed and carried
   no answer. The Action Center addressed them to the KAM as one bulk job; the
   KAM is now read-only. Tahir: "mark them as no print for all old orders where
   missing."

   seedPrintDecisionV1 answers every order that has no printDecision and at
   least one ordered line with 'no', exactly as the single-PO path writes it
   (printDecision, printOnPack, printDecisionBy, printDecisionAt), once, flagged,
   and logs the count - naming any brand that has carried a printed price before,
   because "no" is the answer that disarms the packing check (see
   saveBulkPrintDecision). A later "yes" by a person is never overwritten.

   Run: node printdecisionseed.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const src = grab('seedPrintDecisionV1');
ok('seedPrintDecisionV1 exists', src.length > 100);
ok('ensureState runs it', /seedPrintDecisionV1\(s\);/.test(grab('ensureState')));

function run(orders, flagged) {
  const b = { console, logged: [], state: null, Date,
    logAction: m => b.logged.push(m) };
  vm.createContext(b);
  vm.runInContext(src, b);
  const s = { orders, masters: flagged ? { _printDecisionV1: { at: 'x' } } : {} };
  b.seedPrintDecisionV1(s);
  return { s, logged: b.logged };
}
{
  const { s, logged } = run([
    { id: '1', po: 'A', client: 'X', lines: [{ brand: 'Max Sulfur', ordered: 100, printPrice: 0 }] },
    { id: '2', po: 'B', client: 'Y', lines: [{ brand: 'Enrich', ordered: 50, printPrice: 12 }] },
    { id: '3', po: 'C', client: 'Z', printDecision: 'yes', printOnPack: true, lines: [{ brand: 'Q', ordered: 10 }] },
    { id: '4', po: 'D', client: 'W', lines: [{ brand: 'R', ordered: 0 }] },
  ]);
  eq('an old order with no answer becomes no', s.orders[0].printDecision, 'no');
  eq('...and does not print on the pack', s.orders[0].printOnPack, false);
  ok('...signed as the ruling, not as a person who never pressed it', /ruling/i.test(s.orders[0].printDecisionBy), s.orders[0].printDecisionBy);
  ok('...and dated', !!s.orders[0].printDecisionAt);
  eq("a person's 'yes' is never overwritten", s.orders[2].printDecision, 'yes');
  eq('...nor its print flag', s.orders[2].printOnPack, true);
  eq('an order with nothing ordered is left alone', s.orders[3].printDecision, undefined);
  ok('the seed is flagged', !!s.masters._printDecisionV1);
  ok('the log gives the count', logged.some(l => /2 order/.test(l)), JSON.stringify(logged));
  ok('and names the brand that has carried a printed price before', logged.some(l => /Enrich/.test(l)), JSON.stringify(logged));
}
{
  const { s } = run([{ id: '1', po: 'A', lines: [{ brand: 'M', ordered: 5 }] }], true);
  eq('a flagged state is not touched again', s.orders[0].printDecision, undefined);
}
/* the bulk job disappears on its own: openPrintDecisionPOs() is empty once every order has an answer */
ok('the KAM bulk item still keys off openPrintDecisionPOs (so it vanishes when the backlog is answered)',
   /openPrintDecisionPOs\(\)/.test(grab('actionItems')));

process.exitCode = report('Print-on-pack: the old orders answered') ? 1 : 0;
