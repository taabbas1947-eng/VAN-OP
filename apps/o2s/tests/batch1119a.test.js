/* BUILD 2026-11-19a. Batch 1 of the fixes from the 18 Nov 2026 audit, part A. Tahir ruled on 19 Nov 2026:
   F19 escalation: ordinary jobs after 3 days; a truck already loading after 1 day (Inspect, Gate Pass, Review truck,
   Release, Approve DC, Truck came back); Load is ordinary (3 days); Open Production keeps 4 days, Pack from base 7
   days; Confirm delivery keeps its own ladder (D-372).
   F16 ERP SO #: 2 warnings, never a block: a shape other than SAL-ORD-YYYY-NNNNN (a -1 style suffix is fine), and a
   number already on another order (D-373).
   F11 expiry: packed stock still at the plant whose expiry month is 3 months away or less raises 1 job per packing
   run for the Warehouse (Shoaib) (D-374).
   Run: node batch1119a.test.js */
const H = require('./harness.js');
const vm = require('vm');
const path = require('path');
const { ok, eq, report, grab, grabTopVar, html } = H;

/* ---------- F19: the escalation days ---------- */
{ const c = { console, Math, String, PL_LINE_STUCK_DAYS: 7 };
  vm.createContext(c);
  vm.runInContext(grab('acEscalation') + '\nfunction labLateBy(){ return 0; }\nfunction actTiming(it){ return {days:it._d}; }\nfunction acProduceStallDays(it){ return it._d; }'
    + '\nfunction batchLinesWaiting(){ return null; }\nfunction batchNpMark(){ return null; }', c);
  const esc = (label, d) => c.acEscalation({ label: label, _d: d });
  ok('F19: Acknowledge waiting 2 days does not escalate', esc('Acknowledge', 2) === null);
  ok('F19: Acknowledge waiting 3 days goes to the Plant Manager', (esc('Acknowledge', 3) || {}).to === 'Plant Manager');
  ['RM Check', 'Receive', 'Lab QC', 'Assign sample', 'Review', 'Approve', 'Pack QC', 'Ship', 'Approve PR', 'Load', 'Approve move', 'Approve close short', 'Pack', 'Check after move', 'Duplicate number', 'Correct COA', 'Print price', 'Stuck at packing']
    .forEach(l => ok('F19: ' + l + ' escalates at 3 days, not 2', esc(l, 2) === null && !!esc(l, 3)));
  ['Inspect', 'Gate Pass', 'Review truck', 'Release', 'Approve DC', 'Truck came back']
    .forEach(l => ok('F19: truck job ' + l + ' escalates at 1 day', !!esc(l, 1) && esc(l, 0) === null));
  ok('F19: Open Production keeps 4 days', esc('Open Production', 3) === null && !!esc('Open Production', 4));
  ok('F19: Pack from base keeps 7 days', esc('Pack from base', 6) === null && !!esc('Pack from base', 7));
  ok('F19: Confirm delivery keeps its own ladder', esc('Confirm delivery', 98) === null);
  ok('F19: the escalation roles are unchanged', (esc('Release', 1) || {}).to === 'COO' && (esc('Pack', 3) || {}).to === 'Production Manager' && (esc('Correct COA', 3) || {}).to === 'QCM');
  ok('F19: the ruling is written beside the table', /2026-11-19a, F19 \(Tahir, 19 Nov\)/.test(grab('acEscalation')));
}

/* ---------- F16: the ERP SO # warnings ---------- */
{ const c = { console, Math, String, state: { orders: [{ po: '709', erpSo: 'SAL-ORD-2026-00342' }, { po: '0712', so: 'SAL-ORD-2026-00347-1' }] } };
  vm.createContext(c);
  vm.runInContext(html.match(/var ERP_SO_RE=\/.*\/i;/)[0] + '\n' + ['erpSoNorm', 'erpSoUsedOn', 'erpSoWarnHTML'].map(grab).join('\n')
    + '\nfunction qsEsc(s){ return String(s==null?"":s).replace(/[&<>"\']/g,function(x){ return "&#"+x.charCodeAt(0)+";"; }); }', c);
  const w = v => c.erpSoWarnHTML(v);
  eq('F16: nothing typed, no warning', w(''), '');
  eq('F16: SAL-ORD-2026-00400 has no warning', w('SAL-ORD-2026-00400'), '');
  eq('F16: a -1 suffix has no warning', w('SAL-ORD-2026-00401-1'), '');
  eq('F16: lower case and spaces are read as the same number', w('  sal-ord-2026-00402 '), '');
  ok('F16: a string of zeros is warned for its shape', /does not look like SAL-ORD-YYYY-NNNNN/.test(w('000000000000')));
  ok('F16: a number already on PO 709 is warned', /already on PO 709/.test(w('SAL-ORD-2026-00342')) && !/does not look like/.test(w('SAL-ORD-2026-00342')));
  ok('F16: the same number with other capitals is still a duplicate', /already on PO 709/.test(w('sal-ord-2026-00342')));
  ok('F16: a duplicate of the order\'s so field is found', /already on PO 0712/.test(w('SAL-ORD-2026-00347-1')));
  ok('F16: every warning says it can still be saved', (w('123').match(/You can still save/g) || []).length === 1);
  ok('F16: the New order box shows the warnings as it is typed', /oninput="entryErpSo=this\.value;validate\(\);erpSoWarnShow\(\)"/.test(html) && /<div id="e_erpso_warn">\$\{erpSoWarnHTML\(entryErpSo\)\}<\/div>/.test(html));
  ok('F16: submitting is never blocked by a warning', !/erpSoWarn/.test(grab('submitPO')));
}

/* ---------- F11: packed stock near its expiry month ---------- */
{ const st = { orders: [{ id: 'O1', po: 'P1' }], packingLog: [
    { id: 'A', po: 'P1', brand: 'Nitro Sulfur', brandBatchNo: 'NS1', kg: 1000, shipKg: 400, expDate: '2027-02-10', date: '2025-02-10' },
    { id: 'B', po: 'P1', brand: 'Nitro Sulfur', brandBatchNo: 'NS2', kg: 1000, shipKg: 0, expDate: '2027-03-01', date: '2025-03-01' },
    { id: 'C', po: 'P1', brand: 'Nitro Sulfur', brandBatchNo: 'NS3', kg: 1000, shipKg: 1000, expDate: '2026-12-01', date: '2024-12-01' },
    { id: 'D', po: 'P1', brand: 'Nitro Sulfur', brandBatchNo: 'NS4', kg: 1000, voided: true, expDate: '2026-12-01', date: '2024-12-01' },
    { id: 'E', po: 'P9', brand: 'Nitro Sulfur', brandBatchNo: 'NS5', kg: 300, voidedKg: 200, expDate: '2026-10', date: '2024-10-01' },
    { id: 'G', po: 'P1', brand: 'Nitro Sulfur', brandBatchNo: 'NS7', kg: 800, reversed: true, expDate: '2026-12-01', date: '2024-12-01' },
    { id: 'H', po: 'P1', brand: 'Nitro Sulfur', brandBatchNo: 'NS8', kg: 800, void: true, expDate: '2026-12-01', date: '2024-12-01' },
    { id: 'I', po: 'P1', brand: 'Nitro Sulfur', brandBatchNo: 'NS9', kg: 700, expDate: '2027-01-01', bagExp: '2027-08', date: '2026-11-15' },
    { id: 'K', po: 'P1', brand: 'Nitro Sulfur', brandBatchNo: 'NS10', kg: 900, expDate: '2027-09-01', bagExp: '2027-01', date: '2026-11-15' },
    { id: 'F', po: 'P1', brand: 'Nitro Sulfur', brandBatchNo: 'NS6', kg: 500, date: '2026-11-01' }] };
  const c = { console, Math, String, Date, state: st, TODAY: new Date('2026-11-19T00:00:00Z') };
  vm.createContext(c);
  vm.runInContext('var NEAR_EXPIRY_MONTHS=3;\n' + ['bagAddMonths', 'nearExpiryLimitYM', 'packRunLeftKg', 'nearExpiryJobs'].map(grab).join('\n')
    + '\nfunction fmt(n){ return String(n); }\nfunction unitOf(){ return "Kg"; }', c);
  eq('F11: the limit on 19 Nov 2026 is February 2027', c.nearExpiryLimitYM(), '2027-02');
  const J = c.nearExpiryJobs(), ids = J.map(j => j.nearExp.id).sort().join(',');
  eq('F11: only the runs with stock left and expiry by February 2027 are listed', ids, 'A,E,K');
  ok('F11: a reversed run (written off in Correct a record) raises no job', !J.some(j => j.nearExp.id === 'G'));
  ok('F11: a voided run (p.void) raises no job', !J.some(j => j.nearExp.id === 'H'));
  ok('F11: the bag month counts: bag Aug 2027 is not near, though the older field says Jan 2027', !J.some(j => j.nearExp.id === 'I'));
  ok('F11: the bag month counts: bag Jan 2027 is near and named, though the older field says Sep 2027', /NS10 · 900 Kg still here · expires 2027-01/.test((J.find(j => j.nearExp.id === 'K') || {}).what));
  eq('F11: the job waits from the month the run came within 3 months, not from packing', (J.find(j => j.nearExp.id === 'A') || {}).labAt, '2026-11-01');
  eq('F11: a run packed inside the window waits from its pack date', (J.find(j => j.nearExp.id === 'K') || {}).labAt, '2026-11-15');
  ok('F11: every job goes to the Warehouse', J.every(j => j.role === 'Warehouse' && j.label === 'Near expiry'));
  ok('F11: the job says the batch, the Kg left and the expiry month', /NS1 · 600 Kg still here · expires 2027-02 · PO P1/.test((J.find(j => j.nearExp.id === 'A') || {}).what));
  ok('F11: voided Kg is not taken off twice (kg is already net of it)', /300 Kg still here/.test((J.find(j => j.nearExp.id === 'E') || {}).what));
  ok('F11: a run whose PO is not found has no button', (J.find(j => j.nearExp.id === 'E') || {}).act === '' && (J.find(j => j.nearExp.id === 'A') || {}).act === "openOrder('O1')");
  c.TODAY = new Date('2026-12-05T00:00:00Z');
  eq('F11: in December the limit moves to March 2027', c.nearExpiryLimitYM(), '2027-03');
  ok('F11: a December limit across the year end is right', c.nearExpiryJobs().map(j => j.nearExp.id).sort().join(',') === 'A,B,E,K');
  const td = grabTopVar('TD_LABEL', '{');
  ok('F11: Near expiry has a title and a button on Today', /'Near expiry':\s*\{title:'Packed stock near its expiry month', verb:'Open the order'\}/.test(td));
  ok('F11: Today raises the jobs', /nearExpiryJobs\(\)\.forEach/.test(grab('actionItems')));
  const R = require(path.join(__dirname, '..', 'notify-routes.js'));
  ok('F11: the alert server sends Near expiry to the Warehouse only', JSON.stringify(R.JOB_ROLES['Near expiry']) === '["Warehouse"]');
}

/* ---------- change log, Guide, build and System Documentation ---------- */
ok('change log 2026-11-19a says all 3 changes', /ver:'2026-11-19a'/.test(html) && /most jobs now escalate after 3 days/.test(html) && /does not look like SAL-ORD-YYYY-NNNNN \(a suffix such as -1 is fine\)/.test(html) && /raises a Near expiry job for the Warehouse/.test(html));
ok('the Guide tells each role what changed on 19 Nov', /var _n19a=\{'Warehouse':/.test(grab('guideMyJob')) && /New on 19 Nov \(2026-11-19a\)/.test(grab('guideMyJob')));
ok('BUILD_ID of the build form (2026-11-19b since part B1) and SYSDOC_VER follows', /var BUILD_ID='2026-\d\d-\d\d[a-z]';/.test(html) && /ver:'2026-11-19a'/.test(html) && (html.match(/var BUILD_ID='([^']+)'/) || [])[1] === (html.match(/var SYSDOC_VER='([^']+)'/) || [])[1]);
ok('the System Documentation carries D-372, D-373 and D-374', /"id":"D-372"/.test(html) && /"id":"D-373"/.test(html) && /"id":"D-374"/.test(html));
ok('the System Documentation escalation table says 3 days for Acknowledge', /\["Acknowledge","Supply Chain","3 days","Plant Manager"\]/.test(html));

/* ---------- review fixes: Today card text, job key, waiting days, Inspect clock ---------- */
{ const c = { console, Math, String };
  vm.createContext(c);
  vm.runInContext(['_tdWhat', 'acKey'].map(grab).join('\n') + '\nfunction _tdEsc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(x){ return "&#"+x.charCodeAt(0)+";"; }); }'
    + '\nfunction _tdPo(o){ return "[PO "+o.po+"]"; }\nfunction _tdClient(o){ return "[client "+o.client+"]"; }', c);
  const o = { id: 'O1', po: 'P1', client: 'Acme' };
  const a = { label: 'Near expiry', o: o, nearExp: { id: 'A' }, what: 'Near expiry — Nitro Sulfur · batch NS1 · 600 Kg still here · expires 2027-02 · PO P1' };
  const b = { label: 'Near expiry', o: o, nearExp: { id: 'B' }, what: 'Near expiry — Nitro Sulfur · batch NS2 · 1000 Kg still here · expires 2027-03 · PO P1' };
  ok('review: the Today card keeps the batch, the Kg left and the expiry month', /batch NS1 · 600 Kg still here · expires 2027-02/.test(c._tdWhat(a)));
  ok('review: the Today card text is escaped', !/<b>/.test(c._tdWhat({ label: 'Near expiry', o: o, nearExp: { id: 'X' }, what: 'Near expiry — <b>x</b>' })));
  ok('review: 2 runs on 1 PO have their own job keys', c.acKey(a) !== c.acKey(b) && /ne:A/.test(c.acKey(a)));
}
{ const c = { console, Math, String, Date, TODAY: new Date('2026-11-19T05:00:00Z'), REOPEN_CLOCK_SKIP: [] };
  vm.createContext(c);
  vm.runInContext(grab('actTiming') + '\nfunction lineReopenDay(){ return ""; }\nfunction localDateOf(x){ return String(x||"").slice(0,10); }\nfunction evToday(){ return "2026-11-19"; }'
    + '\nfunction calDays(a,b){ return Math.round((Date.parse(String(b).slice(0,10))-Date.parse(String(a).slice(0,10)))/86400000); }\nfunction itemWaiting(){ return false; }', c);
  const t = c.actTiming({ label: 'Near expiry', o: { id: 'O1', received: '2025-01-01' }, nearExp: { id: 'A' }, labAt: '2026-11-01' });
  ok('review: a Near expiry job on an order waits from labAt, not from the PO date', t.days === 18 && t.approx === false);
}
{ const c = { console, Math, String, Date, TRUCK_REVIEW_HOURS: 2 };
  vm.createContext(c);
  vm.runInContext(['_tcLater', 'truckClockStart'].map(grab).join('\n') + '\nfunction localDateOf(x){ return String(x||"").slice(0,10); }\nfunction truckReviewSince(){ return ""; }', c);
  const T = (row, date) => c.truckClockStart({ label: 'Inspect', disp: { date: date, rows: [row] } });
  eq('review: Inspect on a truck planned today for dispatch in 2 days counts from the dispatch date', T({ recordedAt: '2026-11-19T04:00:00Z' }, '2026-11-21').c, '2026-11-21');
  eq('review: Inspect counts from loading start when it is later than the dispatch date', T({ recordedAt: '2026-11-19T04:00:00Z', loadStarted: '2026-11-22T06:00:00Z' }, '2026-11-21').c, '2026-11-22T06:00:00Z');
  eq('review: Inspect counts from the dispatch date when loading started earlier', T({ recordedAt: '2026-11-18T04:00:00Z', loadStarted: '2026-11-19T06:00:00Z' }, '2026-11-20').c, '2026-11-20');
  eq('review: a batch change starts the Inspect clock again', T({ recordedAt: '2026-11-18T04:00:00Z', loadStarted: '2026-11-19T06:00:00Z', batchChanges: [{ at: '2026-11-23T08:00:00Z' }] }, '2026-11-20').c, '2026-11-23T08:00:00Z');
  ok('review: an old truck with no dispatch date or loading start falls back to planning, marked ~', (function(){ var r = T({ recordedAt: '2026-11-18T04:00:00Z' }, ''); return r.c === '2026-11-18T04:00:00Z' && r.approx === true; })());
  eq('review: a dispatch date typed before the truck was planned counts from planning, never earlier', T({ recordedAt: '2026-11-19T04:00:00Z' }, '2026-11-15').c, '2026-11-19T04:00:00Z');
  ok('review: a truck with no times at all has no clock', T({}, '').c === null);
}
{ const c = { console, Math, String, state: { orders: [{ po: '709', erpSo: 'SAL-ORD-2026-00342' }, { po: '800', erpSo: 'SAL-ORD-2026-00500', cancelled: true }, { po: '801', erpSo: 'SAL-ORD-2026-00501', voided: true }] } };
  vm.createContext(c);
  vm.runInContext(html.match(/var ERP_SO_RE=\/.*\/i;/)[0] + '\n' + ['erpSoNorm', 'erpSoUsedOn', 'erpSoWarnHTML'].map(grab).join('\n')
    + '\nfunction qsEsc(s){ return String(s==null?"":s); }', c);
  eq('review: spaces inside the number are ignored (D-373)', c.erpSoWarnHTML('SAL-ORD- 2026-00402'), '');
  ok('review: spaces inside a duplicate are ignored too', /already on PO 709/.test(c.erpSoWarnHTML('SAL-ORD- 2026-00342')));
  eq('review: a cancelled or voided order is not named as a duplicate', c.erpSoWarnHTML('SAL-ORD-2026-00500') + c.erpSoWarnHTML('SAL-ORD-2026-00501'), '');
}
ok('review: the change log says Inspect now counts from loading start', /Inspect \(now counted from loading start or the dispatch date, whichever is later, not from planning\)/.test(html) && !/A truck already loading still escalates/.test(html));
ok('review: the Guide says the bag month and the hold case', /expiry month \(as printed on the bag\)/.test(grab('guideMyJob')) && /tell the Plant Manager if it is on hold/.test(grab('guideMyJob')));
ok('review: the Guide says how the Inspect clock runs', /Inspect from when loading started or its dispatch date, whichever is later/.test(html) && !/Inspect from planning/.test(html));
ok('review: the System Documentation FO-26 table matches the new days', /\["Inspect","1","Plant Manager"\]/.test(html) && /\["Pack QC","3","Plant Manager"\]/.test(html) && /\["Truck came back","1","COO"\]/.test(html) && !/\["RM Check","1","CFO"\]/.test(html));
ok('review: the System Documentation LG-10 table matches the new days', /"3 d, Plant Manager"/.test(html) && /"1 d, Plant Manager \(from loading start or the dispatch date, whichever is later\)"/.test(html) && !/"2 d, Plant Manager"/.test(html) && !/"1 d, CFO"/.test(html));
ok('review: the stale 1d/2d comment above prodStuckItems is gone', !/QA\/Ship 2d/.test(html));

{ const c = { console, Math, String, CMP_LABELS: [] };
  vm.createContext(c);
  vm.runInContext(['acStageOf', 'pushRefOf'].map(grab).join('\n'), c);
  eq('review 2: Near expiry is filed under Shipment, not Production', c.acStageOf('Near expiry'), 'Shipment');
  eq('review 2: the phone alert carries the packing run, so it names the product and batch', c.pushRefOf({ label: 'Near expiry', o: { id: 'O1' }, nearExp: { id: 'A' } }).lot, 'A');
}
ok('review 2: a Near expiry card does not carry the order\'s delivery-promise lateness', /if\(it\.o\.promised&&!it\.nearExp\)/.test(grab('tdGroups')));
ok('review 2: the System Documentation LG-13 clock table has the new Inspect clock and Near expiry', /"Inspect \(truck\)","later of loading start and the dispatch date, never before planning/.test(html) && /\["Near expiry","labAt: the first day of the expiry month/.test(html));
ok('review 2: the Near expiry window has its own number F-052', /"F-052","Near expiry window"/.test(html) && !/"F-026","Near expiry window"/.test(html));

ok('ruling 3: Near expiry is left out of the How are we doing stuck count', /\.filter\(function\(x\)\{ return !\(x&&x\.nearExp\); \}\)/.test(grab('howStuck')));
ok('ruling 3: Near expiry is left out of the Morning view old-job count', /!acDeferActive\(x\)&&!x\.nearExp/.test(grab('mvAllOldJobs')));
ok('ruling 3: the change log and D-374 say so', /not counted in How are we doing or in the Morning view count of old jobs/.test(html) && /not counted in How are we doing or in the Morning view count of old jobs \(Tahir, 19 Nov 2026/.test(html));

report('2026-11-19a batch 1, part A: escalation days, ERP SO checks, expiry warning');
