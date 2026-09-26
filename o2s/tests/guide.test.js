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
ok('BUILD_ID is 2026-09-24z or later', /BUILD_ID\s*=\s*'2026-09-(24z|2[5-9][a-z]|30[a-z])'/.test(html));
/* 25b */
{ const rules = grab('guideRules'), how2 = grab('guideHow');
  ok('The rules: a number moves only with its record, and where to fix it (25b)', /A number moves only with its record/.test(rules) && /History/.test(rules) && /Needs you/.test(rules));
  ok('The rules: what a sale is, net of FED, FED-inclusive divided by 1.05 (25b)', /What a sale is/.test(rules) && /1\.05/.test(rules));
  ok('How it works: one lot tested for the batch (25b)', /marks one lot to test for the batch/.test(how2)); }
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
  const ref = grab('screenInstructions');
  ok('Reference steps: acknowledge / send back, PR refuse, close batch short, Packing finished, lab send back, truck sheet (26a)', /Send back<\/b> with a reason to whoever entered it/.test(ref) && /<b>refuses<\/b> it with a reason/.test(ref) && /closing a batch never closes the order/.test(ref) && /Packing finished · reconcile \/ move/.test(ref) && /sent back one step at a time, always with a note/.test(ref) && /View DC<\/b>/.test(ref));
  ok('Reference roles: Production Manager, Plant Manager, CFO, QCM, AQCM, Lab Rep, Supply Chain updated (26a)', /calls the <b>Nitro Sulfur pool<\/b>/.test(ref) && /refuse it with a reason|refuse<\/b> a close request|<b>refuse<\/b> it with a reason/.test(ref) && /send it back to the AQCM<\/b>/.test(ref) && /send it back to the analyst<\/b>/.test(ref) && /comes to you by name, with the note/.test(ref) && /ask to close only the products you tick/.test(ref));
  ok('Back Office: the CFO can send a new customer back (26a)', /<b>sends it back<\/b> with a reason to whoever entered it/.test(grab('backOfficeManualCard')));
  const TL = grabTopVar('TD_LABEL', '{');
  ok('Today labels the new jobs (26a)', /'Correct COA':\s*\{title:'COA sent back to you to correct'/.test(TL) && /'Refused':\s*\{title:'Your close request was refused'/.test(TL) && /'Sent back':\s*\{title:'Truck sent back to you'/.test(TL)); }
process.exitCode = report('The Guide keeps up (24z)') ? 1 : 0;
