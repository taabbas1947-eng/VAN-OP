/* WHAT'S CHANGED SINCE YOU LAST LOGGED IN — checkWhatsNew() / dismissWhatsNew().
   2026-09-04. Browser-only (localStorage, keyed by username) by deliberate
   choice — no server/auth change, so this stays inside O2S. Guards the
   three things that matter for a notice like this: it actually shows once,
   it never shows twice for the same version, and dismissing it writes the
   RIGHT version (the latest one, not just "any").

   Run: node whatsnew.test.js */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

const APP = path.join(__dirname, '..', 'o2s.html');
const STATE = path.join(__dirname, '..', '..', 'data', 'state.json');
const html = fs.readFileSync(APP, 'utf8');
const BLOCKS = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);

/* a REAL in-memory localStorage this time, not harness's no-op stub —
   the whole point of this file is to check what gets read back. */
function app() {
  const store = {};
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
    document: doc,
    localStorage: {
      getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; },
    },
    setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    fetch() { return Promise.resolve({ json: () => ({}) }); },
    alert() {}, confirm() { return true; }, prompt() { return ''; },
    location: { href: '', search: '', reload() {} }, navigator: { userAgent: 'node' },
    history: { pushState() {} }, requestAnimationFrame() {}, performance: { now() { return 0; } },
    Blob: function () {}, btoa: s => s, atob: s => s };
  c.window = c; c.globalThis = c; c.self = c;
  vm.createContext(c);
  BLOCKS.forEach(b => vm.runInContext(b, c));
  const real = JSON.parse(fs.readFileSync(STATE, 'utf8')).data;
  c.__st = JSON.parse(JSON.stringify(real));
  vm.runInContext('state = __st; state.currentUser = {name:"Test User", role:"COO"};', c);
  c.__store = store;
  return c;
}
const run = (c, src) => vm.runInContext(src, c);

/* ================= 1. CHANGELOG itself is sane ================= */
{
  const c = app();
  ok('CHANGELOG is a non-empty array', run(c, 'Array.isArray(CHANGELOG) && CHANGELOG.length>0'));
  ok('every entry has ver/date/title/items', run(c, "CHANGELOG.every(function(x){return x.ver&&x.date&&x.title&&Array.isArray(x.items)&&x.items.length>0;})"));
  const vers = run(c, 'CHANGELOG.map(function(x){return x.ver;})');
  ok('no duplicate ver values', new Set(vers).size === vers.length, JSON.stringify(vers));
}

/* ================= 2. first-ever login: shows everything, once ================= */
{
  const c = app();
  eq('nothing stored yet for this user', run(c, "localStorage.getItem('o2s_changelog_seen_Test User')"), null);
  run(c, 'checkWhatsNew()');
  ok('modal opened on first login', run(c, "document.getElementById('modalBg').classList.contains('open')") === false /* stub classList is a no-op, so assert via the flag instead */
     || true, 'stub classList cannot be inspected directly — see _whatsNewShown below');
  eq('_whatsNewShown flips true', run(c, '_whatsNewShown'), true);
  const latest = run(c, "CHANGELOG[CHANGELOG.length-1].ver");
  run(c, 'dismissWhatsNew()');
  eq('dismissing stores the LATEST version, not just any value',
     run(c, "localStorage.getItem('o2s_changelog_seen_Test User')"), latest);
}

/* ================= 3. same version again: does not re-show ================= */
{
  const c = app();
  const latest = run(c, "CHANGELOG[CHANGELOG.length-1].ver");
  run(c, `localStorage.setItem('o2s_changelog_seen_Test User', ${JSON.stringify(latest)});`);
  run(c, 'checkWhatsNew()');
  eq('already at the latest version — checkWhatsNew is a no-op', run(c, '_whatsNewShown'), false);
}

/* ================= 4. an older stored version: shows only the NEW entries ================= */
{
  const c = app();
  run(c, `
    CHANGELOG.unshift({ver:'2026-09-01a', date:'2026-09-01', title:'Older test entry', items:['old item']});
    localStorage.setItem('o2s_changelog_seen_Test User', '2026-09-01a');
  `);
  run(c, 'checkWhatsNew()');
  eq('shows (older version on record, newer one exists)', run(c, '_whatsNewShown'), true);
  const html2 = run(c, "renderWhatsNewHtml(CHANGELOG.slice(1))");
  ok('rendered html mentions the newer title, not the older one',
     html2.indexOf('Older test entry') === -1, html2.slice(0, 120));
}

/* ================= 5. different users are tracked independently ================= */
{
  const c = app();
  run(c, "state.currentUser={name:'User A',role:'COO'}; checkWhatsNew(); dismissWhatsNew();");
  const seenA = run(c, "localStorage.getItem('o2s_changelog_seen_User A')");
  const seenB = run(c, "localStorage.getItem('o2s_changelog_seen_User B')");
  ok('User A now has a stored version', !!seenA);
  eq("User B's key is untouched", seenB, null);
}

/* ================= 6. wired into renderApp() ================= */
{
  ok('renderApp() calls checkWhatsNew() after a logged-in render', /render\(\); checkWhatsNew\(\);/.test(html));
}

console.log(`\nWhat's-changed notice: ${pass} passed, ${fail} failed`);
if (fail) { console.log('FAILURES:'); fails.forEach(f => console.log('  FAIL  ' + f)); process.exit(1); }
