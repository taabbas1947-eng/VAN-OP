/* BUILD 2026-11-27b. Plant pulse (D-382, R-057). Tahir ruled on 27 Nov 2026: Reports + a strip at the top of the Morning
   view pages; the 7 roles of the production and packing record plus Supply Chain Officer and QCM; no money; entries that
   look doubled are marked; Today, Yesterday, Last 7 days, Pick a date, a week with 1 total a day. Reads only.
   Run: node pulse1127b.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const NAMES = ['plsDblTxt','plsDay','plsActiveShifts','plsTog','plsLinkLine','plsMay','plsAdd','plsWindow','plsSet','plsPl','plsIn','plsDoubles','plsData','plsShiftRank','plsGroups','plsShiftTxt','plsUnit','plsCol',
  'plsMissing','plsWeek','plsPeriodBar','plsHTML','plsToRecord','plsOpen','plsStrip','ppRows','ppLate','ppKgRun','ppDay','saleLeft','mvShipDate',
  'mvUnit','mvUnit1','mvUniq','mvN0','mvShortD','mvTile','mvEsc','qsEsc','mvHero','mvHero0','mvLbl'];
const box = (role, mayRp) => {
  const c = { console, Math, String, Date, JSON, Object, Array, isNaN };
  vm.createContext(c);
  vm.runInContext('var fmt=function(n){ return Math.round(n).toLocaleString("en-US"); }; var MV_MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; var MV_WD=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];\n' + NAMES.map(n => grab(n)).join('\n'), c);
  vm.runInContext(`
    var plsPer={mode:'yesterday'}, plsOpenK={}, _plsKeep=false, PLS_LINK_ONLY=['Fahim','Majid','Saad','Warehouse'], PLS_NO_LEFT=['Tahir Abbas','Yawar'], prpPer={}, prpView='batch', prpOpenK={}, calls=[];
    function evToday(){ return '2026-11-27'; }
    function mvShiftNames(){ return ['Morning','Evening','Night']; }
    function unitOf(b){ return /liquid/i.test(String(b))?'L':'Kg'; }
    function rpDef(id){ return {id:id}; }
    function rpMay(c){ return ${mayRp ? 'true' : 'false'}; }
    function canView(){ return true; }
    function ppMay(){ return ${mayRp ? 'true' : 'false'}; }
    function rpOpen(id){ calls.push('rp:'+id); }
    function render(){ calls.push('render'); }
    var state={role:${JSON.stringify(role)},currentUser:{name:'T'},
      batches:[{id:'b1',batchNo:'VU26196',base:'Sulfur Coated Urea'},{id:'b2',batchNo:'HG26056',base:'Potassium Humate'},{id:'b9',batchNo:'X9',base:'Potassium Humate',voided:true},{id:'b3',batchNo:'VG26008',base:'Liquid Phosphorus'}],
      orders:[{po:'23214',client:'MAXIM AGRI (PVT) LTD'},{po:'6595010646',client:'SYNGENTA PAKISTAN LIMITED',lines:[{price:999}]}],
      shiftEntries:[
        {id:'s1',batchId:'b1',batchNo:'VU26196',date:'2026-11-25',shift:'Morning',incharge:'Adnan Rasheed',kg:3500,recordedBy:'Jawad Naseer',recordedAt:'2026-11-25T21:53:34.575Z'},
        {id:'s2',batchId:'b1',batchNo:'VU26196',date:'2026-11-25',shift:'Morning',incharge:'Adnan Rasheed',kg:3500,recordedBy:'Jawad Naseer',recordedAt:'2026-11-25T21:54:03.236Z'},
        {id:'s3',batchId:'b2',batchNo:'HG26056',date:'2026-11-25',shift:'Night',incharge:'Waqas Haider',kg:6750,recordedAt:'2026-11-26T03:00:00Z'},
        {id:'s4',batchId:'b2',batchNo:'HG26056',date:'2026-11-25',shift:'Night',incharge:'Waqas Haider',kg:6750,recordedAt:'2026-11-26T03:07:00Z'},
        {id:'s5',batchId:'b9',batchNo:'X9',date:'2026-11-25',shift:'Evening',incharge:'Z',kg:999},
        {id:'s6',batchId:'b3',batchNo:'VG26008',date:'2026-11-26',shift:'Morning',incharge:'Faisal Nadeem',kg:4000,recordedAt:'2026-11-26T10:00:00Z'},
        {id:'s7',batchId:'b3',batchNo:'VG26008',date:'2026-11-19',shift:'Morning',incharge:'F',kg:100},
        {id:'e1',batchId:'b3',batchNo:'VG26008',date:'2026-11-12',shift:'Evening',incharge:'E',kg:10},{id:'e2',batchId:'b3',batchNo:'VG26008',date:'2026-11-13',shift:'Evening',incharge:'E',kg:10},{id:'e3',batchId:'b3',batchNo:'VG26008',date:'2026-11-14',shift:'Evening',incharge:'E',kg:10}],
      productionLog:[],
      packingLog:[
        {id:'p1',baseBatchId:'b1',brand:'Enrich',po:'6595010646',brandBatchNo:'VAN6KE003',date:'2026-11-25',shift:'Morning',incharge:'Farooq Khalid',kg:8144,packSize:8,packs:1018,recordedAt:'2026-11-25T12:00:00Z'},
        {id:'p2',baseBatchId:'b1',brand:'Max Sulfur',po:'23214',date:'2026-11-25',shift:'Night',incharge:'W',kg:225,reversed:true},
        {id:'p3',baseBatchId:'b1',brand:'Max Sulfur',po:'23214',date:'2026-11-25',shift:'Night',incharge:'W',kg:50,void:true,voidedKg:50}],
      shipments:[
        {id:'t1',dc:'5313',po:'6595010646',brand:'Enrich',vehicle:'LZB 6927',kg:8000,stage:'in_transit',approvedDate:'2026-11-25'},
        {id:'t2',dc:'5313',po:'6595010646',brand:'Enrich',vehicle:'LZB 6927',kg:500,stage:'in_transit',approvedDate:'2026-11-25'},
        {id:'t3',dc:'5399',po:'23214',brand:'Max Sulfur',vehicle:'X',kg:700,stage:'loading',dcStatus:'pending',approvedDate:'2026-11-25'},
        {id:'t4',dc:'5400',po:'23214',brand:'Max Sulfur',vehicle:'Y',kg:300,stage:'in_transit',voided:true,approvedDate:'2026-11-25'}]};
  `, c);
  return c;
};
const c = box('COO', true);
const W = (m, d) => { vm.runInContext('plsPer=' + JSON.stringify(d ? { mode: m, date: d } : { mode: m }) + ';', c); return c.plsWindow(); };

eq('Yesterday is the day before today', JSON.stringify([W('yesterday').from, W('yesterday').to]), '["2026-11-26","2026-11-26"]');
eq('Today', W('today').from, '2026-11-27');
eq('Last 7 days: today and the 6 days before', JSON.stringify([W('7').from, W('7').to, W('7').days]), '["2026-11-21","2026-11-27",7]');
eq('Pick a date', W('date', '2026-11-25').from, '2026-11-25');
eq('a month crossing: 1 Dec minus 1 day', c.plsAdd('2026-12-01', -1), '2026-11-30');

const D = c.plsData({ from: '2026-11-25', to: '2026-11-25', days: 1 });
eq('produced: the day\'s shift entries, a voided batch left out', Math.round(D.madeKg), 3500 + 3500 + 6750 + 6750);
eq('packed: reversed and voided runs not counted', Math.round(D.packedKg), 8144);
eq('left the gate: trucks counted as a sale; one still loading and a voided one left out', Math.round(D.leftKg), 8500);
eq('2 lines on 1 DC count as 1 truck', D.nTrucks, 1);
const dbl = D.made.filter(r => r._dbl != null);
eq('the entry typed 29 seconds after an identical one is marked, once', dbl.length, 1);
eq('it says 29 seconds', dbl[0]._dbl, 29);
ok('an identical entry typed 7 minutes later is not marked', !D.made.some(r => r.batch === 'HG26056' && r._dbl != null));
ok('the record\'s own rows are not changed by the mark', !c.ppRows().some(r => r._dbl != null));

vm.runInContext("plsPer={mode:'date',date:'2026-11-25'};", c);
const h = c.plsHTML();
ok('the page shows the 3 columns', /<div class="pls-k">Produced<\/div>/.test(h) && /<div class="pls-k">Packed<\/div>/.test(h) && /<div class="pls-k">Left the gate<\/div>/.test(h));
ok('produced entry shows batch, shift and in-charge', /VU26196 · Morning · Adnan Rasheed · 3,500/.test(h));
ok('the doubled entry is marked in words', /same batch, shift, in-charge and Kg as another entry typed 29 seconds apart/.test(h));
ok('packed entry shows packs, batch on the bag, PO, shift and in-charge', /1018 × 8 Kg · VAN6KE003 · PO 6595010646 · Morning · Farooq Khalid · 8,144/.test(h));
ok('truck entry shows DC, vehicle and product, grouped by client', /SYNGENTA PAKISTAN LIMITED/.test(h) && /DC 5313 · LZB 6927 · Enrich/.test(h));
ok('a running shift (3 days in the 14 before) that logged nothing on a past day is named', /Evening: nothing logged/.test(h));
ok('a shift that logged only on a voided batch, or not running, is not counted as running', JSON.stringify(c.plsActiveShifts('2026-11-10').all) === '[]');
vm.runInContext("plsPer={mode:'today'};", c); ok('Today names no shift: they may not have run yet', !/nothing logged/.test(c.plsHTML()) && /\(so far\)/.test(c.plsHTML()));
vm.runInContext("plsPer={mode:'date',date:'2026-12-25'};", c); eq('a future date is read as today', c.plsWindow().from, '2026-11-27');
ok('the date box stops at today', /max="2026-11-27"/.test(c.plsPeriodBar()));
vm.runInContext("plsPer={mode:'date',date:'2026-11-25'};", c);
ok('the summary counts the doubled entries, in good English', /1 entry looks doubled/.test(h));
eq('more than 1', c.plsDblTxt(2), '2 entries look doubled');
ok('dates are day first with the year', /Wed 25 Nov 2026/.test(h));
ok('a double stays in the total, as typed (ruling 27 Nov)', /produced <b>20,500<\/b>/.test(h));
ok('no price or value anywhere (ruling 3)', !/999|PKR|price|value/i.test(h.replace(/<[^>]+>/g,' ')));
ok('a single day opens each product', /<details class="pls-g" open ontoggle/.test(h));
ok('links to the record and the trucks report', /plsToRecord\('2026-11-25','2026-11-25'\)/.test(h) && /rpOpen\('trucks'\)/.test(h));

vm.runInContext("plsPer={mode:'7'};", c);
const wk = c.plsHTML();
eq('Last 7 days: 1 row a day', (wk.match(/<tr><td>/g) || []).length, 7);
ok('a week names each entry\'s day and keeps products closed', /Wed 25 Nov 2026 · VU26196/.test(wk) && !/<details class="pls-g" open/.test(wk));
ok('a week marks today as so far', /Fri 27 Nov 2026 \(so far\)/.test(wk));
vm.runInContext("plsTog('made|Sulfur Coated Urea',true,0);", c); ok('a group opened in a week stays open when the page is redrawn', /<details class="pls-g" open ontoggle="plsTog\(&quot;made\|Sulfur Coated Urea&quot;/.test(c.plsHTML()));
ok('a week does not name missing shifts', !/nothing logged/.test(wk));
ok('the 19 Nov entry is outside the 7 days', !/19 Nov 26/.test(wk));

vm.runInContext("plsToRecord('2026-11-21','2026-11-27');", c);
ok('More opens the production and packing record on the same days, entry by entry', c.calls.indexOf('rp:prodpack') > -1 && c.prpPer.mode === 'range' && c.prpPer.from === '2026-11-21' && c.prpView === 'entry');
vm.runInContext("plsOpen('2026-11-25');", c);
ok('the strip opens the pulse on its own day', c.plsPer.mode === 'date' && c.plsPer.date === '2026-11-25' && c.calls.indexOf('rp:pulse') > -1 && c._plsKeep === true);
vm.runInContext("plsOpen('2026-11-26');", c); eq('yesterday\'s page opens the pulse on Yesterday, with its chip lit', c.plsPer.mode, 'yesterday');

const st = c.plsStrip({ day: '2026-11-25' });
ok('Morning view strip: produced, packed, left the gate for the page\'s day', /Produced on 25 Nov/.test(st) && /Packed on 25 Nov/.test(st) && /Left the gate on 25 Nov/.test(st) && /20,500 Kg/.test(st) && /1 truck/.test(st));
ok('the strip says when entries look doubled', /1 entry looks doubled/.test(st));
const lk = c.plsStrip({ day: '2026-11-25' }, { name: 'Majid' });
ok('pages that already show made and packed or trucks out get only the link (ruling 27 Nov)', /Open the plant pulse/.test(lk) && !/Produced on/.test(lk));
ok('so do Fahim\'s, Saad\'s and the Warehouse page', ['Fahim','Saad','Warehouse'].every(n => !/Produced on/.test(c.plsStrip({ day: '2026-11-25' }, { name: n }))) && /Produced on/.test(c.plsStrip({ day: '2026-11-25' }, { name: 'Himayat' })));
ok('the hero carries the strip', c.mvHero({ name: 'T', title: 'x' }, { M: { day: '2026-11-25', view: '2026-11-26' }, title: 'T', line: '' }).indexOf('pls-strip') > -1);
const no = box('Finance', false);
eq('a role that may not open the pulse: no strip', no.plsStrip({ day: '2026-11-25' }), '');
ok('and the Morning view hero is as before', no.mvHero({ name: 'T', title: 'x' }, { M: { day: '2026-11-25', view: '2026-11-26' }, title: 'T', line: '' }).indexOf('pls-strip') < 0);

const x = box('COO', true); vm.runInContext("state.shiftEntries[0].incharge='<img src=x>'; state.orders[1].client='<b>C</b>'; plsPer={mode:'date',date:'2026-11-25'};", x);
ok('names are escaped', !/<img|<b>C<\/b>/.test(x.plsHTML()));

/* wiring */
const cat = (html.match(/\{id:'pulse', kind:'pulse'[^\n]*/) || [''])[0];
ok('Reports has Plant pulse for the 9 roles (ruling 2)', /roles:\['Production','Production Manager','Plant Manager','COO','CFO','Warehouse','Supply Chain','Supply Chain Officer','QCM'\]/.test(cat));
ok('it sits last in Reports → Production, so the Production card still opens the shift report first', /ids:\['prodshift','prodpack','batches','batchtrace','rm','pulse'\]/.test(html));
ok('from Reports it opens on Yesterday; from a Morning view page on that page\'s day', /else if\(c\.kind==='pulse'\)\{ if\(!_plsKeep\) plsPer=\{mode:'yesterday'\}; _plsKeep=false; plsOpenK=\{\}; \}/.test(html));
ok('the Morning view counts made like the record: voided batches out, Add missing production in', /return e&&e\.date&&!\(\(bById\[e\.batchId\]\|\|\{\}\)\.voided\);/.test(html) && /q&&q\.recon&&!q\.opening&&\(\+q\.kg\|\|0\)>0&&q\.date/.test(html));
ok('Reports draws it', /if\(c\.kind==='pulse'\) return h\+plsHTML\(\)\+'<\/div>';/.test(html));
ok('Guide rule The plant pulse is R-057', /'The plant pulse':'R-057'/.test(html) && /<h3>The plant pulse<\/h3>/.test(grab('guideRules')));
ok('Guide, how it works: The plant pulse', /<h2>The plant pulse<\/h2>/.test(grab('guideHow')));
ok('changelog 2026-11-27b', /\{ver:'2026-11-27b'/.test(html));
ok('BUILD_ID is this build or later', (html.match(/var BUILD_ID='([^']+)'/) || [])[1] >= '2026-11-27b');
ok('Morning view: a day of unpriced or FOC trucks is not "no truck" (COO and CFO pages count trucks, not value)', /\(S\.trucks\?\(S\.value\?mvEsc\(mvPkr\(S\.value\)\)/.test(html) && /var line=S\.trucks\?mvPl\(S\.trucks,'truck'\)/.test(html));
ok('the COO\'s and CFO\'s strip leaves out left the gate (their Sold on tile shows it)', !/Left the gate on/.test(c.plsStrip({ day: '2026-11-25' }, { name: 'Tahir Abbas' })) && !/Left the gate on/.test(c.plsStrip({ day: '2026-11-25' }, { name: 'Yawar' })) && /Produced on/.test(c.plsStrip({ day: '2026-11-25' }, { name: 'Yawar' })));
vm.runInContext("plsSet('date','2026-11-27');", c); eq('picking today in the box lights Today', c.plsPer.mode, 'today');
vm.runInContext("plsSet('date','2026-12-05');", c); eq('a typed future date becomes Today', c.plsPer.mode, 'today');
vm.runInContext("plsSet('date','2026-11-26');", c); eq('picking yesterday lights Yesterday', c.plsPer.mode, 'yesterday');
vm.runInContext("state.productionLog=[{recon:true,date:'2026-11-24',shift:'Evening',kg:500,batchNo:'VG26008',base:'Liquid Phosphorus'}];", c);
ok('Add missing production counts as a logged shift in the pulse, as on the Morning view', c.plsActiveShifts('2026-11-24').on.indexOf('Evening') > -1);
ok('an open group is remembered per column', /var kc=col\+'\|'\+k/.test(grab('plsGroups')));
ok('the strip link cannot leave a stale period behind', /function plsOpen\(d\)\{ if\(!plsMay\(\)\) return;/.test(html));
ok('Morning view: an entry with no shift is not a logged shift; a stock move copy is not another pack run', /if\(x\.shift\) sh\[x\.shift\]=1;/.test(grab('mvMadeOn')) && /filter\(function\(x\)\{ return !x\.moved; \}\)\.length,'pack run'/.test(grab('mvTPacked')));
report();
