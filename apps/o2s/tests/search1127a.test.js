/* BUILD 2026-11-27a. Search (Ctrl K) phase A (D-381, R-056). Tahir ruled on 27 Nov 2026: a product, a customer, a PO
   or a batch shows where it stands inside the search box; the PO link opens the PO itself; no price or value for
   anyone; at most 12 results; every role, each within its rights. Read only, no new sum. Before this build the
   search ran outside kamRun, so a KAM saw every client's POs in it (R-051).
   Run: node search1127a.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const NAMES = ['cmdkN','cmdkPl','cmdkLate','cmdkUnit','cmdkSplit','cmdkLateDays','cmdkSum','cmdkOpenRows','cmdkDue','cmdkByDue','cmdkProdTxt','cmdkNums','cmdkList',
  'cmdkLineRows','cmdkRp','cmdkKamNote','cmdkProductFill','cmdkCustomerFill','cmdkPOFill','cmdkStatus','cmdkBatchFill','cmdkBrandBatchFill',
  'cmdkProducts','cmdkCustomers','cmdkItems','cmdkFit','cmdkInputChanged','cmdkRender','cmdkSeen','cmdkTap','cmdkGo',
  'rbShipLeftOf','lineShortClosed','lineStage','qsEsc','kamRun','kamOn','kamName','kamKnown','kamCustOf','kamOwns'];
const box = (role, user) => {
  const c = { console, Math, String, Date, JSON, Object, Array, isNaN, parseFloat };
  vm.createContext(c);
  vm.runInContext('var fmt=function(n){ return Math.round(n).toLocaleString("en-US"); };var CMDK_MAX=12,_cmdkList=[],_cmdkOpen=-1;var _kamCallOnly=null,_kamKeep=null,_kamDepth=0,KAM_LISTS=["orders","shipments","inspections","packingLog","complaints","samples","batches","poMoves","customers"];\n'
    + NAMES.map(n => grab(n)).join('\n') + '\nvar _cmdkT=null; var CMDK_FILL={Product:cmdkProductFill,Customer:cmdkCustomerFill,PO:cmdkPOFill,Batch:cmdkBatchFill,BrandBatch:cmdkBrandBatchFill};', c);
  vm.runInContext(`
    var window=this; var calls=[], opened=null, rbFilters={}, rpCust='', rpCustAll=true, rpBt='', closed=0, el={};
    var BULK_BASES=['Potassium Humate'];
    function $(id){ return el[id]||(el[id]={value:'',innerHTML:'',focus:function(){}}); }
    function closeCmdK(){ closed++; }
    function unitOf(b){ return /liquid/i.test(b)?'L':'Kg'; }
    function packSizeTxt(l){ return l.pack?(l.pack+' '+unitOf(l.brand)+' pack'):''; }
    function lineCleared(o,l){ return +l.cleared||0; }
    function lineHeld(o,l){ return {kg:+l.held||0}; }
    function lineOverdue(o,l){ return !!l.late; }
    function isOverdue(o){ return (o.lines||[]).some(function(l){ return l.late; }); }
    function daysOver(o){ return 5; }
    function calDays(){ return 5; }
    function stageOf(o){ return lineStage(o,o.lines[0]); }
    function baseStockKg(b){ return {packable:2500,physical:2600,producing:[{}]}; }
    function batchTrace(b){ return {produced:40000,packed:39600,shipped:35200,inStock:4400,rows:[{brand:'Brand X',brandNo:'X1',po:'90001',kg:39600}]}; }
    var RPS={openorders:1,customer:1,batchtrace:1};
    function rpDef(id){ return {id:id}; }
    function rpMay(c){ return !!(c&&RPS[c.id]); }
    function rpOpen(id){ calls.push('rp:'+id); }
    function render(){ calls.push('render'); }
    function setScreen(s){ calls.push('screen:'+s); }
    function openOrderSheet(id){ opened=id; }
    function canView(r,s){ return s!=='nope'; }
    function mvMay(){ return false; }
    var SCREENS=[{id:'tracker',name:'Orders'},{id:'prod',name:'Production'},{id:'approvals',name:'Approvals'}];
    var state={role:${JSON.stringify(role)},currentUser:${JSON.stringify(user||{})},masters:{kamNames:['Ali KAM']},
      customers:[{code:'C1',name:'Client M',kam:'Ali KAM'},{code:'C2',name:'Client B',kam:'Other KAM'}],
      orders:[
        {id:'o1',po:'90020',client:'C1 | Client M',lines:[{id:'l1',brand:'Product M',pack:10,ordered:1000,packed:420,dispatched:0,cleared:420,committed:'2026-11-20',late:true,soCreated:1,rmReady:1,prodStart:1}]},
        {id:'o2',po:'90021',client:'C1 | Client M',lines:[{id:'l2',brand:'Product M',pack:1,ordered:1000,packed:0,dispatched:0,committed:'2026-11-28',soCreated:1}]},
        {id:'o3',po:'90010',client:'C2 | Client B',lines:[{id:'l3',brand:'Product A',ordered:1800,packed:1800,dispatched:0,cleared:1800,committed:'2026-11-30',qcPass:1},{id:'l4',brand:'Product A Liquid',ordered:500,packed:0,dispatched:0}]},
        {id:'o4',po:'90011',client:'C2 | Client B',closed:true,lines:[{id:'l5',brand:'Product A',base:'Potassium Humate',ordered:900,packed:900,dispatched:400,price:999}]},
        {id:'o5',po:'90012',client:'C2 | Client B',lines:[{id:'l6',brand:'Product A',base:'Potassium Humate',ordered:2000,packed:600,dispatched:0,cleared:200,held:300,committed:'2026-12-08',price:5000}]}
      ],
      batches:[{id:'b1',batchNo:'XB26001',base:'Potassium Humate',status:'closed',kind:'bulk'},{id:'b2',batchNo:'XB26009',base:'Potassium Humate',status:'open',kind:'bulk',voided:true}],
      packingLog:[{id:'p1',brandBatchNo:'PA26001',baseBatchId:'b1',brand:'Product A',po:'90012',kg:600,shipKg:0,insKg:200},{id:'p2',brandBatchNo:'PA26002',brand:'Product A',po:'90012',kg:50,reversed:true}],
      shipments:[{dispId:'D1',dc:'1001',vehicle:'ABC-123',po:'90011',brand:'Product A'}]};
  `, c);
  return c;
};
const c = box('COO');
const items = q => c.cmdkItems(q);
const kinds = a => a.map(x => x.k).join(',');

/* the 4 answers */
let r = items('product a');
eq('a product name gives the product first', r[0].k, 'Product');
ok('product line: 2 open lines on 2 POs, a closed PO left out', /2 open lines on 2 POs/.test(r[0].sub));
ok('product line: left to ship = ordered minus shipped on open lines (1,800 + 2,000)', /3,800 Kg left to ship/.test(r[0].sub));
ok('product line: cleared and ready (1,800 + 200)', /2,000 cleared, ready/.test(r[0].sub));
ok('product card: on hold uses lineHeld within what is packed and left (300)', /<b>300<\/b><span>On hold/.test(r[0].card));
ok('product card: waiting for QA is the rest of packed and left (600 - 200 - 300 = 100)', /<b>100<\/b><span>Packed, waiting for QA/.test(r[0].card));
ok('product card: a bulk base shows its packable stock and batches in production', /Base packable, Potassium Humate/.test(r[0].card) && /Base batches in production/.test(r[0].card));
ok('product card lists each open line with stage and pack size', /PO 90012<\/b> · C2 \| Client B<span>/.test(r[0].card) && /QC Passed/.test(r[0].card) && /90012/.test(r[0].card) && !/90011/.test(r[0].card));
ok('a 2nd product matching the words is listed too (at most 3)', r.filter(x => x.k === 'Product').length === 2 && r.some(x => x.t === 'Product A Liquid'));
ok('the liquid product shows L, not Kg', /L left to ship/.test(r.find(x => x.t === 'Product A Liquid').sub));

r = items('client m');
eq('a customer name gives the customer', r.find(x => x.k === 'Customer').t, 'C1 | Client M');
const cu = r.find(x => x.k === 'Customer');
ok('customer line: 2 open POs, 2 lines, 2,000 left, 1 line late', /2 open POs · 2 lines · 2,000 Kg left to ship · 420 cleared, ready · .*1 line late/.test(cu.sub));
ok('customer card shows the pack size of each line', /Product M, 10 Kg pack/.test(cu.card) && /Product M, 1 Kg pack/.test(cu.card));
ok('customer card: the late line first, with days late', cu.card.indexOf('90020') < cu.card.indexOf('90021') && /5 days late/.test(cu.card));

r = items('90021');
const po = r.find(x => x.k === 'PO');
ok('PO line: stage, lines, left to ship, committed date', /SO Created · 1 line · 1,000 Kg left to ship · 0 cleared, ready · committed 2026-11-28/.test(po.sub));
ok('PO card: ordered, packed, shipped, left per line', /ordered 1,000 · packed 0 · shipped 0 · left to ship 1,000 Kg/.test(po.card));
po.go(); eq('PO link opens the PO sheet itself (ruling 1)', c.opened, 'o2');
ok('a late PO says how many days late', /5 days late/.test(items('90020').find(x => x.k === 'PO').sub));

r = items('xb26');
const bt = r.filter(x => x.k === 'Batch');
eq('a voided batch is not offered', bt.length, 1);
ok('batch line from Batch trace: produced, packed, shipped', /produced 40,000 · packed 39,600 · shipped 35,200/.test(bt[0].sub));
bt[0].go(); ok('batch link opens Batch trace with the batch picked', c.rpBt === 'XB26001' && c.calls.indexOf('rp:batchtrace') > -1);
r = items('pa2600');
const bb = r.filter(x => x.k === 'Batch');
eq('a reversed packing run is not offered as a brand batch', bb.length, 1);
ok('brand batch: packed, shipped, its base batch', /Brand batch · packed 600 · shipped 0 · PO 90012 · base XB26001/.test(bb[0].sub));

/* ruling 2: no money anywhere */
const all = ['product a', 'client', '900', 'xb', 'pa', 'abc'].map(items).reduce((a, b) => a.concat(b), []);
ok('no price or value in any line or card (ruling 2)', all.every(x => !/5,000|999|PKR|price|value/i.test((x.sub || '') + (x.card || ''))));

/* ruling 3: at most 12; products and customers at most 3 each; POs, batches, trucks share the rest */
r = items('0');
ok('never more than 12 results', r.length <= 12);
const many = { k: 'PO' }; const big = c.cmdkFit([{k:'Product'},{k:'Customer'}].concat(Array(20).fill(many), Array(6).fill({k:'Batch'}), Array(6).fill({k:'Shipment'})));
eq('12 kept when there are more', big.length, 12);
ok('batches and trucks keep a place when POs are many', big.filter(x => x.k === 'Batch').length >= 3 && big.filter(x => x.k === 'Shipment').length >= 3);
ok('order kept: products, customers, POs, batches, trucks', kinds(big).indexOf('Product') === 0 && kinds(big).lastIndexOf('PO') < kinds(big).indexOf('Batch') && kinds(big).lastIndexOf('Batch') < kinds(big).indexOf('Shipment'));
eq('an empty box shows the screens only, as before', kinds(items('')), 'Screen,Screen');

/* rights: a link only where the role may open it */
vm.runInContext('RPS={}; canView=function(r,s){ return s!=="tracker"; };', c);
r = items('product a').concat(items('90021'), items('xb26'));
ok('no report or PO rights: the line and card stay, the link goes', r.filter(x => x.k !== 'Screen' && x.k !== 'Shipment').every(x => !x.go && x.card));

/* R-051: a KAM sees his own clients only, the search runs inside kamRun */
const k = box('KAM', { name: 'Ali KAM', username: 'ali' });
vm.runInContext("$('cmdkInput').value='client'; cmdkRender();", k);
const out = k.el.cmdkRes.innerHTML;
ok('KAM: his own client shows', /Client M/.test(out));
ok('KAM: another KAM\'s client and its POs do not show (R-051)', !/Client B/.test(out) && !/90010|90011|90012/.test(out));
vm.runInContext("$('cmdkInput').value='product a'; cmdkRender();", k);
ok('KAM: a product only his clients do not buy gives nothing of theirs', !/90010|90012|Client B/.test(k.el.cmdkRes.innerHTML));
eq('KAM: the full lists are back after search', k.state.orders.length, 5);

/* the box: tap opens the card, Enter again follows the link */
vm.runInContext('canView=function(){ return true; }; RPS={openorders:1,customer:1,batchtrace:1};', c);
vm.runInContext("$('cmdkInput').value='90021'; cmdkRender();", c);
const i = c._cmdkList.findIndex(x => x.k === 'PO');
vm.runInContext('cmdkTap(' + i + ')', c);
ok('tap a PO: its card opens in the box', /cmdk-card/.test(c.el.cmdkRes.innerHTML));
vm.runInContext('cmdkTap(' + i + ')', c);
ok('tap it again: the card closes', !/cmdk-card/.test(c.el.cmdkRes.innerHTML));
vm.runInContext("$('cmdkInput').value='orde'; cmdkRender(); cmdkTap(0);", c);
ok('a screen result opens the screen at once', c.calls.indexOf('screen:tracker') > -1 && c.closed > 0);
ok('typing again closes any open card', (vm.runInContext("_cmdkOpen=0; cmdkRender(); _cmdkOpen", c)) === -1);

/* review fixes, 27 Nov */
const f = box('COO');
vm.runInContext("rbFilters={}; var pr=cmdkItems('product a')[0]; pr.go();", f);
eq('product link: Open orders with no hidden product filter', JSON.stringify(f.rbFilters), '{}');
vm.runInContext("state.orders.unshift({id:'o9',po:'90099',client:'C2 | Client B',lines:[{id:'l9',brand:'Product A',ordered:5,dispatched:5,delivered:5}]});", f);
const pos = f.cmdkItems('client b').filter(x => x.k === 'PO').map(x => x.o.po);
ok('open POs come before finished ones', pos.indexOf('90099') > pos.indexOf('90010') && pos.indexOf('90099') > pos.indexOf('90012'));
vm.runInContext("SCREENS=[1,2,3,4,5,6].map(function(n){ return {id:'s'+n,name:'Client screen '+n}; });", f);
const sc = f.cmdkItems('client');
ok('at most 3 screens, so products and customers still show', sc.filter(x => x.k === 'Screen').length === 3 && sc.some(x => x.k === 'Customer'));
vm.runInContext("canView=function(r,s){ return s!=='ship'; };", f);
ok('a truck shows only to those who may open Shipments', !f.cmdkItems('abc').some(x => x.k === 'Shipment'));
vm.runInContext("canView=function(r,s){ return s!=='reports'; };", f);
ok('no Reports screen: no report link', f.cmdkItems('product a')[0].go == null);
vm.runInContext("canView=function(){ return true; }; state.batches.push({id:'b3',batchNo:'XB26001 ',base:'Potassium Humate',status:'open',kind:'bulk'});", f);
const two = f.cmdkItems('xb26001').filter(x => x.k === 'Batch');
eq('2 batches with the same number both show', two.length, 2);
two[1].go(); eq('the batch number goes to Batch trace trimmed', f.rpBt, 'XB26001');
vm.runInContext("state.packingLog.push({id:'p7',brandBatchNo:'PB26007',baseBatchNo:'XB26001',brand:'Product A',po:'90010',kg:40,shipKg:10},{id:'p8',brandBatchNo:'PB26007',baseBatchNo:'XB26001',brand:'Product A',po:'90012',kg:60});", f);
const pb = f.cmdkItems('pb26007').find(x => x.k === 'Batch');
ok('brand batch with only a base batch number: linked to its base, and 2 POs counted', pb.go && /2 POs · base XB26001/.test(pb.sub) && /Packed, not shipped/.test(pb.card));
const kb = box('KAM', { name: 'Ali KAM', username: 'ali' });
vm.runInContext("$('cmdkInput').value='xb26'; cmdkRender();", kb);
ok('KAM: a batch shows packed for his clients and no produced figure', /packed 39,600 for your clients/.test(kb.el.cmdkRes.innerHTML) && !/produced/i.test(kb.el.cmdkRes.innerHTML));
vm.runInContext("batchTrace=function(){ throw new Error('x'); }; console.error=function(){};", f);
const bx = f.cmdkItems('xb26').find(x => x.k === 'Batch');
ok('a batch whose figures cannot be read says so, never an empty tap', /could not be read/.test(bx.card));
vm.runInContext("$('cmdkInput').value='client'; cmdkRender(); cmdkTap(4); cmdkTap(4);", f);
eq('closing a card keeps the highlight on its row', f._cmdkSel, 4);

/* 2nd review fixes, 27 Nov */
ok('Ctrl K does not open the box behind an open sheet', /if\(document\.querySelector\('\.modal-bg\.open'\)\) return;/.test(grab('openCmdK')));
ok('closing the box cancels a search still waiting to run', /clearTimeout\(_cmdkT\)/.test(grab('closeCmdK')));
ok('Enter while typing in Urdu or held down does nothing', /e\.isComposing\|\|\(e\.key==='Enter'&&e\.repeat\)/.test(grab('cmdkKey')));
ok('arrows and Enter search what was typed first', /\(e\.key==='Enter'\|\|e\.key==='ArrowDown'\|\|e\.key==='ArrowUp'\)&&_cmdkT/.test(grab('cmdkKey')));
const t2 = box('COO');
vm.runInContext("var _ran=0; $('cmdkInput').value='client m'; cmdkRender(); _cmdkT=1; clearTimeout=function(){}; cmdkTap(0);", t2);
ok('a tap on the old list while a search waits shows the new list and opens nothing', t2._cmdkT === null && t2._cmdkOpen === -1);
ok('Batch trace finds a batch stored with spaces around its number', /String\(b\.batchNo\)\.trim\(\)\.toLowerCase\(\)===q/.test(grab('rpBatchTraceHTML')));

ok('product card: 2 lines of different pack size on one client can be told apart', /PO 90020<\/b> · C1 \| Client M · 10 Kg pack/.test(items('product m')[0].card) && /PO 90021<\/b> · C1 \| Client M · 1 Kg pack/.test(items('product m')[0].card));
ok('on a small phone a long name is shortened so the clock still fits', /@media \(max-width:420px\)\{\.qs-right\{gap:6px;min-width:0\}[^}]*\}\.qs-me \.nm,\.qs-me \.tt\{max-width:84px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/.test(html));
/* text is safe */
const x = box('COO'); vm.runInContext("state.orders[0].client='<img src=x onerror=1> | Bad'; state.orders[0].lines[0].brand='<b>P</b>';", x);
ok('names are escaped in lines and cards', x.cmdkItems('bad').concat(x.cmdkItems('<b>')).every(y => !/<img|<b>P<\/b>/.test(y.t + (y.sub || '') + (y.card || ''))));

/* wiring in the page */
ok('Enter on an open card follows its link, and does nothing more where there is none', /if\(it&&it\.card&&_cmdkOpen===sel\)\{ if\(it\.go\) cmdkGo\(sel\); return; \}/.test(html));
ok('the search runs inside kamRun', /kamRun\(function\(\)\{ return cmdkItems\(q\); \}\)/.test(grab('cmdkRender')));
ok('the box opens from a magnifier at the top right of the header, beside the name, reachable by Tab (ruling of 27 Nov)', /<div class="qs-right"><a class="qs-find" href="#" onclick="openCmdK\(\);return false"[^>]*aria-label="Search">/.test(html));
ok('no rule hides the search box for good (it was hidden from 23 Sep to 27 Nov)', !/[,{]\s*\.cmdk\s*[,{][^}]*display:none!important/.test(html.replace(/\/\*[\s\S]*?\*\//g,'')) && /\.cmdk\{display:none\}\.cmdk\.open\{display:flex/.test(html));
ok('the box has a Close button, and Escape closes it from anywhere', /<button class="cmdk-x" type="button" onclick="closeCmdK\(\)">Close<\/button>/.test(html) && /else if\(e\.key==='Escape'\)\{ var c=\$\('cmdk'\); if\(c&&c\.classList\.contains\('open'\)/.test(html));
ok('closing the box lets go of the typing focus', /i\.blur\(\)/.test(grab('closeCmdK')));
ok('typing waits 180 ms before searching; Enter searches at once', /setTimeout\(function\(\)\{ _cmdkT=null; cmdkRender\(\); \},180\)/.test(grab('cmdkInputChanged')) && /oninput="cmdkInputChanged\(\)"/.test(html));
ok('the box says what it finds', /placeholder="Product, customer, PO or batch…"/.test(html));
ok('Guide rule What Search shows is R-056', /'What Search shows':'R-056'/.test(html) && /<h3>What Search shows<\/h3>/.test(html));
ok('Guide, how it works: Finding where something stands', /<h2>Finding where something stands<\/h2>/.test(html));
ok('R-051 says Search too', /Search shows him only his own clients too/.test(html));
ok('changelog 2026-11-27a', /\{ver:'2026-11-27a'/.test(html));
ok('BUILD_ID is this build or later', (html.match(/var BUILD_ID='([^']+)'/) || [])[1] >= '2026-11-27a');
report();
