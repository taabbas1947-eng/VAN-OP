/* BUILD 2026-11-27c. Entry safeguards (D-383, R-058). Tahir ruled on 27 Nov 2026: the sheet shows the limit while
   typing (shift output room, whole packs that fit, every brand batch # check); a second shift entry for the same batch,
   day, shift and in-charge is shown early and Save needs a note on why it is a second run. No limit or rule changes.
   Run: node safe1127c.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const c = { console, Math, String, Date, JSON, Object, Array, isNaN, Infinity };
vm.createContext(c);
vm.runInContext('var fmt=function(n){ return Math.round(n).toLocaleString("en-US"); }; var PACK_FLAG_KG=10000;\n'
  + ['slRoom','slOverTxt','_bnoKey','plsDoubles','slSig','slDups','slDupHTML','packFitHTML','packFormOf','packEntryCalc','packBbState','packBbHTML','packSimilarNos','bnoLookAlike','lotBrandNo','lotBaseNo','fyKey','batchOverPct','batchCeilingKg','qsEsc','ppDay','plsDay','mvLbl','prodTiles'].map(grab).join('\n'), c);
vm.runInContext("var MV_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], MV_WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];", c);
vm.runInContext(`
  var TODAY=new Date('2026-11-27T10:00:00Z');
  function evToday(){ return '2026-11-27'; }
  function _av(s){ return String(s==null?'':s).replace(/"/g,'&quot;'); }
  function localWhenOf(t){ var d=new Date(Date.parse(t)+5*3600000); return d.toISOString().slice(0,16).replace('T',' '); }
  function unitOf(b){ return 'Kg'; }
  function batchPackableKg(b){ return +b.packable||0; }
  function seedPackForBrand(){ return 0; }
  function packSizeOf(l){ return +((l&&l.pack)||0); }
  function pqMax(o,l){ return 120; }
  function lineFacts(){ return null; }
  var shiftForm={}, packForm={}, pqForm={}, divForm={}, dfForm={}, lfForm={};
  var state={batches:[
      {id:'b1',batchNo:'VU26196',kind:'bulk',base:'Sulfur Coated Urea',plannedKg:7000,producedKg:7000,status:'open',openedDate:'2026-11-20'},
      {id:'b2',batchNo:'MS26001',kind:'po',po:'23215',lineId:'l1',plannedKg:2000,producedKg:700,status:'open'},
      {id:'b3',batchNo:'NP1',kind:'bulk',plannedKg:0,producedKg:10},
      {id:'g1',batchNo:'GS10460',kind:'bulk',base:'Sulfur 70%',packable:180,openedDate:'2026-10-01'}],
    orders:[{id:'o1',po:'23215',lines:[{id:'l1',brand:'Max Sulfur',ordered:1000,produced:700,packed:0,pack:1},{id:'l2',brand:'Max Sulfur',ordered:500,packed:100}]}],
    shiftEntries:[{id:'SE7097',batchId:'b1',batchNo:'VU26196',date:'2026-11-25',shift:'Morning',incharge:'Adnan Rasheed',kg:3500,by:'Jawad Naseer',ts:'2026-11-25T21:53:34.575Z'}],
    packingLog:[{id:'p1',brand:'Max Sulfur',brandBatchNo:'MAXS10460',baseBatchNo:'GS10460',date:'2026-11-25',po:'23214'},{id:'p2',brand:'Enrich',brandBatchNo:'VAN6KE003',date:'2026-11-20'}]};
`, c);
const B = id => c.state.batches.find(x => x.id === id);

/* 1. room left */
const r1 = c.slRoom(B('b1'));
eq('VU26196: most you can still log is 1,050 (115% of 7,000 is 8,050, made 7,000)', r1.room, 1050);
eq('...limited by the ceiling', r1.by, 'ceiling');
const r2 = c.slRoom(B('b2'));
eq('a PO batch: what the PO still needs when that is smaller (1,000 ordered, 700 produced)', r2.room, 300);
eq('...and it says the PO', r2.by, 'PO');
eq('a bulk batch with no plan has no limit, as Save', c.slRoom(B('b3')), null);
const o1 = c.slOverTxt(B('b1'), 1500);
ok('typing 1,500 says it is over, with 1,050 and 8,050', /1,500 is more than this batch may still log: 1,050 Kg\/L\. 115% of 7,000 Kg\/L planned is 8,050 Kg\/L\. For more, the Plant Manager or COO raises the plan first\.$/.test(o1));
eq('typing 1,050 is fine', c.slOverTxt(B('b1'), 1050), '');
ok('a PO batch names the PO', /on PO 23215 is ordered 1,000 Kg\/L, and production cannot exceed the PO\.$/.test(c.slOverTxt(B('b2'), 400)));

/* 2. a second run */
vm.runInContext("shiftForm={batchId:'b1',date:'2026-11-25',shift:'Morning',incharge:''};", c);
eq('nothing shown before the in-charge is picked', c.slDups().length, 0);
vm.runInContext("shiftForm.incharge='Adnan Rasheed';", c);
eq('the entry already there is found once shift and in-charge are picked', c.slDups().length, 1);
const dh = c.slDupHTML();
ok('the sheet says Already logged, with Kg, who and when (plant time)', /Already logged/.test(dh) && /3,500 Kg\/L/.test(dh) && /Jawad Naseer on Thu 26 Nov 2026 at 02:53/.test(dh));
ok('...and has the box for why it is a second run', /Why is this a second run\?/.test(dh) && /oninput="shiftForm\.dupNote=this\.value;shiftForm\.dupSig=slSig\(\)"/.test(dh));
vm.runInContext("shiftForm.shift='Evening';", c);
eq('another shift is not a second run', c.slDups().length, 0);
vm.runInContext("shiftForm.shift='Morning'; shiftForm.dupNote='bed 2'; shiftForm.dupSig='b1|2026-11-25|Morning|Someone';", c);
ok('a note typed for another in-charge is not shown here', !/value="bed 2"/.test(c.slDupHTML()));
const sub = grab('submitShiftLog');
ok('Save needs the note for this batch, day, shift and in-charge (3 characters or more)', /var _dupNote=\(shiftForm\.dupSig===_sig\)\?String\(shiftForm\.dupNote\|\|''\)\.trim\(\):'';/.test(sub) && /if\(_dup && _dupNote\.length<3\)/.test(sub));
ok('the second press alone is gone', !/dupOk/.test(sub));
ok('the note is kept on the entry', /secondRun:_dup\?_dupNote:undefined/.test(sub));
ok('slSig is the same key Save uses', /var _sig=b\.id\+'\|'\+d\+'\|'\+shiftForm\.shift\+'\|'\+shiftForm\.incharge;/.test(sub) && /return \[f\.batchId,f\.date\|\|TODAY\.toISOString\(\)\.slice\(0,10\),f\.shift,f\.incharge\]\.join\('\|'\)/.test(grab('slSig')));
const rs = grab('renderShiftLog');
ok('the sheet shows the room tile, the live line and the second-run box; picking shift or in-charge redraws', /most you can still log/.test(rs) && /oninput="shiftForm\.qty=this\.value;slCheck\(\)"/.test(rs) && /\$\{slDupHTML\(\)\}/.test(rs) && /shiftForm\.shift=this\.value;renderShiftLog\(\)/.test(rs) && /shiftForm\.incharge=this\.value;renderShiftLog\(\)/.test(rs));

/* 3. packs that fit */
vm.runInContext("packForm={bid:'g1',oid:'o1',lid:'l1',kg:''};", c);
eq('Pack: 180 packs fit, limited by GS10460, the PO still needs 1,000', c.packFitHTML('pack').replace(/<[^>]+>/g, ''), 'Fits: up to 180 packs (180 Kg), limited by base batch GS10460. The PO still needs 1,000 Kg.');
vm.runInContext("packForm.bid='';", c);
eq('no base batch picked yet: nothing', c.packFitHTML('pack'), '');
vm.runInContext("pqForm={oid:'o1',lid:'l1',qty:''};", c);
ok('run sheet: limited by the batch (pqMax 120 < 1,000)', /up to <b>120 packs<\/b>/.test(c.packFitHTML('pq')) && /limited by the batch/.test(c.packFitHTML('pq')));
vm.runInContext("divForm={oid:'o1',lid:'l1',qty:''};", c);
ok('Divert: limited by what the PO still needs', /up to <b>1,000 packs<\/b>/.test(c.packFitHTML('div')) && /limited by what the PO still needs/.test(c.packFitHTML('div')));
vm.runInContext("packForm={bid:'g1',oid:'o1',lid:'l2'};", c);
eq('a line with no pack size: nothing (the Kg/L box stays)', c.packFitHTML('pack'), '');
eq('the correction sheets are not in this build', c.packFitHTML('df') + c.packFitHTML('lf'), '');
ok('the packs box carries it', /'\+packFitHTML\(kind\)\+'<\/div>'; \}/.test(grab('packQtyHTML')));

/* 4. brand batch # */
const S = no => { vm.runInContext("packForm={bid:'g1',brand:'Max Sulfur',packDate:'2026-11-27',brandBatch:" + JSON.stringify(no) + "};", c); return c.packBbState(); };
ok('blank: the bags carry the base number', /Blank: the bags carry the base batch number GS10460/.test(S('').t));
eq('the base number itself', S('GS10460').k, 'ok');
eq('another base batch number this year: refused', S('VU26196').k, 'bad');
ok('another brand\'s number this year: refused, naming the brand', S('VAN6KE003').k === 'bad' && /Enrich/.test(S('VAN6KE003').t));
ok('already on this brand: adds to it', S('MAXS10460').k === 'info' && /adds to that batch/.test(S('MAXS10460').t));
ok('1 letter different: Pack asks once', S('MAXT10460').k === 'warn' && /1 character different from MAXS10460/.test(S('MAXT10460').t));
eq('the next number in the series is not a look-alike (the existing rule)', S('MAXS10461').k, 'ok');
eq('new this year', S('MAXS20001').k, 'ok');
ok('the text is escaped', !/<img/.test(c.packBbHTML.call(null) + (S('<img src=x>') && c.packBbHTML())));
ok('the box checks as it is typed', /oninput="packForm\.brandBatch=this\.value;packBbCheck\(\)"/.test(html) && /\$\{packBbHTML\(\)\}/.test(grab('renderPackModal')));
ok('Pack itself still runs its own checks', /baseClash/.test(grab('doPack')) && /otherBrandClash/.test(grab('doPack')) && /packSimilarNos\(brand,brandBatchNo,d\)/.test(grab('doPack')));

/* review fixes, 27 Nov */
vm.runInContext("state.batches.push({id:'b9',batchNo:'X9',kind:'bulk',plannedKg:1001,producedKg:0,status:'open'});", c);
eq('the room is the exact figure Save uses (115% of 1,001 is 1,151.15)', Math.round(c.slRoom(B('b9')).room*100)/100, 1151.15);
eq('...so 1,151.1 is not called too much', c.slOverTxt(B('b9'), 1151.1), '');
vm.runInContext("state.shiftEntries.push({id:'z',batchId:'b1',date:'2026-11-26',shift:'Night',incharge:'W',kg:0,reason:'Power'}); shiftForm={batchId:'b1',date:'2026-11-26',shift:'Night',incharge:'W'};", c);
eq('an earlier 0 Kg entry (nothing made) is not a run: no note asked', c.slDups().length, 0);
ok('Save matches: a 0 Kg entry is not a duplicate', /e\.incharge===shiftForm\.incharge && \(\+e\.kg\|\|0\)>0; \}\)\[0\];/.test(grab('submitShiftLog')));
vm.runInContext("state.batches.push({id:'pool1',batchNo:'P1',plannedKg:250}); divForm={oid:'o1',lid:'l1',qty:'',poolId:'pool1'};", c);
ok('Divert: the pool limits too, as Save refuses above it', /up to <b>250 packs<\/b>/.test(c.packFitHTML('div')) && /limited by what the pool holds/.test(c.packFitHTML('div')));
ok('a brand batch # that differs only in capitals is named, not called new', S('maxs10460').k === 'warn' && /only capitals or spaces differ/.test(S('maxs10460').t));
const two = [{kind:'Produced',date:'2026-11-25',batch:'V',brandBatch:'',po:'',shift:'M',inch:'A',kg:3500,at:'2026-11-25T21:53:34Z'},{kind:'Produced',date:'2026-11-25',batch:'V',brandBatch:'',po:'',shift:'M',inch:'A',kg:3500,at:'2026-11-25T21:54:03Z',secondRun:'second bed'}];
c.plsDoubles(two);
ok('a second run with its note is not marked as looking doubled', two[1]._dbl == null);
ok('the note shows in the production record and the pulse', /if\(e\.secondRun\) mk\.push\(\{t:'Second run: '\+e\.secondRun/.test(grab('ppRows')) && /second run: '\+qsEsc\(r\.secondRun\)/.test(grab('plsHTML')));

/* Guide and build */
ok('Guide rule The sheet tells you the limit is R-058', /'The sheet tells you the limit':'R-058'/.test(html) && /<h3>The sheet tells you the limit<\/h3>/.test(grab('guideRules')));
ok('R-033 says the sheet shows the room', /The Log shift output sheet shows the most you can still log/.test(grab('guideRules')));
ok('changelog 2026-11-27c', /\{ver:'2026-11-27c'/.test(html));
ok('BUILD_ID is this build or later', (html.match(/var BUILD_ID='([^']+)'/) || [])[1] >= '2026-11-27c');
/* browser review fixes, 27 Nov: colour, the 4th tile, units */
ok('the safeguard notes carry their own colour (sheets open outside .qs)', /\.note\.sg\{[^}]*border-left:3px solid/.test(html) && /\.note\.sg\.bad\{background:var\(--red-50\);border-left-color:var\(--red\)\}/.test(html) && /\.note\.sg\.warn\{/.test(html) && /\.note\.sg\.ok\{/.test(html));
ok('over-limit line is red, second-run box amber, fits line styled', /id="slMsg" class="note sg bad"/.test(grab('renderShiftLog')) && /class="note sg warn"/.test(grab('slDupHTML')) && /class="note sg pk-fit"/.test(grab('packFitHTML')));
const Sx = no => { vm.runInContext("packForm={bid:'g1',brand:'Max Sulfur',packDate:'2026-11-27',brandBatch:" + JSON.stringify(no) + "};", c); return c.packBbHTML(); };
ok('brand batch note takes the colour of what it says', /class="note sg bad"/.test(Sx('VU26196')) && /class="note sg warn"/.test(Sx('MAXT10460')) && /class="note sg ok"/.test(Sx('MAXS20001')) && /class="note sg"/.test(Sx('MAXS10460')));
ok('4 tiles sit in the 4-column row (2 by 2 on a phone), 3 stay as before', /class="qs-tally four"/.test(c.prodTiles([[1,'a'],[2,'b'],[3,'c'],[4,'d']])) && /class="qs-tally"/.test(c.prodTiles([[1,'a'],[2,'b'],[3,'c']])));
vm.runInContext("pqForm={oid:'o1',lid:'l1',qty:'',bid:'g1'};", c);
ok('run sheet names the batch and gives the PO need its unit', /limited by the batch GS10460\. The PO still needs 1,000 Kg\.<\/div>/.test(c.packFitHTML('pq')));
report();
