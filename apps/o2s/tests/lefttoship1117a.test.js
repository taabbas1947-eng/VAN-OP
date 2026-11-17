/* BUILD 2026-11-17a. Shoaib (Senior Warehouse Officer) asked for what is left to dispatch, customer by customer, as a
   download; Tahir ruled on 17 Nov 2026: left to ship is ordered minus shipped (a truck counts as gone once it leaves
   the gate) and it replaces left to deliver on Open orders; Open orders gets a customer picker and Excel; One customer
   shows 1 row per product with bags left (left to ship / pack size, 1 decimal) and downloads; the Morning view gets an
   8th page, Warehouse, seen by Shoaib (Warehouse) and Zain (Supply Chain Officer), answering the 5 approved questions.
   Run: node lefttoship1117a.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar, html } = H;

/* ---- the 4 small rules, run as written ---- */
const b = { Math, String };
vm.createContext(b);
vm.runInContext(['lineShortClosed', 'rbShipLeftOf', 'rbBagsLeft', 'rbReadyOf'].map(grab).join('\n') + '\nfunction lineCleared(o,l){ return +l._clr||0; }', b);
eq('left to ship = ordered minus shipped', b.rbShipLeftOf({}, { ordered: 1000, dispatched: 300, delivered: 100 }), 700);
eq('a truck on the road counts as gone (delivered does not matter)', b.rbShipLeftOf({}, { ordered: 500, dispatched: 500, delivered: 0 }), 0);
eq('a PO closed has nothing left', b.rbShipLeftOf({ closed: true }, { ordered: 1000, dispatched: 0 }), 0);
eq('never below 0', b.rbShipLeftOf({}, { ordered: 100, dispatched: 120 }), 0);
eq('bags left: 15 Kg of a 10 Kg bag is 1.5 (1 decimal, Tahir)', b.rbBagsLeft(15, 10), 1.5);
eq('bags left: 37 L of a 1 L pack is 37', b.rbBagsLeft(37, 1), 37);
eq('bags left: 14,000 Kg of a 35 Kg bag is 400', b.rbBagsLeft(14000, 35), 400);
eq('bags left: 1 decimal only (100 / 3 = 33.3)', b.rbBagsLeft(100, 3), 33.3);
eq('no pack size, no bag count', b.rbBagsLeft(500, 0), null);
eq('cleared, ready is capped at packed minus shipped', b.rbReadyOf({}, { ordered: 2000, packed: 800, dispatched: 300, _clr: 900 }), 500);
eq('cleared, ready is what QA cleared when that is less', b.rbReadyOf({}, { ordered: 2000, packed: 800, dispatched: 300, _clr: 200 }), 200);
eq('cleared, ready is never more than the order still wants', b.rbReadyOf({}, { ordered: 400, packed: 800, dispatched: 300, _clr: 500 }), 100);
eq('a closed line has nothing ready for its order (17a live check: Max Sulfur on Maxim PO 21301)', b.rbReadyOf({ closed: true }, { ordered: 2000, packed: 2000, dispatched: 1000, _clr: 1000 }), 0);

/* ---- the orders rows carry the new fields ---- */
const sd = { console, Math, String, state: { orders: [
  { id: 'O1', po: 'P1', client: 'Maxim', received: '2026-09-11', promised: '2026-09-30', lines: [
    { id: 'a', brand: 'Enroot', pack: 35, ordered: 35000, packed: 31395, dispatched: 21000, delivered: 21000, committed: '2026-09-30', _clr: 10395 },
    { id: 'b', brand: 'Max Potash', pack: 20, ordered: 30000, packed: 30000, dispatched: 30000, delivered: 30000, _clr: 0 }] }] } };
vm.createContext(sd);
vm.runInContext(['evToday', 'localDateOf', 'calDays', '_rbClientMap', 'lineShortClosed', 'rbShipLeftOf', 'rbBagsLeft', 'rbReadyOf', 'rbPackTxt', 'unitOf'].map(grab).join('\n')
  + '\nfunction lineCleared(o,l){ return +l._clr||0; }\nfunction lineNetPrice(){ return 0; }\nfunction fedSplit(){ return {fed:0}; }\nfunction lineStage(){ return "Dispatched"; }\nvar RB_DATASETS=' + grabTopVar('RB_DATASETS', '{').replace(/^\s*var\s+RB_DATASETS\s*=\s*/, '') + ';\nthis.D=RB_DATASETS;', sd);
const rows = sd.D.orders.rows(); const en = rows.find(r => r.product === 'Enroot'), mp = rows.find(r => r.product === 'Max Potash');
eq('Enroot: left to ship 14,000', en.shipleft, 14000);
eq('Enroot: 400 bags left', en.bagsleft, 400);
eq('Enroot: cleared, ready 10,395', en.ready, 10395);
eq('Enroot: committed date from the line', en.due, '2026-09-30');
eq('review: a line with no committed date of its own shows none (the late colour follows the line date only)', rows.find(r => r.product === 'Max Potash').due, '');
ok('review: bags left blank in the file and the print when nothing is left', /rpCustNum\(x\[0\],v,r\)/.test(grab('rpCustExport')) && /!\(\(\+r\.shipleft\|\|0\)>0\.5\)\)\?'—'/.test(grab('rpCustPrint')));
ok('Enroot: the row knows its order and line, so One customer can open the order', en._oid === 'O1' && en._lid === 'a');
ok('the old left to deliver is still in the data, for the Custom report', en.balance === 14000 && sd.D.orders.fields.some(f => f.k === 'balance'));
eq('a line shipped in full has nothing left', mp.shipleft, 0);
const flds = sd.D.orders.fields; const fb = flds.find(f => f.k === 'bagsleft');
ok('the fields list has Committed, Pack, Unit, Left to ship, Bags left and Cleared, ready', ['due', 'pack', 'unit', 'shipleft', 'bagsleft', 'ready'].every(k => flds.some(f => f.k === k)));
ok('Bags left keeps 1 decimal and has no total (pack sizes differ)', fb && fb.dp === 1 && fb.noTot === true && fb.t === 'meas');

/* ---- Open orders ---- */
const cat = grabTopVar('RP_CATALOGUE', '[');
const oo = (/\{id:'openorders'[^\n]*/.exec(cat) || [''])[0];
ok('Open orders has a customer picker', /custPick:true/.test(oo));
ok('Open orders lists left to ship, bags left and cleared, ready; left to deliver is gone from it (Tahir: replace)', /'shipleft'/.test(oo) && /'bagsleft'/.test(oo) && /'ready'/.test(oo) && !/'balance'/.test(oo));
ok('a line is on Open orders while something is left to ship', /where:function\(r\)\{ return \(\+r\.shipleft\|\|0\)>0\.5; \}/.test(oo));
ok('the report adds up left to ship', /sumKey:'shipleft'/.test(oo));
ok('the 2 summary views carry Shipped and Left to ship, not bags', /group:\['client'\],cols:\['client','ordered','dispatched','shipleft','ready'\]/.test(oo) && /group:\['product'\],cols:\['product','ordered','dispatched','shipleft','ready'\]/.test(oo));
const rr = grab('rpReportHTML');
ok('the picker and an Excel button show only on a report with a picker', /c\.custPick\?rpCustPickHTML\(c\):''/.test(rr) && /c\.custPick\?'<button class="qs-btn sm" onclick="rbExport\(\\'xls\\'\)">Excel<\/button>'/.test(rr));
ok('the picker sets the report\'s client filter, so table, total, Print, CSV and Excel all follow it', /rbSetFilter\(\\'client\\',this\.value\)/.test(grab('rpCustPickHTML')) && /Object\.keys\(rbFilters\)/.test(grab('rbRows')));
ok('the print says which customer', /Customer: <b>'\+_pe\(\(rbFilters&&rbFilters\.client\)\|\|'All customers'\)/.test(grab('rbPrint')));
{ const f = { Math, String, rpCur: 'openorders', rbDS: 'orders', rbFilters: { client: 'MAXIM AGRI (PVT) LTD' }, rpDef: () => ({ id: 'openorders', custPick: true }) }; vm.createContext(f); vm.runInContext(grab('rbFileStem'), f);
  eq('the file is named for the report and the customer', f.rbFileStem(), 'openorders-maxim-agri-pvt-ltd');
  f.rbFilters = {}; eq('...or all customers', f.rbFileStem(), 'openorders-all-customers');
  f.rpCur = 'trucks'; f.rpDef = () => ({ id: 'trucks' }); eq('every other report keeps its old file name', f.rbFileStem(), 'report-orders'); }
{ const f = { Math, String, fmt: x => String(x), rbDef: () => sd.D.orders }; vm.createContext(f); vm.runInContext(['rbField', 'rbIsMeas', 'rbCellFmt', 'rbNumOut', 'rbNoTot'].map(grab).join('\n'), f);
  eq('on screen 1.5 bags reads 1.5', f.rbCellFmt('bagsleft', 1.5), '1.5');
  eq('no bag count reads —', f.rbCellFmt('bagsleft', null), '—');
  eq('Kg still read whole', f.rbCellFmt('shipleft', 14000.4), '14000');
  eq('the download keeps 1.5', f.rbNumOut('bagsleft', 1.5), '1.5');
  eq('the download keeps Kg whole', f.rbNumOut('shipleft', 14000.4), '14000');
  ok('bags have no total, Kg do', f.rbNoTot('bagsleft') === true && f.rbNoTot('shipleft') === false); }
ok('the report total and the print total leave bags blank', /rbNoTot\(k\)\?''/.test(grab('rpTableHTML')) && /if\(rbNoTot\(k\)\) return '<td class="num"><\/td>';/.test(grab('rbPrint')));
ok('the export uses rbNumOut (1 decimal for bags)', /rbNumOut\(k,r\[k\]\)/.test(grab('rbExport')));

/* ---- One customer ---- */
const oc = grab('rpCustomerHTML');
ok('One customer reads the same rows as Open orders', /RB_DATASETS\.orders\.rows\(\)/.test(grab('rpCustLines')) && /rpCustLines\(cl,true\)/.test(oc));
ok('1 row per product, with Left to ship and Bags left columns', /Orders, 1 row per product/.test(oc) && /<th class="num">Left to ship<\/th><th class="num">Bags left<\/th>/.test(oc));
ok('Left to ship first, Every line as a second view', /rpCustAll=false;render\(\)">Left to ship/.test(oc) && /rpCustAll=true;render\(\)">Every line/.test(oc));
ok('Print, CSV and Excel buttons, and a CSV for the trucks', /rpCustPrint\(\)/.test(oc) && /rpCustExport\(\\'csv\\'\)/.test(oc) && /rpCustExport\(\\'xls\\'\)/.test(oc) && /rpCustTrucksExport\(\)/.test(oc));
ok('still no prices on One customer', !/price|pkr\(|lineNetPrice/i.test(oc + grab('rpCustExport') + grab('rpCustPrint')));
ok('the file carries the customer and the unit on every row', /\['Customer'\]\.concat/.test(grab('rpCustExport')) && /\['unit','Unit'\]/.test(grabTopVar('RP_CUST_COLS', '[')));
ok('the orders open their sheet and the DC prints the DC, as before', /openOrderSheet\(/.test(oc) && /printDC\(/.test(oc));
ok('nothing in One customer writes a record', !/\bsave\(|logAction\(|\bstate\.[A-Za-z_$][\w$.]*\s*(=|\+=|-=)[^=]/.test(oc + grab('rpCustExport') + grab('rpCustPrint') + grab('rpCustTrucksExport') + grab('rpCustLines')));

/* ---- the Warehouse page ---- */
const sb = { String, state: {} }; vm.createContext(sb);
vm.runInContext(grabTopVar('MV_PAGE_USER', '{') + grabTopVar('MV_PAGE_ROLE', '{') + ['mvPageFor'].map(grab).join('\n'), sb);
eq('Shoaib (Warehouse) gets the Warehouse page', sb.mvPageFor('shoaib', 'Warehouse'), 'warehouse');
eq('Zain (Supply Chain Officer) gets the same page', sb.mvPageFor('zain', 'Supply Chain Officer'), 'warehouse');
eq('Saad keeps his own page', sb.mvPageFor('saad', 'Supply Chain'), 'saad');
ok('the page is in MV_PAGES with its title and topic', /warehouse:mvPageWarehouse\}/.test(html) && /warehouse:'Warehouse'\}/.test(grabTopVar('MV_TITLE', '{')) && /warehouse:'packed stock and trucks out'/.test(grabTopVar('MV_TOPIC', '{')));
const wp = grab('mvPageWarehouse');
ok('Q1: trucks out yesterday and not confirmed delivered', /mvTSales\(M\)/.test(wp) && /Not confirmed delivered/.test(wp) && /sp\.onRoad/.test(wp));
ok('Q2: packed stock ready to load, waiting for QA, on hold', /Packed stock in the warehouse/.test(wp) && /ready to load '\+mvN0\(rdy\)\+' · waiting for QA '\+mvN0\(qa\)\+' · on hold '\+mvN0\(held\)/.test(wp));
ok('Q3: the oldest packed stock', /Oldest packed stock/.test(wp) && /waiting 7 days or more/.test(wp));
ok('Q4: your jobs today and the daily comments due', /Your jobs on Today/.test(wp) && /mvComments\(M\)\.filter\(function\(x\)\{ return x\.need; \}\)/.test(wp));
ok('Q5: left to ship by customer, with the link to download', /Left to ship, by customer/.test(wp) && /mvWhLeftTable\(L\)/.test(wp) && /Open, download/.test(grab('mvWhLeftTable')));
ok('packed stock is split as Packed, waiting to ship splits it (lineCleared, lineHeld), with stock on a closed line apart', /lineCleared\(o,l\)/.test(grab('mvWhStock')) && /lineHeld\(o,l\)/.test(grab('mvWhStock')) && /noorder:Math\.max\(0,w-av\)/.test(grab('mvWhStock')));
ok('left to ship is the same rows as Open orders', /RB_DATASETS\.orders\.rows\(\)\.filter\(function\(r\)\{ return \(\+r\.shipleft\|\|0\)>0\.5; \}\)/.test(grab('mvWhLeft')));
ok('the link carries an index, never a customer name', /onclick="mvOpenCust\('\+i\+'\);return false"/.test(grab('mvWhLeftTable')));
{ const oc2 = grab('mvOpenCust'); ok('the link only opens One customer to read (sets the picked customer, opens the report)', /rpCust=c; rpCustAll=false; rpOpen\('customer'\);/.test(oc2) && !/\bsave\(|logAction\(|\bstate\./.test(oc2)); }
{ const mod = html.slice(html.indexOf('/* ===================== 2026-11-17a: THE WAREHOUSE PAGE'), html.indexOf('var MV_PAGES='));
  ok('the Warehouse block writes nothing', mod.length > 3000 && !/\bstate\.[A-Za-z_$][\w$.\[\]'"]*\s*(=|\+=|-=)[^=]/.test(mod) && !/\b(save|saveState|logAction|fetch|XMLHttpRequest)\s*\(/.test(mod) && !/localStorage|sessionStorage/.test(mod)); }
/* mvWhLeft and mvWhStock run */
{ const m = { Math, String, Object, state: { orders: [
    { po: '1', client: 'A', lines: [{ id: 'l1', brand: 'X', ordered: 200, packed: 60, dispatched: 0, _clr: 40, _held: 0 }] },
    { po: '21301', client: 'Maxim', lines: [{ id: 'l9', brand: 'Max Sulfur', ordered: 2000, packed: 2000, dispatched: 1000, shortClose: { approvedAt: '2026-10-01' }, _clr: 1000, _held: 0 }] },
    { po: '5', client: 'C', lines: [{ id: 'l5', brand: 'Z', ordered: 100, packed: 150, dispatched: 0, _clr: 150, _held: 0 }] }] } };
  vm.createContext(m);
  vm.runInContext(['mvGroup', 'mvSum', 'mvUniq', 'mvDiff', 'lineShortClosed', 'rbShipLeftOf', 'mvWhLeft', 'mvWhStock'].map(grab).join('\n') + '\nfunction lineCleared(o,l){ return l._clr; }\nfunction lineHeld(o,l){ return {kg:l._held}; }\nvar RB_DATASETS={orders:{rows:function(){ return [{client:"A",po:"1",product:"X",shipleft:100,ready:40,_lid:"l1"},{client:"A",po:"2",product:"Y",shipleft:0.3,ready:0,_lid:"l2"},{client:"B",po:"3",product:"Z",shipleft:500,ready:0,_lid:"l3"}]; }}};', m);
  const L = m.mvWhLeft({ late: [{ lid: 'l3' }] });
  ok('left to ship by customer, biggest first, under 0.5 left out', L.length === 2 && L[0].c === 'B' && L[0].left === 500 && L[1].left === 100 && L[1].rows.length === 1);
  ok('a late line is counted on its customer (the same late lines as Plant)', L[0].late === 1 && L[1].late === 0);
  const S = m.mvWhStock({ view: '2026-11-17', packs: [{ lid: 'l1', po: '1', brand: 'X', kg: 30, ship: 0, d: '2026-11-05' }, { lid: 'l1', po: '1', brand: 'X', kg: 30, ship: 30, d: '2026-11-01' }, { lid: 'l9', po: '21301', brand: 'Max Sulfur', kg: 1000, ship: 0, d: '2026-07-29' }] });
  const a = S.find(r => r.lid === 'l1'), mx = S.find(r => r.lid === 'l9'), c = S.find(r => r.lid === 'l5');
  ok('the oldest packed stock is the earliest pack run not fully shipped (5 Nov, not the shipped 1 Nov)', a.oldest === '2026-11-05' && a.days === 12);
  ok('an open line: 40 ready to load, 20 waiting for QA, nothing without an order', a.ready === 40 && a.awaitqa === 20 && a.noorder === 0 && a.open === true);
  ok('a line closed short: its 1,000 packed has no open order, and none of it is ready to load', mx.ready === 0 && mx.noorder === 1000 && mx.open === false && mx.days === 111);
  ok('packed beyond what the line still wants: 100 ready, 50 with no open order', c.ready === 100 && c.noorder === 50); }

/* ---- the screen, the Guide, the change log ---- */
ok('the page not set up message no longer says 7 people', /The Morning view has 8 pages, each for a named job/.test(grab('screenMorning')));
ok('Guide, How the app works: 8 pages, the Warehouse page for the Senior Warehouse Officer and the Supply Chain Officer', /has 8 pages/.test(grab('guideHow')) && /The Warehouse page is seen by the Senior Warehouse Officer and the Supply Chain Officer/.test(grab('guideHow')));
ok('Guide, My job: Warehouse and Supply Chain Officer are told', /var _n17a=\{'Warehouse':_wh17,'Supply Chain Officer':_wh17/.test(grab('guideMyJob')));
ok('change log 2026-11-17a and BUILD_ID', /ver:'2026-11-17a'/.test(html) && /var BUILD_ID='2026-11-17a'/.test(html));
report('2026-11-17a: left to ship, customer by customer, and the Warehouse Morning view');
