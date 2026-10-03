/* SHIPMENTS IN THE NEW SHELL — 24 September 2026 (build 24y).

   Tahir asked whether the whole app is now in the new design. It was not; he
   picked Shipments first (Supply Chain and the warehouse work in it all day).
   The screen already drew trucks as cards; what was old was the frame: a teal
   title bar, 6 tabs and a 6-number strip under the app's old top bar. Now it
   wears the same shell as Lab and Truck inspection: title, one line, 4 tiles
   that are the tabs, Delivered and Need action beside them. The cards, their
   buttons and every right behind them are unchanged.

   Run: node shipshell.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
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

const sc = grab('screenShip');
ok('the old number strip is gone', !/shipPulse\(/.test(sc));
ok('the old tab bar is gone', !/shipTabs\(/.test(sc));
ok('the right behind the screen is unchanged', /var ed=may\('shipment\.plan'\)/.test(sc));
ok('the app top bar is hidden on Shipments, as on the other shell screens', /body\[data-screen="ship"\] \.topbar/.test(html));
const c = app('Supply Chain', 'saad', 'Saad Jamal');
const view = v => { run(c, 'state.screen="ship"; shipView=' + JSON.stringify(v) + '; render();'); return run(c, 'document.getElementById("view").innerHTML'); };
const r = view('ready');
ok('Shipments wears the shell: a title', /<div class="qs wide"><h1>Shipments<\/h1>/.test(r));
ok('...4 tiles that are the tabs', /qs-tally four/.test(r) && ['ready', 'planned', 'loading', 'transit'].every(k => r.indexOf("shipSetView('" + k + "')") > -1));
ok('...Delivered and Need action beside them', /shipSetView\('delivered'\)/.test(r) && /shipSetView\('needaction'\)/.test(r));
ok('...the selected tile is marked', /qs-tile go[^"]* sel" onclick="shipSetView\('ready'\)"/.test(r));
ok('Supply Chain still starts a shipment from a card', /mpStart\(/.test(r));
['planned', 'loading', 'transit', 'delivered', 'needaction'].forEach(v => {
  let h = ''; try { h = view(v); } catch (e) { h = 'THREW ' + e.message; }
  ok(v + ' renders in the shell', /<h1>Shipments<\/h1>/.test(h) && !/^THREW/.test(h), h.slice(0, 120));
});
const k = app('KAM', 'k', 'Kam');
run(k, 'state.screen="ship"; shipView="ready"; render();');
ok('a role without shipment.plan is not offered Start shipment', !/mpStart\(/.test(run(k, 'document.getElementById("view").innerHTML')));
ok('BUILD_ID is 2026-09-24y or later', /BUILD_ID\s*=\s*'2026-09-(24[y-z]|2[5-9][a-z]|30[a-z])'/.test(html));
ok('the changelog tells Supply Chain', /ver:'2026-09-24y'[\s\S]{0,600}Shipments/.test(html));
process.exitCode = report('Shipments in the new shell (24y)') ? 1 : 0;
