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
ok('BUILD_ID is 2026-09-24z or later', /BUILD_ID\s*=\s*'2026-09-(24z|2[5-9][a-z]|30[a-z])'/.test(html));
process.exitCode = report('The Guide keeps up (24z)') ? 1 : 0;
