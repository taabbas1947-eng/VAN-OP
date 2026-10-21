/* THE GUIDE KEEPS UP — 24 September 2026 (build 24z).

   Tahir: "Please remember to keep updating the guides and rules, my jobs, how
   this app works WITH EVERY NEW CHANGE, ADDITION AND PUSH."

   This suite pins what the Guide must say about the day's changes (24q-24y),
   and CLAUDE.md now makes the Guide part of every change. When a later build
   changes a flow, add its lines here.

   Run: node guide.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar, html } = H;
const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;
const BLOCKS = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
function app(role, user, name) {
  const els = {};
  const el = (id) => {
    if (id && els[id]) return els[id];
    const o = { id: id || '', innerHTML: '', textContent: '', value: '', style: {}, _cls: {},
      classList: { add(k) { o._cls[k] = 1; }, remove(k) { delete o._cls[k]; }, contains(k) { return !!o._cls[k]; }, toggle() {} },
      addEventListener() {}, appendChild() {}, querySelector() { return el(); },
      querySelectorAll() { return []; }, focus() {}, click() {}, getAttribute() { return null; },
      setAttribute() {}, remove() {}, dataset: {}, children: [], parentNode: null, scrollIntoView() {},
      insertAdjacentHTML(p, h) { o.innerHTML += h; } };
    if (id) els[id] = o;
    return o;
  };
  const doc = { getElementById(id) { return el(id); }, querySelector() { return el(); },
    querySelectorAll() { return []; }, createElement() { return el(); },
    body: el('body'), documentElement: el('html'), head: el('head'), addEventListener() {} };
  const printed = [];
  const c = { console, JSON, Math, Date, String, Number, Array, Object, Boolean, RegExp, Error,
    isNaN, parseInt, parseFloat, Promise, Intl, URL, encodeURIComponent, decodeURIComponent,
    document: doc, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch() { return Promise.resolve({ ok: false, json: () => ({}) }); },
    alert() {}, confirm() { return true; }, prompt() { return 'wrong spec on pH'; },
    location: { href: '', search: '', reload() {} }, navigator: { userAgent: 'node' },
    history: { pushState() {} }, requestAnimationFrame() {}, performance: { now() { return 0; } },
    Blob: function () {}, btoa: s => s, atob: s => s,
    open() { return { document: { write(h) { printed.push(h); }, close() {} }, focus() {} }; } };
  c.window = c; c.globalThis = c; c.self = c;
  vm.createContext(c);
  BLOCKS.forEach(b => vm.runInContext(b, c));
  c.__printed = printed;
  c.__st = JSON.parse(JSON.stringify(STATE));
  vm.runInContext('state = __st; state.batches = state.batches || [];'
    + ' toasts = []; toast = function(m){ toasts.push(String(m)); }; save = function(){};'
    + ' usersList = [{username:"awais",name:"Awais Ali",role:"Lab Rep"},{username:"mubeen",name:"Mubeen Ahmad",role:"Lab Rep"},'
    + '{username:"masab",name:"Masab Khan",role:"AQCM"},{username:"himayat",name:"Himayat Hussain",role:"QCM"},{username:"fahim",name:"Fahim Asghar",role:"Plant Manager"}];', c);
  vm.runInContext('if(typeof seedDeptRightsV1==="function") seedDeptRightsV1(state);', c);
  as(c, role, user, name);
  c.__els = els;
  return c;
}
function as(c, role, user, name) { vm.runInContext('state.role=' + JSON.stringify(role) + '; state.currentUser={name:' + JSON.stringify(name) + ',username:' + JSON.stringify(user) + ',role:' + JSON.stringify(role) + '}; toasts=[];', c); }
const run = (c, src) => vm.runInContext(src, c);

const c = app('Lab Rep', 'awais', 'Awais Ali');
const TDN = run(c, 'TD_NEXT');
eq('a sample to assign becomes tests to run', TDN['Assign sample'], 'Lab test');
eq('a test to run becomes a certificate to review', TDN['Lab test'], 'Review');
const lt = run(c, 'guideJobCard("Lab test","Lab Rep")');
ok('the Lab test job card says what happens when a test is late', /due time/.test(lt) && /QC manager/i.test(lt) && /Plant Manager/.test(lt), lt.replace(/<[^>]+>/g, ' ').slice(0, 400));
ok('...and that the bench sheet is where it is done', /bench sheet/.test(lt));
const how = run(c, 'guideHow()');
ok('How the app works: the lab step describes assignment by test', /assigns each test/.test(how) && /bench sheet/.test(how));
ok('...production as one card per product', /one card per product/.test(how));
const rules = run(c, 'guideRules()');
ok('The rules: nobody who ran a test on a sample signs its certificate', /ran a test/.test(rules));
ok('...management does not sign a certificate', /Management does not sign/.test(rules));
ok('...the leave cover, one line only, printed "for"', /cover/.test(rules) && /never signs both lines/.test(rules) && /for<\/b>|“for”|"for"/.test(rules));
ok('...and to announce a leave', /going on leave/.test(rules));
as(c, 'AQCM', 'masab', 'Masab Khan');
const aj = run(c, 'guideMyJob()');
ok('My job for the AQCM: how to announce a leave', /going on leave/.test(aj));
ok('...and that a sample you tested is not yours to sign', /tested/.test(aj));
as(c, 'Plant Manager', 'fahim', 'Fahim Asghar');
ok('My job for the Plant Manager: the lab leave cover is his', /Leave cover/.test(run(c, 'guideMyJob()')));
as(c, 'COO', 'tahir', 'Tahir Abbas');
ok('My job for the COO: he does not sign certificates', /do not sign/.test(run(c, 'guideMyJob()')));
as(c, 'Finance', 'ismaeel', 'Muhammad Ismail');
ok('My job for Finance: the print-on-pack answer is theirs', /Print-on-pack/.test(run(c, 'guideMyJob()')));
ok('How the app works: a sale is counted when the truck is released, before taxes (25a)', /counts as a sale/.test(how) && /net of FED/.test(how));
ok('BUILD_ID is 2026-09-24z or later', /BUILD_ID\s*=\s*'(?:2026-1[0-2]-\d\d[a-z]|2026-09-(24z|2[5-9][a-z]|30[a-z]))'/.test(html));
/* 25b */
{ const rules = grab('guideRules'), how2 = grab('guideHow');
  ok('The rules: a number moves only with its record, and where to fix it (25b)', /A number moves only with its record/.test(rules) && /History/.test(rules) && /Needs you/.test(rules));
  ok('The rules: what a sale is, net of FED, FED-inclusive divided by 1.05 (25b)', /What a sale is/.test(rules) && /1\.05/.test(rules));
  ok('How it works: every lot tested on its own (13e)', /every lot is tested on its own/.test(how2)); }
/* 25j */
ok('My job names How are we doing for the roles that have it (25j)', /How are we doing<\/b><span>4 answers/.test(grab('guideMyJob')) && /howMay\(\)/.test(grab('guideMyJob')));
ok('How it works: an order carries terms, ERP SO and the 5% price reason (25j)', /payment terms and the ERP SO #/.test(grab('guideHow')) && /more than 5%/.test(grab('guideHow')));
/* 26a */
{ const rules = grab('guideRules'), how3 = grab('guideHow');
  ok('How it works: Close batch beside Log output; a batch close is not an order close (26a)', /Close batch, beside Log output/.test(how3) && /Closing a batch does not close the order/.test(how3));
  ok('How it works: made-so-far on a multi-order batch comes to what was packed (26a)', /made-so-far is brought to what was actually packed/.test(how3));
  ok('How it works: every truck sign-off opens a sheet; send back to whoever issued the gate pass (26a)', /opens a sheet first/.test(how3) && /send it back with a reason to whoever issued the gate pass/.test(how3));
  ok('The rules: tick only the products to close; nothing is ticked for you (26a)', /tick only the products to close; nothing is ticked for you/.test(rules));
  ok('The rules: Supplied from stock outside O2S (26a)', /Supplied from stock outside O2S/.test(rules) && /not counted against us/.test(rules));
  ok('The rules: a refusal needs a reason and goes back to the asker (26a)', /A refused close needs a reason/.test(rules) && /goes back to the person who asked/.test(rules));
  ok('Job cards: a truck sign-off opens a sheet to read before confirming (26a)', /a truck sign-off opens a sheet/.test(grab('guideJobCard')));
  ok('How it works: a report is sent back one step at a time with a note (26a)', /sent back one step at a time, always with a note/.test(how3) && /the QCM sends it back to the AQCM, the AQCM to the analyst who drafted it/.test(how3));
  ok('The rules: a leftover duplicate lot is removed as a record only (26a)', /leftover duplicate/.test(rules) && /produced does not change/.test(rules));
  ok('The rules: see it before you sign it; every no has a way back, and to whom (26a)', /See it before you sign it; every no has a way back/.test(rules) && /the PO goes back to whoever entered it, the purchase request to Supply Chain/.test(rules) && /nothing waits without an owner/.test(rules));
  ok('How it works: Packing finished and the ways to account for a leftover (26a)', /presses <b>Packing finished<\/b>/.test(how3) && /Sulfur Coated Urea goes to the Nitro Sulfur pool/.test(how3) && /keep as bulk stock/.test(how3));
  ok('How it works: PR refuse and PO send back (26a)', /refuses with a reason that goes back to Supply Chain/.test(how3) && /send a wrong PO back to whoever entered it/.test(how3));
  const jb = grab('guideMyJob');
  ok('My job: a New on 26 Sep note for every role touched (26a)', ['Production Manager','Production','Plant Manager','Supply Chain','Warehouse','Supply Chain Officer','CFO','Finance','Finance Desk Officer','QCM','AQCM','Lab Rep'].every(r => jb.indexOf("'" + r + "':") > -1) && /New on 26 Sep/.test(jb));
  const ref = grab('guideReference');
  ok('Reference (07h): the order end to end is read from TD_NEXT, with who and when it escalates', /gdChain\(\)/.test(ref) && /TD_NEXT\[l\]/.test(grab('gdChain')) && /gdEscTxt\(l\)/.test(ref) && /gdWho\(M,l\)/.test(ref));
  ok('Reference (07h): every screen by its current name and who can open it; no old names', /SCREENS\.filter/.test(ref) && /gdScreenOpen\(r,s\.id\)/.test(ref) && !/My Actions|PO Tracker|New PO Entry|Data Fix|Sent tab/.test(ref));
  ok('Back Office: the CFO can send a new customer back (26a)', /<b>sends it back<\/b> with a reason to whoever entered it/.test(grab('backOfficeManualCard')));
  const TL = grabTopVar('TD_LABEL', '{');
  ok('Today labels the new jobs (26a)', /'Correct COA':\s*\{title:'COA sent back to you to correct'/.test(TL) && /'Refused':\s*\{title:'Your close request was refused'/.test(TL) && /'Sent back':\s*\{title:'Truck sent back to you'/.test(TL)); }
ok('The Rules say each list-price product on a truck gets its own price (6 Oct)', /on a truck with 2 or more such products, the price for each product/.test(html));
ok('The Rules say a packed product cannot be closed as We could not supply (6 Oct)', /A product already packed in full cannot be closed as <b>We could not supply<\/b>/.test(html));
ok('The Rules say who chooses the batch on a truck, and the reprint jobs (10 Oct, 10h)', /<h3>Which batch goes on the truck<\/h3>/.test(html) && /Oldest first is filled in/.test(html) && /Not needed with a reason/.test(html) && /Still to be packed<\/b>/.test(html));
ok('The Rules say how to correct a wrong batch number (10 Oct, 10d)', /<h3>A wrong batch number<\/h3>/.test(html) && /Ask for a correction<\/b>/.test(html) && /1 character different from one already used/.test(html) && /checks the batch printed on the bags against each batch line/.test(html));
ok('The Rules say what N/A is on an inspection (10 Oct, 10c)', /<h3>N\/A on an inspection<\/h3>/.test(html) && /It is offered only on <b>Price on the pack<\/b>/.test(html) && /<h3>QA checks by pack type<\/h3>/.test(html));
ok('The Rules say where to find a batch (10 Oct)', /<b>Batch trace<\/b>/.test(html) && /Where a batch went/.test(html) && /Tap a brand batch row to see the packing runs/.test(html));
ok('The Rules say where to find a copy of each paper (6 Oct, 06c)', /<h3>Where to find a copy<\/h3>/.test(html) && /Its sheet ends with <b>Papers<\/b>/.test(html));
ok('The Rules say an FOC sample\u2019s DC is in Documents, marked FOC sample (13 Oct)', /marked <b>FOC sample<\/b>, for the people who may open FOC samples/.test(html));
ok('The Rules: moving packed stock to another PO, who asks, who approves, what moves (7 Oct, 07c)', /<h3>Moving packed stock to another PO<\/h3>/.test(html) && /<b>Supply Chain asks<\/b>/.test(html) && /<b>Plant Manager approves<\/b>/.test(html));
ok('Guide search: a box at the top, every tab searched, each hit names its tab and opens it (07d)', /id="gdFind"/.test(grab('guidePage')) && /guideSearchHTML\(guideQ\)/.test(grab('guidePage')) && ['guideMyJob','guideHow','guideRules','rolesTitlesCard','backOfficeManualCard','_gdRef'].every(f => grab('guideSearchBlocks').indexOf(f) > -1) && /Open this tab/.test(grab('guideSearchHTML')));
ok('Guide search marks words in the text, never inside a tag', /split\(\/\(<\[\^>\]\+>\)\/\)/.test(grab('guideMark')));
ok('a tab button clears the search', /guideQ=\\'\\';guideTab=/.test(grab('guideTabsHTML')));
{ const j = grab('guideMyJob'); ok('My job: a New on 7 Oct note for every role touched (07d)', ['Supply Chain','Plant Manager','Production Manager','Production','QA Inspector','Warehouse','Supply Chain Officer','QCM','AQCM','Lab Rep','CFO','KAM','Finance','Finance Desk Officer'].every(r => j.indexOf("'" + r + "':") > -1) && /New on 7 Oct\./.test(j) && /Move packed stock to another PO/.test(j)); }
ok('The rules: lateness counts calendar days; same day is never late (07d)', /counted in <b>calendar days<\/b>, not hours: anything entered on the same day it happened is never late/.test(grab('guideRules')));
ok('The Rules say how to go back from a printed paper (12 Oct, 12a)', /<h3>Going back from a printed paper<\/h3>/.test(html) && /Back to O2S<\/b> and <b>Print \/ Save PDF/.test(html) && /does not print/.test(html));
ok('The Rules say how much a batch may make: 115% of plan (12 Oct, 12b)', /<h3>How much a batch may make<\/h3>/.test(html) && /115%/.test(grab('guideRules')) && /A batch at its plan shows only Close batch/.test(html));
ok('The marks say what stalled means and who is told (15 Oct, 15d)', /<span class="k">stalled \u00b7 Plant Manager told<\/span><span>a product to make with no batch opened, or nothing logged on its batch, for 4 days or more \(for a base made in bulk: no output logged on any batch of that base\); it has also gone to the Plant Manager\. Never while the line was packed in the last 7 days<\/span>/.test(grab('guideHow')));
ok('How the app works: Saad or Shoaib reviews and can send a truck back (15 Oct, 15d)', /The reviewer \(Saad or Shoaib\) or the Plant Manager can send it back/.test(grab('guideHow')));
ok('My job (Warehouse, Supply Chain Officer): sent back by the reviewer, Saad or Shoaib (15 Oct, 15d)', (grab('guideMyJob').match(/A truck sent back by the reviewer \(Saad or Shoaib\) or the Plant Manager comes to you/g) || []).length === 2);
ok('No screen says a packing PO can be left unassigned (15 Oct, 15d)', !/or leave unassigned/.test(html));
ok('Plan the truck names no Sent tab (15 Oct, 15d)', !/from the <b>Sent<\/b> tab/.test(html) && /Next: the warehouse loads this truck, '\+\(qaRequiredOn\(dispForm\.date\)\?'QA inspects it, ':''\)\+'the warehouse issues the gate pass, Saad or Shoaib reviews it and the Plant Manager releases it/.test(html));
ok('A faded message never catches a tap; messages stay at least 4 seconds (15 Oct, 15d)', /\.toast\{pointer-events:none;/.test(html) && /id="toast" role="status" aria-live="polite"/.test(html) && /Math\.max\(4000,String\(m\|\|''\)\.length\*60\)/.test(grab('toast')));
ok('The Rules: one stuck rule per order line, 7 days, any order age (15 Oct, 15f)', /Plant, the Production batch list and Today use <b>one rule<\/b>/.test(grab('guideRules')) && /for <b>7 days<\/b>/.test(grab('guideRules')) && /is never late for its age/.test(grab('guideRules')));
ok('The Rules: Pack from base, 1 card per order line (15 Oct, 15f)', /<h3>Pack from base<\/h3>/.test(grab('guideRules')) && /<b>1 card per order line<\/b>/.test(grab('guideRules')));
ok('The Rules: vehicle, driver and phone on every truck; bilty optional (15 Oct, 15f)', /<b>vehicle no\., driver name and driver phone<\/b> are needed; <b>bilty is optional<\/b>/.test(grab('guideRules')));
ok('The Rules: changing a batch at loading, the truck back to QA, DC revised (15 Oct, 15f)', /<h3>Changing a batch at loading<\/h3>/.test(grab('guideRules')) && /<b>whole truck goes back to QA<\/b>/.test(grab('guideRules')) && /prints <b>revised<\/b>/.test(grab('guideRules')));
ok('The Rules: truck released, Handed to driver (15 Oct, 15f)', /<h3>Truck released: hand the papers to the driver<\/h3>/.test(grab('guideRules')) && /Only the tap closes the job, not the print/.test(grab('guideRules')));
ok('The Rules: truck clocks per step, shared jobs, look-alike batch numbers, QA by pack type (15 Oct, 15f)', /<h3>How long a truck job has waited<\/h3>/.test(grab('guideRules')) && /<h3>Shared jobs<\/h3>/.test(grab('guideRules')) && /<h3>A batch number that looks like another<\/h3>/.test(grab('guideRules')) && /<h3>QA checks by pack type<\/h3>/.test(html));
ok('The marks: stuck, last packed and Shared (15 Oct, 15f)', /<span class="k">stuck · Plant Manager told<\/span>/.test(html) && /<span class="k">⇄ Shared · names<\/span>/.test(html));
ok('My job: a New on 15 Oct (15f) note for every role touched', ['Production','Production Manager','Plant Manager','QA Inspector','Warehouse','Supply Chain','Supply Chain Officer','COO'].every(r => new RegExp("var _n15f=\\{[\\s\\S]*'" + r + "':").test(grab('guideMyJob'))) && /New on 15 Oct \(15f\)/.test(grab('guideMyJob')));
ok('The Rules: stuck at packing, close short or waiting for client (15 Oct, 15g)', /<h3>Stuck at packing: close short or keep<\/h3>/.test(grab('guideRules')) && /1 to 30 days/.test(grab('guideRules')));
ok('The Rules: waiting for production, both cards (15 Oct, 15g)', /<h3>Waiting for production<\/h3>/.test(grab('guideRules')) && /Production run<\/b> card for the rest/.test(grab('guideRules')));
ok('The marks: waiting for client until a date (15 Oct, 15g)', /<span class="k">⏸ waiting for client until date<\/span>/.test(html));
ok('My job: a New on 15 Oct (15g) note for every role touched', ['Supply Chain','Production','Production Manager','Plant Manager','COO'].every(r => new RegExp("var _n15g=\\{[\\s\\S]*'" + r + "':").test(grab('guideMyJob'))));
ok('The Rules: every line sees all the ready base; wait can be changed or ended; PO batch lines get the job (15 Oct, 15g)', /every card shows all the ready base/.test(grab('guideRules')) && /Change or end/.test(grab('guideRules')) && /its own PO batch/.test(grab('guideRules')));
ok('The Rules: reading and signing what changed (16 Oct, 16a)', /<h3>Reading and signing what changed<\/h3>/.test(grab('guideRules')) && /Read and signed/.test(grab('guideRules')));
ok('The Rules: System documentation (16 Oct, 16a)', /<h3>System documentation<\/h3>/.test(grab('guideRules')) && /Not confirmed/.test(grab('guideRules')));
ok('The Rules: the month on the bag (16 Oct, 16b)', /<h3>The month on the bag<\/h3>/.test(grab('guideRules')) && /Mfg is the month of packing/.test(grab('guideRules')) && /Packed in 2 months/.test(grab('guideRules')) && /nobody inspects a run they keyed/.test(grab('guideRules')));
ok('My job: a New on 16 Oct (16b) note for every role touched', ['Production','Production Manager','QA Inspector','Plant Manager','COO'].every(r => new RegExp("var _n16b=\\{[\\s\\S]*'" + r + "':").test(grab('guideMyJob'))));
ok('The Rules: the truck checks the Mfg month on the bag (16b)', /the Mfg month on the bag/.test(grab('guideRules')));
ok('Guide has a System documentation tab for everyone (16a)', /\['sysdoc','System documentation'\]/.test(grab('guideTabsHTML')));
ok('How the app works: Saving, Not saved yet, Try now and Saved (21 Oct, 21a)', /<h2>When you press a button<\/h2>/.test(grab('guideHow')) && /Not saved yet/.test(grab('guideHow')) && /Try now/.test(grab('guideHow')) && /a refresh before it is saved loses the change/i.test(grab('guideHow')) && /on a phone, wait for <b>Saved<\/b>/.test(grab('guideHow')));
process.exitCode = report('The Guide keeps up (24z)') ? 1 : 0;
