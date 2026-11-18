/* BUILD 2026-11-18a. Abdul Majid (Production Manager) asked to see the production shift record with the date, the time
   it was typed and who typed it, for every batch produced and packed, by batch and by product, and to download it.
   Tahir ruled on 18 Nov 2026: produced and packed in 1 report (Kind column); 3 views (By batch, By product grouped by
   the base product made, Every entry); a month, a date or From and To on this report only; correction rows marked with
   who made them; old rows not filled in; reversed and voided packing shown and not counted; a shift with no output
   not shown; Left to pack is the batch's position today; More links on Today, Shift output and Majid's Morning view
   page, all opening on This month; open to the 7 roles of Production by shift (D-371).
   Run: node prodpack1118a.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar, html } = H;

const FNS = ['evToday', 'ymdUTC', 'periodWindow', 'localWhenOf', 'ppKey', 'evLag', 'calDays', 'ppMonthName', 'ppDay', 'ppTime', 'ppCap', 'ppWindow', 'ppKgRun', 'ppLate', 'ppRows',
  'ppInPeriod', 'ppSortNew', 'ppSortOld', 'ppLeftNow', 'ppByBatch', 'ppByProduct', 'ppFiltered', 'ppExportData', 'ppCell', 'ppTag', 'ppKindTag',
  'ppNone', 'ppKg', 'ppEntriesTable', 'ppBatchHTML', 'ppProductHTML', 'ppOpts', 'ppEntryHTML', 'ppPeriodBar', 'ppViewBar', 'ppHTML', 'ppSetPer'];
function sb(st) {
  const c = { console, Math, String, Date, isNaN, encodeURIComponent, decodeURIComponent, state: st, renders: 0 };
  vm.createContext(c);
  vm.runInContext(FNS.map(grab).join('\n') + '\nvar prpView="batch", prpPer={mode:"This month"}, prpOpenK={}, prpF={};'
    + '\nfunction fmt(n){ return Math.round(n).toLocaleString(); }\nfunction unitOf(b){ return /liquid/i.test(b)?"L":"Kg"; }'
    + '\nfunction qsEsc(s){ return String(s==null?"":s).replace(/[&<>"\']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","\'":"&#39;"}[c]; }); }'
    + '\nfunction shortClient(c){ return c; }\nfunction render(){ renders++; }', c);
  return c;
}
const st = {
  batches: [
    { id: 'B1', batchNo: 'NS26001', kind: 'bulk', base: 'Nitro Sulfur', brand: 'Nitro Sulfur', status: 'open', producedKg: 9000, packedKg: 5000, disposedKg: 500 },
    { id: 'B2', batchNo: 'TOR26002', kind: 'po', po: 'P7', base: 'Liquid Bio Stimulant', brand: 'Tornado 500 ML', status: 'closed', producedKg: 800, packedKg: 800, disposedKg: 0 },
    { id: 'B3', batchNo: 'MX26003', kind: 'multi', base: 'Nitro Sulfur', allocations: [{ po: 'P1' }, { po: 'P2' }, { po: 'P1' }], status: 'open', producedKg: 1000, packedKg: 0 },
    { id: 'B9', batchNo: 'VOID1', kind: 'bulk', base: 'X', voided: true, producedKg: 100 }],
  orders: [{ po: 'P1', client: 'Maxim' }, { po: 'P2', client: 'Syngenta' }, { po: 'P7', client: 'Engro' }],
  shiftEntries: [
    { id: 'SE1', batchId: 'B1', batchNo: 'NS26001', date: '2026-11-03', shift: 'Morning', incharge: 'Akram', kg: 5000, by: 'Ali Raza', ts: '2026-11-03T10:00:00.000Z', recordedAt: '2026-11-03T10:00:00.000Z', recordedBy: 'Ali Raza' },
    { id: 'SE2', batchId: 'B1', batchNo: 'NS26001', date: '2026-11-04', shift: 'Night', incharge: 'Bashir', kg: 4000, by: 'Jawad Naseer', ts: '2026-11-07T08:00:00.000Z', enteredLate: 3, lateReason: 'power cut' },
    { id: 'SE3', batchId: 'B1', batchNo: 'NS26001', date: '2026-11-05', shift: 'Evening', incharge: 'Akram', kg: 0, reason: 'no raw material', by: 'Ali Raza' },
    { id: 'SE4', batchId: 'B2', batchNo: 'TOR26002', date: '2026-10-20', shift: 'Morning', incharge: 'Akram', kg: 800, by: 'Ali Raza', ts: '2026-10-20T09:00:00.000Z' },
    { id: 'SE5', batchId: 'B3', batchNo: 'MX26003', date: '2026-11-06', shift: 'Morning', incharge: 'Akram', kg: 1000, by: 'Ali Raza', ts: '2026-11-06T09:00:00.000Z' },
    { id: 'SE6', batchId: 'B9', batchNo: 'VOID1', date: '2026-11-06', shift: 'Morning', incharge: 'Akram', kg: 100, by: 'Ali Raza' }],
  productionLog: [
    { id: 'PL9', date: '2026-11-07', base: 'Nitro Sulfur', kg: 250, by: 'Production Manager', shift: 'Evening', incharge: 'Akram', recon: true },
    { id: 'PL8', date: '2026-11-03', base: 'Nitro Sulfur', kg: 5000, by: 'Ali Raza', shift: 'Morning', incharge: 'Akram', batchNo: 'NS26001' }],
  packingLog: [
    { id: 'PK1', date: '2026-11-04', base: 'Nitro Sulfur', brand: 'Nitro Sulfur', kg: 1500, by: 'Ali Raza', po: 'P1', baseBatchId: 'B1', baseBatchNo: 'NS26001', brandBatchNo: 'NS26001', shift: 'Morning', incharge: 'Fazal', packs: 60, packSize: 25, recordedAt: '2026-11-04T12:00:00.000Z', recordedBy: 'Ali Raza',
      movedOut: [{ kg: 500, toPo: 'P2', lotId: 'PKm' }] },
    { id: 'PKm', date: '2026-11-04', base: 'Nitro Sulfur', brand: 'Nitro Sulfur', kg: 500, po: 'P2', baseBatchId: 'B1', baseBatchNo: 'NS26001', movedFrom: { lotId: 'PK1', po: 'P1' } },
    { id: 'PK2', date: '2026-11-05', base: 'Nitro Sulfur', brand: 'Nitro Sulfur', kg: 1000, by: 'Jawad Naseer', po: 'P2', baseBatchId: 'B1', baseBatchNo: 'NS26001', shift: 'Evening', incharge: 'Fazal', recon: true },
    { id: 'PK3', date: '2026-11-05', base: 'Nitro Sulfur', brand: 'Nitro Sulfur', kg: 700, by: 'Ali Raza', po: 'P1', baseBatchId: 'B1', baseBatchNo: 'NS26001', shift: 'Morning', incharge: 'Fazal', reversed: true, recordedAt: '2026-11-05T09:00:00.000Z' },
    { id: 'PK4', date: '2026-11-06', base: 'Nitro Sulfur', brand: 'Nitro Sulfur', kg: 0, voidedKg: 300, void: true, by: 'Ali Raza', po: 'P1', baseBatchId: 'B1', baseBatchNo: 'NS26001' },
    { id: 'PK5', date: '2026-10-10', base: 'Liquid Bio Stimulant', brand: 'Tornado 500 ML', kg: 800, by: 'Ali Raza', po: 'P7', baseBatchId: 'B2', baseBatchNo: 'TOR26002' }]
};

/* ---- the rows ---- (PK1 was typed as 2,000 Kg; the move of 500 Kg took its kg down to 1,500 and wrote the copy PKm, as pmvApply does) */
const c = sb(JSON.parse(JSON.stringify(st)));
const rows = c.ppRows();
const pr = rows.filter(r => r.kind === 'Produced'), pk = rows.filter(r => r.kind === 'Packed');
eq('a shift saved with no output is not shown (Tahir, 18 Nov)', pr.some(r => r.kg === 0), false);
eq('a voided batch shows nothing', rows.some(r => r.batch === 'VOID1'), false);
eq('5 produced rows: 1 per shift entry with output, and 1 Add missing production backfill (the shift-log copy in the production log is not listed twice)', pr.length, 5);
const bf = pr.find(r => r.date === '2026-11-07');
ok('an Add missing production backfill is shown as Produced, marked as a correction by the role that typed it (Tahir, 18 Nov)', bf && bf.kg === 250 && bf.marks.some(m => m.t === 'Correction by Production Manager') && bf.at === '' && bf.batch === '');
eq('a multi-PO batch shows 1 row per shift, not 1 per PO', pr.filter(r => r.batch === 'MX26003').length, 1);
eq('the multi-PO row names each PO once', pr.find(r => r.batch === 'MX26003').po, 'P1, P2');
const se1 = pr.find(r => r.date === '2026-11-03');
ok('a produced row carries who typed it and when', se1.by === 'Ali Raza' && se1.at === '2026-11-03T10:00:00.000Z');
const se2 = pr.find(r => r.date === '2026-11-04');
ok('an older shift entry with no recordedAt falls back to its ts', se2.at === '2026-11-07T08:00:00.000Z' && se2.by === 'Jawad Naseer');
ok('a late entry is marked with its days and reason', se2.marks.some(m => m.t === 'Typed 3 days late: power cut'));
eq('the moved copy is not listed (counted once)', pk.some(r => r.kg === 500 && r.po === 'P2'), false);
const pk1 = pk.find(r => r.po === 'P1' && r.date === '2026-11-04');
eq('the typed entry shows the Kg it was typed with (moved Kg added back)', pk1.kg, 2000);
ok('the typed entry says where the moved Kg went', pk1.marks.some(m => m.t === 'Moved to PO P2: 500 Kg'));
eq('packs shown as packs x size and unit, the packs that were typed (60 left after the move, 80 typed)', pk1.packs, '80 \u00d7 25 Kg');
const pk2 = pk.find(r => r.date === '2026-11-05' && r.po === 'P2');
ok('a correction row is marked with who made it (Tahir, 18 Nov)', pk2.marks.some(m => m.t === 'Correction by Jawad Naseer'));
eq('a correction saved with no time has no typed-at (shown as time not saved)', pk2.at, '');
const pk3 = pk.find(r => r.date === '2026-11-05' && r.po === 'P1');
ok('a reversed entry is shown, marked and not counted', pk3 && pk3.counted === false && pk3.marks.some(m => m.t === 'Reversed: not counted'));
const pk4 = pk.find(r => r.date === '2026-11-06');
ok('a voided entry is shown with its voided Kg, marked and not counted', pk4 && pk4.kg === 300 && pk4.counted === false && pk4.marks.some(m => m.t === 'Voided: not counted'));
const pk5 = pk.find(r => r.batch === 'TOR26002');
ok('an old packing row with no shift or in-charge is not filled in', pk5.shift === '' && pk5.inch === '' && pk5.at === '');
eq('a packed row takes the base product made', pk5.product, 'Liquid Bio Stimulant');

/* ---- the period ---- */
vm.runInContext('evToday=function(){ return "2026-11-18"; };', c);
c.prpPer = { mode: 'This month' };
let w = c.ppWindow(); ok('This month: 1 to 18 Nov', w.from === '2026-11-01' && w.to === '2026-11-18');
c.prpPer = { mode: 'month', month: '2026-10' }; w = c.ppWindow(); ok('a month picked: 1 to 31 Oct', w.from === '2026-10-01' && w.to === '2026-10-31' && w.label === 'October 2026');
c.prpPer = { mode: 'month', month: '2026-02' }; w = c.ppWindow(); eq('February ends on the 28th in 2026', w.to, '2026-02-28');
c.prpPer = { mode: 'date', date: '2026-11-04' }; w = c.ppWindow(); ok('a date picked: that day only', w.from === '2026-11-04' && w.to === '2026-11-04');
c.prpPer = { mode: 'range', from: '2026-11-06', to: '2026-11-03' }; w = c.ppWindow(); ok('From and To the wrong way round are swapped', w.from === '2026-11-03' && w.to === '2026-11-06');
c.prpPer = { mode: 'All' }; w = c.ppWindow(); ok('All: no bounds', w.from === '' && w.to === '');
c.prpPer = { mode: 'FY to date' }; ok('a chip label keeps its capitals (review: not Fy to date)', c.ppWindow().label === 'FY to date');
c.prpPer = { mode: 'range', from: '2026-11-10' }; w = c.ppWindow(); ok('From alone runs to today', w.from === '2026-11-10' && w.to === '2026-11-18');
c.prpPer = { mode: 'This month' }; c.ppSetPer('to', '2026-11-05'); ok('typing To alone starts a range', c.prpPer.mode === 'range' && c.prpPer.to === '2026-11-05');
w = c.ppWindow(); ok('To alone has no start: everything up to that day', w.from === '' && w.to === '2026-11-05' && w.label === 'Up to 5 Nov 26');
c.ppSetPer('from', '2026-11-04'); ok('then From keeps the To', c.prpPer.from === '2026-11-04' && c.prpPer.to === '2026-11-05');
c.ppSetPer('month', 'abc'); ok('a month that is not YYYY-MM is ignored', c.prpPer.mode === 'range');
c.prpPer = { mode: 'month', month: '2026-11' };
const nov = c.ppInPeriod(c.ppRows());
ok('the period filters on the entry date', nov.every(r => r.date >= '2026-11-01') && !nov.some(r => r.batch === 'TOR26002'));

/* ---- by batch and by product ---- */
const bb = c.ppByBatch(nov);
const ns = bb.find(x => x.batch === 'NS26001');
eq('NS26001 produced in the period: 9,000 (the backfill has no batch and stands apart)', ns.produced, 9000);
eq('NS26001 packed in the period: 2,000 + 1,000 (reversed and voided not counted)', ns.packed, 3000);
eq('Left to pack now is the batch position today: 9,000 - 5,000 - 500', ns.left, 3500);
eq('a batch lists its entries oldest first', ns.rows[0].date, '2026-11-03');
const bp = c.ppByProduct(nov);
const nsp = bp.find(p => p.product === 'Nitro Sulfur');
ok('By product groups by the base product made (2 Nitro Sulfur batches and the backfill)', nsp && nsp.batches.length === 3);
eq('product produced adds its batches and the backfill: 9,000 + 1,000 + 250', nsp.produced, 10250);

/* ---- what is shown, and the download ---- */
c.prpView = 'batch'; c.prpOpenK = { 'b:B1': true };
const hb = c.ppHTML();
ok('By batch shows the batch and its entries when opened', hb.indexOf('NS26001') > -1 && hb.indexOf('Typed by') > -1 && hb.indexOf('time not saved') > -1);
ok('the sentence names the period and the totals', hb.indexOf('November 2026') > -1 && hb.indexOf('produced <b>10,250</b>') > -1);
ok('the period bar has the 4 chips and the month, date, From and To boxes', ['This month', 'Last month', 'FY to date', 'All', 'type="month"', 'Pick a date', 'From', 'To'].every(s => c.ppPeriodBar().indexOf(s) > -1));
c.prpView = 'entry'; c.prpF = { kind: 'Packed' };
const he = c.ppHTML();
ok('Every entry with a filter shows only packed rows', he.indexOf('Produced</span>') < 0 && he.indexOf('Packed</span>') > -1);
const ed = c.ppExportData();
eq('Every entry downloads the rows on screen', ed.data.length, nov.filter(r => r.kind === 'Packed').length);
ok('the download carries typed by, typed at and the mark', ed.head.indexOf('Typed by') > -1 && ed.head.indexOf('Typed at') > -1 && ed.head.indexOf('Mark') > -1);
ok('a row with no time downloads as time not saved', ed.data.some(r => r[14] === 'time not saved'));
c.prpView = 'batch'; c.prpF = {};
eq('By batch downloads 1 row per batch (2 batches and the backfill)', c.ppExportData().data.length, 3);
c.prpView = 'product';
eq('By product downloads 1 row per product', c.ppExportData().data.length, 1);
eq('a cell that starts with = is made safe for Excel', c.ppCell('=1+1'), "'=1+1");
c.prpPer = { mode: 'date', date: '2026-01-01' }; c.prpView = 'batch';
ok('a period with nothing says so', c.ppHTML().indexOf('No production or packing entry is dated in') > -1);

/* ---- review checks (18 Nov 2026) ---- */
ok('typed at is shown in plant time (PKT): 09:30 UTC is 14:30', c.ppTime('2026-11-03T09:30:00.000Z') === '3 Nov 26, 14:30');
ok('an empty or bad time shows nothing', c.ppTime('') === '' && c.ppTime('nonsense') === '');
const k = c.ppKey("p:Max K's (new)");
ok("a key with an apostrophe or brackets is safe inside onclick='...'", k.indexOf("'") < 0 && k.indexOf('(') < 0 && k.indexOf(')') < 0 && decodeURIComponent(k) === "p:Max K's (new)");
const evil = JSON.parse(JSON.stringify(st)); evil.batches[0].base = "X'-alert(1)-'";
const ce = sb(evil); vm.runInContext('evToday=function(){ return "2026-11-18"; };', ce); ce.prpPer = { mode: 'All' }; ce.prpView = 'product';
const he2 = ce.ppHTML();
ok('a product name with an apostrophe cannot break out of the onclick', he2.indexOf("ppTog('p%3AX%27-alert%281%29-%27')") > -1 && he2.indexOf("alert(1)-'')") < 0);
ok('evLag on an Add missing packing row (recordedAt, no actualDate) is unknown, so it is never flagged late', c.evLag({ recordedAt: '2026-11-18T10:00:00.000Z', date: '2026-10-01' }) === null);
c.prpF = { batch: 'GONE1' }; c.prpView = 'entry'; c.prpPer = { mode: 'This month' };
ok('a filter in use stays visible in its box even when the period has no such row', c.ppHTML().indexOf('<option selected value="GONE1">') > -1);
c.prpF = {};
const pool = JSON.parse(JSON.stringify(st)); pool.batches.push({ id: 'DP1', batchNo: '', kind: 'bulk', base: 'Nitro Sulfur', pool: true, disposition: 'divert', producedKg: 0, plannedKg: 600 });
pool.packingLog.push({ id: 'PK7', date: '2026-11-08', base: 'Nitro Sulfur', brand: 'Nitro Sulfur', kg: 200, po: 'P1', baseBatchId: 'DP1', baseBatchNo: 'NS25009', fromDivert: true, shift: 'Morning', incharge: 'Fazal', by: 'Ali Raza' });
pool.packingLog.push({ id: 'PK8', date: '2026-11-08', base: 'Nitro Sulfur', brand: 'Nitro Sulfur', kg: 50, po: 'P1', shift: 'Morning', incharge: 'Fazal', by: 'Ali Raza' });
pool.packingLog.push({ id: 'PK9', date: '2026-11-08', base: 'Nitro Sulfur', brand: 'Nitro Sulfur', kg: 60, po: 'P1', shift: 'Morning', incharge: 'Fazal', by: 'Ali Raza' });
const cpo = sb(pool); vm.runInContext('evToday=function(){ return "2026-11-18"; };', cpo); cpo.prpPer = { mode: 'All' };
const pb = cpo.ppByBatch(cpo.ppInPeriod(cpo.ppRows()));
const dp = pb.find(x => x.key === 'DP1');
ok('divert pool packing is named as the pool and has no left to pack figure (not a false 0)', dp && dp.batch === 'Divert pool, Nitro Sulfur' && dp.left === null);
ok('2 packing rows with no batch stay 2 rows, not merged into 1', pb.filter(x => /^n:PK[89]$/.test(x.key)).length === 2);
ok('the report state cannot clash with the People screen (its own names, declared once)', (html.match(/var prpView=/g) || []).length === 1 && !/var ppView='batch'/.test(html));
ok('the Today link also shows on a day with nothing done yet', grab('tdDoneToday').indexOf("if(h.indexOf('pp-more')<0&&(state.role==='Production'||depts===null||depts.indexOf('production')>-1)&&ppMay()) h+=ppMoreLink();") > -1);
ok('a text cell starting with - is made safe; a number is left as it is', c.ppCell('-5+3') === "'-5+3" && c.ppCell(-5) === '-5');
ok('the report writes nothing into state', !/state\.[A-Za-z]+\s*=[^=]/.test(['ppRows', 'ppByBatch', 'ppByProduct', 'ppHTML', 'ppExportData', 'ppWindow'].map(grab).join('\n')));

/* ---- wiring in the app ---- */
ok('the report is in the catalogue for the 7 roles of Production by shift', /\{id:'prodpack', kind:'prodpack'[^\n]*roles:\['Production','Production Manager','Plant Manager','COO','CFO','Warehouse','Supply Chain'\]\}/.test(html));
ok('it sits in the Production group beside Production by shift', html.indexOf("ids:['prodshift','prodpack','batches','batchtrace','rm']") > -1);
ok('rpOpen opens it on This month, By batch', /c\.kind==='prodpack'\)\{ prpPer=\{mode:'This month'\}; prpView='batch'/.test(grab('rpOpen')));
ok('rpReportHTML draws it', grab('rpReportHTML').indexOf("if(c.kind==='prodpack') return h+ppHTML()") > -1);
ok('Today: More under Done by you today for Production', /state\.role==='Production'&&ppMay\(\)\)\?ppMoreLink\(\)/.test(grab('tdDoneToday')));
ok('Today: More under Done by your team today for the production lead and the COO', /depts===null\|\|depts\.indexOf\('production'\)>-1\)&&ppMay\(\)\)\?ppMoreLink\(\)/.test(grab('tdDoneToday')));
ok('Shift output: More beside the Recent output log', grab('renderProdOutput').indexOf('onclick="ppGo()">More: full record') > -1);
ok("Majid's Morning view page: More link", grab('mvPageMajid').indexOf('ppGo();return false') > -1);
ok('ppGo opens through rpOpen, which checks the role', /rpOpen\('prodpack'\)/.test(grab('ppGo')) && /rpMay\(c\)/.test(grab('ppMay')));
ok('Add missing packing now saves the time it was typed and who typed it', /recon:true,recordedAt:new Date\(\)\.toISOString\(\),recordedBy:/.test(grab('dfSubmitPacking')));
ok('the report writes nothing', !/save\(|saveNow\(|logAction\(/.test(['ppRows', 'ppHTML', 'ppExportData', 'ppByBatch', 'ppByProduct', 'ppSetPer', 'ppExport', 'ppTog', 'ppSetF'].map(grab).join('\n')));

/* ---- Guide and change log ---- */
ok('BUILD_ID is 2026-11-18a', html.indexOf("var BUILD_ID='2026-11-18a';") > -1);
ok('the change log has 2026-11-18a', html.indexOf("{ver:'2026-11-18a', date:'2026-11-18'") > -1);
ok('My job tells the Production Manager where More is', /'Production Manager':_pp18\+' Open it from <b>More<\/b>/.test(grab('guideMyJob')));
ok('My job tells Production too', /'Production':_pp18\+/.test(grab('guideMyJob')));
ok('SYSDOC_VER follows the build', html.indexOf("var SYSDOC_VER='2026-11-18a'") > -1);

report('2026-11-18a production and packing record');
