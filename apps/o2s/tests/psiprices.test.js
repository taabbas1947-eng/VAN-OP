/* 6 Oct 2026 — A PRICE FOR EVERY PRODUCT ON THE TRUCK.
   DLR-SN-TAN-008-2608-3355 (DC 133) carried V-Borate 17%, VL-Potash, V-Zinc and Vibrant,
   all on the list price, and the pre-shipment inspection asked for 1 price.
   Run: node psiprices.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const sb = { console, _pe: x => String(x), _av: x => String(x), printPolicyOL: (o, l) => ({ mode: l.mode }) };
vm.createContext(sb);
vm.runInContext(['qcVerifyRows', 'qcVerifyTable', 'qcVerifyGate', 'qcSeenBrands', 'qcAskSeen', 'qcNeedsSeenPrice', 'qcVerifyRecord'].map(grab).join('\n') + '\nvar QC_NA_VERIFY=[0];\nvar QC_VERIFY=[{k:"price",label:"p"},{k:"batch",label:"b"},{k:"dates",label:"d"}];', sb);
const P = (brand, mode) => ({ o: {}, l: { brand, mode } });
const truck = [P('V-Borate 17%', 'list'), P('VL-Potash', 'list'), P('V-Zinc', 'list'), P('Vibrant', 'list'), P('V-Zinc', 'list'), P('Max S', 'priced')];
eq('the list-price products, once each', sb.qcSeenBrands(truck).join('|'), 'V-Borate 17%|VL-Potash|V-Zinc|Vibrant');
const ask = sb.qcAskSeen(truck);
ok('a truck with 4 list-price products asks for 4 prices', Array.isArray(ask) && ask.length === 4);
eq('1 list-price product still asks for 1 price, as before', sb.qcAskSeen([P('X', 'list'), P('Y', 'priced')]), true);
eq('no list-price product asks for none', sb.qcAskSeen([P('Y', 'priced')]), false);
const t = sb.qcVerifyTable({}, [], 'dispQAForm', 'r()', {}, ask);
eq('the screen shows 1 price box per product', (t.match(/data-b="/g) || []).length, 4);
const M = ['pass', 'pass', 'pass'];
const f = { priceSeenBy: { 'V-Borate 17%': 1450, 'VL-Potash': 2200 } };
const g = sb.qcVerifyGate(M, f, ask);
ok('submit is refused while any product has no price, and names them', /V-Zinc, Vibrant/.test(g || ''));
f.priceSeenBy['V-Zinc'] = 900; f.priceSeenBy.Vibrant = 1100;
eq('with every price it goes through', sb.qcVerifyGate(M, f, ask), null);
const rec = JSON.parse(JSON.stringify(sb.qcVerifyRecord(M, f)));
const rows = rec.filter(r => r.key === 'priceSeen');
eq('each price is saved as its own row, against its product', rows.map(r => r.brand + '=' + r.priceSeen).join('|'), 'V-Borate 17%=1450|VL-Potash=2200|V-Zinc=900|Vibrant=1100');
eq('the single-price record is unchanged', JSON.parse(JSON.stringify(sb.qcVerifyRecord(M, { priceSeen: 1250 }))).filter(r => r.key === 'priceSeen')[0].priceSeen, 1250);
ok('the pre-shipment screen and its submit both use the per-product list', /dispQAForm, qcAskSeen\(_pairs\)/.test(html) && /qcVerifyGate\(dispQAForm\.verify, dispQAForm, qcAskSeen\(_pr\)\)/.test(html));
process.exitCode = report('A price for every product on the truck (6 Oct)') ? 1 : 0;
