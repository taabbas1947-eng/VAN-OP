/* 15e (15 Oct 2026): Tahir's rulings after the screen audit.
   - The date box keeps the picked date and opens the late-reason box (the 7 entry forms were
     top-level `let`, so evDateField's window[fname] never found them).
   - Log shift output and the Run-sheet Pack ask the late reason too.
   - Shift starts empty; shift records carry the person's name; a saved message.
   - Run-sheet Pack opens on the pressed batch; a multi-PO batch opens the bulk Pack sheet.
   - '+ Log a shift' opens the running batch's form or the Running batches list.
   - By-product: no default to the same product; the same product is refused.
   - QA: a Pass at or over the reject number needs a reason; the lot sheet is "Packed lot inspection".
   Run: node audit15e.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, report, grab, html } = H;

/* 1. the 7 forms are window properties */
['shiftForm','pqForm','packForm','dispForm','dispQAForm','lotQAForm','packInspForm'].forEach(v => {
  ok(v + ' is declared with var (visible to the date box)', new RegExp('\\nvar ' + v + '=').test(html) && !new RegExp('\\nlet ' + v + '=').test(html));
});

/* 2. evDateField shows the picked date and the reason box when late (behaviour) */
{
  const sb = { window: {}, state: { masters: {} }, TODAY: new Date('2026-10-15T07:00:00Z') };
  vm.createContext(sb);
  ['localDateOf','calDays','evToday','evThreshold','evDaysLate','_tx','evDateField','evDateGate'].forEach(f => vm.runInContext(grab(f), sb));
  vm.runInContext("var EV_DEFAULT_THRESHOLD={pack:1,lotqa:0,dispqa:0,packinsp:0,coa:1,ship:0,deliver:2,shift:1};", sb);
  vm.runInContext("var packForm={packDate:'2026-10-10',packDateReason:''}; window.packForm=packForm;", sb);
  const h = vm.runInContext("evDateField('packForm','packDate','pack','Date this was actually packed','')", sb);
  ok('the date box shows the picked date, not today', /value="2026-10-10"/.test(h));
  ok('a date 5 days old opens the reason box', /5 days ago — why is this being recorded now\?/.test(h));
  const g = vm.runInContext("evDateGate(packForm,'packDate','pack')", sb);
  ok('without a reason the entry is refused with words that match the box', /5 days old — say why it is being recorded now/.test(g));
  vm.runInContext("packForm.packDateReason='paperwork reached me late';", sb);
  ok('with a reason it is accepted', vm.runInContext("evDateGate(packForm,'packDate','pack')", sb) === undefined || vm.runInContext("evDateGate(packForm,'packDate','pack')", sb) === '' || vm.runInContext("evDateGate(packForm,'packDate','pack')", sb) === null);
  vm.runInContext("packForm.packDate='2026-10-14';", sb);
  ok('yesterday stays within the packing limit, no box', !/why is this being recorded now/.test(vm.runInContext("evDateField('packForm','packDate','pack','x','')", sb)));
}

/* 3. late reason on Log shift output and the Run-sheet Pack */
ok('submitShiftLog asks the late reason', /evDateGate\(shiftForm,'date','shift'\)/.test(grab('submitShiftLog')));
ok('submitProdQty asks the late reason', /evDateGate\(pqForm,'date','pack'\)/.test(grab('submitProdQty')));

/* 4. shift starts empty; records carry the person; saved message */
ok('Shift starts empty', /shift:'',/.test(grab('openShiftLog')) && !/shift:sh\[0\]/.test(grab('openShiftLog')));
ok('Shift box offers — pick — first', /<option value="">— pick —<\/option>\$\{shifts\.map/.test(grab('renderShiftLog')));
{ const b = grab('submitShiftLog');
  ok('shift records carry the signed-in name (6 places)', (b.match(/by:\(\(state\.currentUser&&state\.currentUser\.name\)\|\|state\.role\)/g) || []).length === 6 && !/by:state\.role/.test(b));
  ok('a saved message after saving', /toast\(_sv\)/.test(b) && /'Saved: '\+shiftForm\.shift/.test(b)); }

/* 5. Run-sheet Pack */
{ const r = grab('renderRun');
  ok('a PO batch that the PO Pack sheet can list opens on it; any other goes to the bulk Pack sheet', /b\.kind==='po'&&poBatchesForLine\(o,l\)\.some\(function\(x\)\{return x\.id===b\.id;\}\)/.test(r));
  ok('a PO batch opens Pack on the pressed batch', /openProdQty\('"\+qsEsc\(o\.id\)\+"','"\+qsEsc\(l\.id\)\+"','"\+qsEsc\(b\.id\)\+"'\)/.test(r));
  ok('a batch made for several POs opens the bulk Pack sheet', /openPackFor\('"\+qsEsc\(b\.id\)\+"'\)/.test(r) && /may\('packing\.pack'\)/.test(r)); }
ok('openProdQty keeps the pressed batch when it is in the list', /function openProdQty\(oid,lid,bid\)/.test(html) && /\(bid&&bs\.some\(x=>x\.id===bid\)\)\?bid:/.test(html));

/* 6. + Log a shift */
ok('+ Log a shift calls tdLogShift', /\['@tdLogShift\(\)','\+ Log a shift'\]/.test(grab('tdStarts')));
{ const t = grab('tdLogShift');
  ok('1 running batch opens its shift form; more opens Running batches', /run\.length===1\)\{ openShiftLog\(run\[0\]\.id\)/.test(t) && /prodFilter='producing'/.test(t)); }

/* 7. by-product */
ok('the by-product never defaults to the batch’s own product', !/recForm\.bpBase\|\|sugBase\|\|b\.base/.test(html) && !/recForm\.bpBase\|\|sug\|\|\(bb&&bb\.base\)/.test(html));
ok('the batch’s own product is not offered as by-product', /bases\.filter\(function\(x\)\{return x!==b\.base;\}\)/.test(grab('renderReconcile')));
ok('saving a by-product of the same product is refused', /_bpi\.base===b\.base/.test(grab('saveReconcile')) && /goes under QC-cleared diverted/.test(grab('saveReconcile')));

/* 8. QA */
{ const s = grab('savePackInspect');
  ok('a Pass at or over the reject number needs Remarks', /!anyFail && _plr && \(\+f\.defects\|\|0\)>=_plr\.reject && !\(f\.remarks\|\|''\)\.trim\(\)/.test(s));
  ok('the lot log line says Packed lot inspection', /logAction\(`Packed lot inspection \$\{anyFail\?'FAILED':'PASSED'\}/.test(s)); }
ok('the lot sheet title and label say what it is', /<h2>Packed lot inspection<\/h2>/.test(grab('renderPackInspect')) && /Quantity you are inspecting now \(Kg\/L\)/.test(grab('renderPackInspect')));
ok('the truck sheet keeps Pre-shipment inspection', /<h2>Pre-shipment inspection<\/h2>/.test(html));

/* 9. Guide and changelog */
ok('My job tells Production, the Production Manager, QA, Supply Chain, Warehouse and the COO (15e)', /var _n15e=\{'Production':/.test(grab('guideMyJob')) && /'QA Inspector':_d15/.test(grab('guideMyJob')) && /'Warehouse':'The date box keeps the date you pick. On Plan the truck/.test(grab('guideMyJob')));
ok('changelog 15e', /ver:'2026-10-15e'/.test(html));
process.exitCode = report('Audit rulings of 15 Oct (15e)') ? 1 : 0;
