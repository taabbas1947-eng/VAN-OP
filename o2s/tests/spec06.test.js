const H = require('./harness.js');
const S = H.sandbox, ok = H.ok, eq = H.eq;

const O = d => ({ printDecision: d, po: 'PO1', client: 'C' });
const L = p => ({ brand: 'VL-NPK', printPrice: p, ordered: 100 });

/* ---- 1. printPolicyOL: the three windows ---- */
eq('list  -> mode list', S.printPolicyOL(O('list'), L(null)).mode, 'list');
eq('list  -> no number', S.printPolicyOL(O('list'), L(null)).price, null);
eq('list  ignores a stray line price', S.printPolicyOL(O('list'), L(1250)).mode, 'list');
eq('yes+price -> priced', S.printPolicyOL(O('yes'), L(1250)).mode, 'priced');
eq('yes+price -> the number', S.printPolicyOL(O('yes'), L(1250)).price, 1250);
eq('yes-no price -> missing', S.printPolicyOL(O('yes'), L(null)).mode, 'missing');
eq('no    -> noprint', S.printPolicyOL(O('no'), L(null)).mode, 'noprint');
eq('no    beats a stray line price', S.printPolicyOL(O('no'), L(1250)).mode, 'noprint');
eq('unanswered, no history -> unknown', S.printPolicyOL({}, L(null)).mode, 'unknown');
eq('unanswered, line price -> priced', S.printPolicyOL({}, L(1250)).mode, 'priced');

/* ---- 2. the chip ---- */
ok('list chip sends you to the price list',
  /price list/i.test(S.mrpTag({ mode: 'list', price: null })));
ok('list chip shows no number',
  !/\d/.test(S.mrpTag({ mode: 'list', price: null }).replace(/[^0-9]/g, '')));

/* ---- 3. what QA is told ---- */
ok('QA/list: sent to the latest price list',
  /latest price list/i.test(S.qcExpect(O('list'), L(null), null).price));
ok('QA/priced: given the exact number',
  /1250/.test(S.qcExpect(O('yes'), L(1250), null).price));
ok('QA/no: told no price should appear',
  /no price should appear/i.test(S.qcExpect(O('no'), L(null), null).price));

/* ---- 4. when the inspector must write the number down ---- */
eq('asks on a list line', S.qcNeedsSeenPrice([{ o: O('list'), l: L(null) }]), true);
eq('does not ask on a priced line', S.qcNeedsSeenPrice([{ o: O('yes'), l: L(1250) }]), false);
eq('does not ask on a no-price line', S.qcNeedsSeenPrice([{ o: O('no'), l: L(null) }]), false);
eq('mixed truck: one list line is enough',
  S.qcNeedsSeenPrice([{ o: O('yes'), l: L(1250) }, { o: O('list'), l: L(null) }]), true);

/* ---- 5. the gate ---- */
const M = ['pass', 'pass', 'pass'];
eq('gate blocks an empty priceSeen when asked',
  typeof S.qcVerifyGate(M, {}, true), 'string');
eq('gate passes once the number is in',
  S.qcVerifyGate(M, { priceSeen: 1250 }, true), null);
eq('gate does not ask when not a list line',
  S.qcVerifyGate(M, {}, false), null);
eq('gate still demands the three marks',
  typeof S.qcVerifyGate(['pass', '', 'pass'], { priceSeen: 1250 }, true), 'string');

/* ---- 6. THE RECORD SURVIVES A SAVE (state is persisted with JSON.stringify) ---- */
const rec = S.qcVerifyRecord(M, { priceSeen: 1250 });
const saved = JSON.parse(JSON.stringify(rec));   // exactly what saveNow() sends
eq('priceSeen readable in memory', rec.priceSeen, 1250);
const row = saved.find(r => r.key === 'priceSeen');
ok('priceSeen SURVIVES the save as a row', !!row);
eq('…and the number is intact', row && row.priceSeen, 1250);
eq('…and it prints as text too', row && row.result, '1250');
eq('the three record checks are still there', saved.filter(r => r.key !== 'priceSeen').length, 3);
const recNo = JSON.parse(JSON.stringify(S.qcVerifyRecord(M, {})));
eq('no row added when nothing was read off the bag', recNo.length, 3);
ok('the dossier prints a number instead of an em dash',
  /v\.result\?_pe\(String\(v\.result\)\)/.test(
    H.html));

/* ---- 7. packing ---- */
eq('packing/list needs the number recorded',
  typeof S.packPriceGate(O('list'), L(null), {}), 'string');
eq('packing/list passes once entered and ticked',
  S.packPriceGate(O('list'), L(null), { price: 1250, priceOk: true }), null);
eq('packing/no-price never demands a price',
  S.packPriceGate(O('no'), L(null), { noPrice: true }), null);
const r = S.packPriceRecord(O('list'), L(null), { price: 1250 });
eq('lot records priceSource=list', r.priceSource, 'list');
eq('a list pack IS carrying a price', r.printOnPack, true);
eq('list pack raises no false mismatch', r.priceMismatch, false);
eq('po pack records priceSource=po',
  S.packPriceRecord(O('yes'), L(1250), { price: 1250 }).priceSource, 'po');
eq('no-price pack records priceSource=none',
  S.packPriceRecord(O('no'), L(null), {}).priceSource, 'none');

/* ---- 8. PO entry mode ---- */
S.setPrintOn('list'); eq('setPrintOn(list)', S.entryPrintMode(), 'list');
S.setPrintOn('yes'); eq('setPrintOn(yes)', S.entryPrintMode(), 'yes');
S.setPrintOn('no'); eq('setPrintOn(no)', S.entryPrintMode(), 'no');
S.setPrintOn(null); eq('setPrintOn(null)', S.entryPrintMode(), null);
S.setPrintOn(false); eq('legacy boolean false still means no', S.entryPrintMode(), 'no');
S.setPrintOn(true); eq('legacy boolean true still means yes', S.entryPrintMode(), 'yes');

/* ---- 9. the "no" safety confirm at submit (line 3034 guard) ---- */
S.setPrintOn('no');
const srcAll = H.html;
ok('the NO-confirm guard is asked through entryPrintMode()',
  /entryPrintMode\(\)==='no' && linesNormallyPrint\(\)/.test(srcAll));
ok('no dead entryPrintOn===false test survives anywhere',
  !/entryPrintOn===false/.test(srcAll));
eq('and the guard condition is true for a NO answer', S.entryPrintMode() === 'no', true);
S.setPrintOn('list');
eq('and false for a LIST answer', S.entryPrintMode() === 'no', false);

/* ---- 10. the change-order screen offers all three ---- */
const html = H.html;
const co = html.slice(html.indexOf('co_printDecision') - 900, html.indexOf('co_printDecision') + 200);
ok('change-order select offers the list option', /pill\('list'\)/.test(co));
ok('change-order printOnPack handles list', !/o\.printOnPack=\(nv==='yes'\)/.test(html));

/* ---- 11. a stray price cannot ride along on a non-priced line ---- */
ok('entry writes printPrice only for the PO-price answer',
  html.includes("printPrice:(entryFOC?0:(entryPrintMode()==='yes'?(+l.printPrice||0):0))"));
ok('no truthy-string test left on the entry line',
  !/printPrice:\(entryFOC\?0:\(entryPrintOn\?/.test(html));

process.exit(H.report('SPEC-06') > 0 ? 1 : 0);
