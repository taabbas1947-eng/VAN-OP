/* 25d — New order: last price, 5% band with a reason, payment terms, ERP SO #.
   Run: node neworder.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, html, grabTopVar } = H;
const sb = { console, fmt: n => String(n), qsEsc: x => String(x == null ? '' : x), entryFOC: false, entryClient: 'ACME', fed: 'Exclusive',
  entryFedMode: () => sb.fed, curCustomer: () => sb.cust, cust: null,
  state: { orders: [
    { po: 'A-OLD', client: 'ACME', received: '2026-07-01', fedMode: 'Exclusive', lines: [{ brand: 'X', invoicePrice: 100 }] },
    { po: 'A-NEW', client: 'ACME', received: '2026-08-01', fedMode: 'Inclusive', lines: [{ brand: 'X', invoicePrice: 210 }] },
    { po: 'B-1', client: 'BETA', received: '2026-09-01', fedMode: 'Exclusive', lines: [{ brand: 'Y', invoicePrice: 50 }, { brand: 'X', invoicePrice: 999 }] },
    { po: 'F-1', client: 'ACME', received: '2026-09-10', foc: true, lines: [{ brand: 'X', invoicePrice: 1 }] } ] } };
vm.createContext(sb);
vm.runInContext(grabTopVar('PAY_TERMS', '[') + '\nvar PRICE_BAND=0.05;\n' + ['lineNetPrice', 'entryLastPrice', 'entryNetTyped', 'entryPriceCheck', 'entryTermsDefault'].map(grab).join('\n'), sb);
eq('the 6 payment terms', sb.PAY_TERMS.join(','), 'Advance,COD,15 days,30 days,45 days,60 days');
const lp = sb.entryLastPrice('ACME', 'X');
eq('this customer\'s latest price, net of FED (210 incl. = 200 net), FOC ignored', [lp.po, lp.price, lp.own].join('|'), 'A-NEW|200|true');
const any = sb.entryLastPrice('ACME', 'Y');
eq('first order for this customer: last price to anyone', [any.po, any.price, any.own].join('|'), 'B-1|50|false');
ok('no earlier price at all: no check', sb.entryLastPrice('ACME', 'Z') === null);
ok('within 5%: no reason needed (205 vs 200)', !sb.entryPriceCheck({ brand: 'X', inv: 205 }).off);
ok('more than 5%: reason needed (211 vs 200)', sb.entryPriceCheck({ brand: 'X', inv: 211 }).off);
ok('...also when cheaper (189)', sb.entryPriceCheck({ brand: 'X', inv: 189 }).off);
sb.fed = 'Inclusive'; ok('an Inclusive quote is compared net: 210 incl. = 200, no reason', !sb.entryPriceCheck({ brand: 'X', inv: 210 }).off); sb.fed = 'Exclusive';
sb.entryFOC = true; ok('FOC: no check', sb.entryPriceCheck({ brand: 'X', inv: 500 }) === null); sb.entryFOC = false;
sb.cust = { creditDays: 30 }; eq('terms default from credit days', sb.entryTermsDefault(), '30 days');
sb.cust = { creditDays: 30, paymentTerms: 'COD' }; eq('...or the customer\'s own default', sb.entryTermsDefault(), 'COD');
const ch = grab('entryChecks');
ok('checks: terms, ERP SO, reason', /'Payment terms'/.test(ch) && /'ERP SO #'/.test(ch) && /more than 5% from the last one/.test(ch));
const sub = grab('submitPO');
ok('submit refuses without terms, SO or reason', /Pick the payment terms/.test(sub) && /Enter the ERP SO #/.test(sub) && /write the reason under it/.test(sub));
ok('the order keeps terms, ERP SO (as the DC SO #) and each line\'s price check', /ord\.paymentTerms=/.test(sub) && /ord\.so=ord\.erpSo/.test(sub) && /priceCheck:\(function\(\)/.test(sub));
ok('the truck plan fills SO # from the order', /so:\(g\.o\.so\|\|g\.o\.erpSo\|\|''\)/.test(html));
ok('the customer master has a default payment term', /Default payment terms/.test(grab('custFormHTML')) && /paymentTerms:f\.paymentTerms/.test(grab('custSave')));
process.exitCode = report('New order: price, terms, ERP SO (25d)') ? 1 : 0;
