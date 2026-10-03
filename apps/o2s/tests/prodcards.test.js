/* PRODUCTION IN THE NEW SHELL — 24 September 2026 (build 24w).

   Tahir, with a screenshot of Production -> What to make: "production is still
   like this?" It was: 7 number tiles, 6 tabs and a "More" menu over a 62-row
   list of order lines, one product appearing up to 6 times. Ruled: one card
   per product, like Today, with the orders inside; tiles on top as the tabs.

   Every button stays exactly as it was, built by the same code under the same
   right (authmodel.test.js checks each call site): the card's main button is
   one of its own rows' buttons, not a new one.

   Run: node prodcards.test.js */
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

const c = app('COO', 'tahir', 'Tahir Abbas');
/* 2 open orders for one liquid product, so a card must hold both */
run(c, `state.masters.products=(state.masters.products&&state.masters.products.length?state.masters.products:[]); state.masters.products.push({brand:'Card Test Liquid',base:'Card Test Liquid',form:'Liquid',active:true});
  state.orders.push({id:'OC1',po:'PO-CARD-1',client:'A',promised:'2026-01-01',received:'2026-01-01',acknowledged:true,lines:[{id:'OC1L0',brand:'Card Test Liquid',base:'Card Test Liquid',ordered:300,produced:0,packed:0,dispatched:0,delivered:0,rmStatus:'full',rmReady:'2026-01-02'}]});
  state.orders.push({id:'OC2',po:'PO-CARD-2',client:'B',promised:'2026-01-05',received:'2026-01-03',acknowledged:true,lines:[{id:'OC2L0',brand:'Card Test Liquid',base:'Card Test Liquid',ordered:200,produced:0,packed:0,dispatched:0,delivered:0,rmStatus:'full',rmReady:'2026-01-04'}]});`);
run(c, 'prodHome=false; prodView="lifecycle"; prodFilter="tomake"; prodDrill=false; prodMakeFilter="all"; state.screen="prod"; render();');
const v = run(c, 'document.getElementById("view").innerHTML');
ok('Production renders', v.length > 500, v.slice(0, 200));
ok('the page is the new shell: tiles are the tabs', /qs-tally/.test(v) && /prodOpenArea\('tomake'\)/.test(v) && /prodOpenArea\('producing'\)/.test(v) && /prodOpenArea\('qc'\)/.test(v) && /prodOpenArea\('pack'\)/.test(v));
ok('the 7-number strip is gone', !/prodPulse\(\)/.test(grab('screenProd')));
const cards = (v.match(/<div class="pcard( [^"]*)?" data-brand/g) || []).length;
const rows = (v.match(/class="wtmrow"/g) || []).length;
ok('one card per product', cards > 0 && cards < rows, cards + ' cards, ' + rows + ' rows');
const brands = run(c, '(function(){ var s={}; state.orders.forEach(function(o){ if(stageOf(o)==="Delivered")return; o.lines.forEach(function(l){ if(lineShortClosed(l))return; if(((+l.ordered||0)-(+l.produced||0))>0.5) s[l.brand||""]=1; }); }); return Object.keys(s).length; })()');
eq('as many cards as products waiting', cards, brands);
const m = /<div class="pcard[^"]*"[^>]*data-brand="Card Test Liquid"[\s\S]*?<\/details><\/div>/.exec(v);
ok('the test product has one card', !!m);
if (m) {
  const card = m[0];
  ok('...holding both orders', /PO-CARD-1/.test(card) && /PO-CARD-2/.test(card));
  ok('...totalling 500 L to make (liquid)', /<b>500<\/b> L to make/.test(card), card.slice(0, 500));
  ok('...saying 2 orders', /2 orders/.test(card));
  ok('...with a main button that is one of its rows\' buttons', /class="pcard-go"[\s\S]*?openBatchModal\(\)/.test(card));
  ok('...late, because both promised dates have passed', /class="pcard late/.test(card) || /overdue|late/.test(card));
  ok('each order row names the unit', /<div class="wtm-ql">L to make<\/div>/.test(card));
}
run(c, 'prodMakeFilter="blocked"; render();');
const vb = run(c, 'document.getElementById("view").innerHTML');
ok('the Blocked filter still works on the cards', !/data-brand="Card Test Liquid"/.test(vb));
run(c, 'prodMakeFilter="all"; render();');
/* ready products first */
{
  const order = [...v.matchAll(/<div class="pcard([^"]*)"[^>]*data-state="(\w+)"/g)].map(x => x[2]);
  const firstBlocked = order.indexOf('blocked');
  const lastReady = order.lastIndexOf('ready');
  ok('products you can start come before blocked ones', firstBlocked < 0 || lastReady < firstBlocked, order.join(','));
}
/* the other tabs still render */
['producing', 'qc', 'pack', 'completed'].forEach(f => {
  run(c, 'prodFilter=' + JSON.stringify(f) + '; render();');
  const t = run(c, 'document.getElementById("view").innerHTML');
  ok(f + ' still renders in the shell', /qs-tally/.test(t) && t.length > 300);
});
/* 24x - Tahir: "go ahead": Running, Waiting for lab and Ready to pack as cards too */
{
  const d = app('COO', 'tahir', 'Tahir Abbas');
  run(d, `state.batches.push(
    { id:'X-RUN', batchNo:'XRUN1', base:'Card Base', brand:'Card Base', kind:'bulk', status:'open', plannedKg:2000, producedKg:500, packedKg:0, disposedKg:0, openedDate:'2026-09-20', lots:[] },
    { id:'X-PACK', batchNo:'XPK1', base:'Card Base', brand:'Card Base', kind:'bulk', status:'open', plannedKg:1000, producedKg:1000, packedKg:0, disposedKg:0, openedDate:'2026-09-21',
      lots:[{id:'XL1',lotNo:'XPK1-L1',qty:1000,date:'2026-09-21',shift:'A',incharge:'x',coa:{status:'approved',certifiedKg:1000}}] },
    { id:'X-QC', batchNo:'XQC1', base:'Card Base', brand:'Card Base', kind:'bulk', status:'open', plannedKg:800, producedKg:800, packedKg:0, disposedKg:0, openedDate:'2026-09-22',
      lots:[{id:'XL2',lotNo:'XQC1-L1',qty:800,date:'2026-09-22',shift:'B',incharge:'x',coa:{status:'analysed'}}] });`);
  const tab = f => { run(d, 'prodHome=false; prodView="lifecycle"; prodDrill=false; prodFilter=' + JSON.stringify(f) + '; state.screen="prod"; render();'); return run(d, 'document.getElementById("view").innerHTML'); };
  const card = (h, bn) => { const m = new RegExp('<div class="pcard[^"]*" data-batch="' + bn + '"[\\s\\S]*?<!--/pcard-->').exec(h); return m ? m[0] : ''; };
  const body = h => (h.split('pdwrap')[1] || '');
  const r = tab('producing');
  const rc = card(r, 'XRUN1');
  ok('Running: cards, not a table', !!rc && !/<table/.test(body(r)), body(r).slice(0, 300));
  ok('...the running card says made of planned and what is left', /500<\/b> of 2,000/.test(rc) && /1,500/.test(rc), rc.slice(0, 400));
  ok('...with Log output', /openShiftLog\('X-RUN'\)/.test(rc));
  ok('...and opens the batch passport', /prodBatchSel='X-RUN';prodDrill=true;render\(\)/.test(rc));
  const q = tab('qc');
  const qc = card(q, 'XQC1-L1');
  ok('Waiting for lab: cards', !!qc && !/<table/.test(body(q)), body(q).slice(0, 300));
  ok('...naming who has it next (AQCM)', /AQCM/.test(qc));
  ok('...with Follow QC', /openBatchCOA\('X-QC','XL2'\)/.test(qc));
  const pk = tab('pack');
  const pc = card(pk, 'XPK1');
  ok('Ready to pack: cards', !!pc && !/<table/.test(body(pk)), body(pk).slice(0, 300));
  ok('...saying how much is ready to pack', /1,000<\/b> (Kg|Kg\/L|L) ready to pack/.test(pc), pc.slice(0, 400));
  ok('...with the Pack button', /openPack\('X-PACK'\)/.test(pc));
}
ok('BUILD_ID is 2026-09-24x or later', /BUILD_ID\s*=\s*'2026-09-(24[x-z]|2[5-9][a-z]|30[a-z])'/.test(html));
ok('the changelog tells Production (24x)', /ver:'2026-09-24x'[\s\S]{0,600}card/i.test(html));
ok('BUILD_ID is 2026-09-24w or later', /BUILD_ID\s*=\s*'2026-09-(24[w-z]|2[5-9][a-z]|30[a-z])'/.test(html));
ok('the changelog tells Production', /ver:'2026-09-24w'[\s\S]{0,600}card/i.test(html));
process.exitCode = report('Production in the new shell (24w)') ? 1 : 0;
