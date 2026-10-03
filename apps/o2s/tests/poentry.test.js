/* NEW PO ENTRY REDESIGN -- 2026-08-26.
   Covers the design-artifact-approved changes actually shipped this round: three new
   optional capture fields (Delivery Contact Phone, Order Source, General Instructions),
   a step-progress strip, and the sticky Order Summary panel that replaced the raw-material
   preview card Tahir asked to have dropped. (A real client-PO attachment was designed
   alongside these but Tahir asked to hold it back for a later session -- "leave the
   attachment part for now" -- so there is no attachment code, and no attachment tests,
   in this file.)

   Two layers, same split the rest of this suite uses:
   1. Source-level checks (H.grab) for the wiring that is cheapest and most reliable to
      verify by reading the actual text -- the reset list, validate()'s new call.
   2. Real execution (the app() sandbox from prodrender.test.js) for the purely additive
      UI helpers that render or validate on their own: entryStepDots, updateEntrySummary.

   Run: node poentry.test.js */
const H = require('./harness.js');
const fs = require('fs');
const vm = require('vm');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

const STATE = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;
const BLOCKS = [...H.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

/* ================= 1. source-level: the raw-material preview is really gone ================= */
{
  ok('previewRM no longer exists', (() => { try { H.grab('previewRM'); return false; } catch (e) { return /not found/.test(e.message); } })());
  const validateBody = H.grab('validate');
  ok('validate() calls updateEntrySummary instead of previewRM',
     /updateEntrySummary\(\)/.test(validateBody) && !/previewRM\(\)/.test(validateBody), validateBody.slice(-200));
  /* screenEntry() is too irregular (nested template literals with their own quotes and
     a `.replace(/"/g, ...)` regex literal) for harness.js's brace-matcher -- the same known
     limitation documented in matchBlock's own comments, not something this change caused.
     A whole-file search is the reliable way to check these markers are really gone /
     really present, rather than trusting a body that may have been silently truncated. */
  ok('the app no longer has a Raw-material check card anywhere', !/Raw-material check/.test(H.html));
  ok('the app no longer has an e_preview element anywhere', !H.html.includes('id="e_preview"'));
  ok('screenEntry gained the step strip', H.html.includes('id="e_steps"'));
  ok('screenEntry gained the sticky Order Summary panel', H.html.includes('id="e_summary"'));
  ok('rmCheck (the real, shared RM function used elsewhere) is untouched', typeof H.grab('rmCheck') === 'string' && H.grab('rmCheck').length > 20);
  ok('no attachment code shipped this round (held back on purpose)',
     !H.html.includes('entryAttachFile') && !H.html.includes('/api/o2s/attachments'));
}

/* ================= 2. source-level: reset list covers the three new fields ================= */
{
  const onChange = H.grab('onChannelChange');
  ['entryFocalPhone', 'entrySource', 'entryInstructions'].forEach(v => {
    ok('onChannelChange resets ' + v, new RegExp(v + "\\s*=\\s*''").test(onChange), onChange);
  });
}

/* ================= 3. source-level: submitPO still gates on the right, and records the
   three new fields on the order (attachment fields deliberately absent) ================= */
{
  const submitBody = H.grab('submitPO');
  ok('submitPO is still a plain (non-async) function -- no upload step to await',
     H.html.includes('function submitPO(') && !H.html.includes('async function submitPO'));
  ok('submitPO still asks may(\'order.create\') first',
     /may\('order\.create'\)/.test(submitBody));
  ['focalPhone:', 'source:', 'instructions:'].forEach(f => {
    ok('order object records ' + f.replace(':', ''), submitBody.includes(f));
  });
  ok('order object does NOT record attachment fields yet (feature held back)',
     !submitBody.includes('attachmentName:') && !submitBody.includes('attachmentStored:'));
}

/* ---- a sandbox with just enough browser for the entry-screen helpers (same shape
   as prodrender.test.js's app(), reused here rather than re-invented) ---- */
function app() {
  const el = () => ({ innerHTML: '', textContent: '', value: '', style: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener() {}, appendChild() {}, querySelector() { return el(); },
    querySelectorAll() { return []; }, focus() {}, click() {}, getAttribute() { return null; },
    setAttribute() {}, remove() {}, dataset: {}, children: [], parentNode: null, scrollIntoView() {} });
  const doc = { getElementById() { return el(); }, querySelector() { return el(); },
    querySelectorAll() { return []; }, createElement() { return el(); },
    body: el(), documentElement: el(), head: el(), addEventListener() {} };
  const c = { console, JSON, Math, Date, String, Number, Array, Object, Boolean, RegExp, Error,
    isNaN, parseInt, parseFloat, Promise, Intl, URL, encodeURIComponent, decodeURIComponent,
    document: doc, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch() { return Promise.resolve({ json: () => ({}) }); },
    alert() {}, confirm() { return true; }, prompt() { return ''; },
    location: { href: '', search: '', reload() {} }, navigator: { userAgent: 'node' },
    history: { pushState() {} }, requestAnimationFrame() {}, performance: { now() { return 0; } },
    Blob: function () {}, btoa: s => s, atob: s => s };
  c.window = c; c.globalThis = c; c.self = c;
  vm.createContext(c);
  BLOCKS.forEach(b => vm.runInContext(b, c));
  c.__st = JSON.parse(JSON.stringify(STATE));
  vm.runInContext('state = __st; state.screen = "entry";', c);
  return c;
}
const run = (c, src) => vm.runInContext(src, c);

/* ================= 4. entryStepDots -- reflects real completion, not just presence ================= */
{
  const c = app();
  const dots = run(c, 'entryStepDots()');
  eq('entryStepDots returns exactly 4 steps (Header, Line items, Pricing, Submit)', dots.length, 4);
  eq('with nothing entered, Header is not-started grey', dots[0].color, '#d8cfc0');

  run(c, `entryChannel='Modern Trade'; entryClient='c1';`);
  const dots2 = run(c, 'entryStepDots()');
  eq('once channel + client are set, Header turns done-teal', dots2[0].color, '#0f766e');
}

/* ================= 5. updateEntrySummary -- mirrors the new fields back, with placeholders
   when unset ================= */
{
  const c = app();
  /* updateEntrySummary() reads the three new fields off the DOM ($('e_focalphone') etc.),
     the same way it already reads Priority/Received/Promised -- not off the entryFocalPhone
     etc. globals directly (those globals only feed the value= on first render). So the
     stub needs a real per-id value store, not a single always-empty object. */
  run(c, `entryChannel='Modern Trade'; entryClient='';`);
  run(c, `
    document._vals = {};
    document.getElementById = function(id){
      if (id === 'e_summary' || id === 'e_steps') { if (!this._els) this._els = {}; if (!this._els[id]) this._els[id] = {innerHTML:''}; return this._els[id]; }
      if (!(id in this._vals)) this._vals[id] = '';
      var self = this;
      return { get value(){ return self._vals[id]; }, set value(v){ self._vals[id] = v; }, innerHTML: '' };
    };
  `);
  run(c, 'updateEntrySummary()');
  const html1 = run(c, "document.getElementById('e_summary').innerHTML");
  ok('unset focal/source render as "not set" placeholders, not blank', /not set/.test(html1));
  ok('summary never mentions the removed raw-material preview', !/raw material/i.test(html1) && !/Raw-material/.test(html1));
  ok('summary never mentions an attachment (feature held back)', !/attach/i.test(html1));

  run(c, `document._vals['e_focalphone']='0300-1234567'; document._vals['e_source']='WhatsApp'; document._vals['e_instructions']='Deliver before 2pm';`);
  run(c, 'updateEntrySummary()');
  const html2 = run(c, "document.getElementById('e_summary').innerHTML");
  ok('once filled in, the phone/source/instructions show in the summary',
     html2.includes('0300-1234567') && html2.includes('WhatsApp') && html2.includes('Deliver before 2pm'));
}

console.log('\nNew PO Entry redesign: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
if (fail > 0) process.exit(1);
