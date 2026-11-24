// Design system of 24 Nov 2026 (D-185): Inter, 1 colour set, the 4 looks gone. Page checks in jsdom.
// Run: node apps/c2m/tests/page-ds.test.js
const fs = require('fs'); const path = require('path'); const { JSDOM, html: PAGE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const D = path.join(__dirname, '..'); const css = fs.readFileSync(path.join(D, 'c2m.css'), 'utf8'), js = fs.readFileSync(path.join(D, 'c2m.js'), 'utf8'), shell = fs.readFileSync(path.join(D, 'c2m.html'), 'utf8');
const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.localStorage.setItem('c2m.skin', 'dusk'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } });
const w = dom.window;
setTimeout(() => {
  try {
    ok(/family=Inter:wght@400;500;600;700/.test(shell) && !/IBM\+Plex/.test(shell), 'the page loads Inter and no longer IBM Plex');
    ok(/--sans:"Inter"/.test(css) && /--mono:"Inter"/.test(css) && !/IBM Plex/.test(css), 'text and figures are set in Inter');
    ok(/body\{font-variant-numeric:tabular-nums/.test(css), 'figures line up everywhere (tabular numbers on the page)');
    const root = (css.match(/:root\{--bg:[^}]*\}/) || [''])[0];
    for (const [k, v] of [['--bg', '#F8FAFC'], ['--surface', '#FFFFFF'], ['--ink', '#0F172A'], ['--muted', '#475569'], ['--line', '#E2E8F0'], ['--blue', '#2563EB'], ['--over', '#B91C1C'], ['--overbg', '#FEF2F2'], ['--late', '#B45309'], ['--latebg', '#FFFBEB'], ['--ok', '#047857'], ['--okbg', '#ECFDF5'], ['--soft', '#F1F5F9']]) ok(root.includes(k + ':' + v), 'colour ' + k + ' is ' + v);
    ok(!/data-skin/.test(css) && !/\.skins|\.skinrow/.test(css), 'no rule of the 4 looks is left in the styles');
    ok(!/SKINS|applySkin|skinRow|data-skin=|skin(?!')/.test(js.replace(/dataset\.skin|c2m\.skin/g, '')), 'no code of the 4 looks is left in the page');
    ok(!/border-color:var\(--line2\)!important/.test(css), 'no older rule forces an outline back on the cards (review M1)');
    ok(/\.btn\.armed,\.btn\.armed:hover:not\(:disabled\)[^{]*\{background:var\(--ok\)!important;color:#fff!important\}/.test(css), 'an armed 2-tap button stays green under the pointer (review M2)');
    ok(/\.wl2 \.wltag\.t-warn\{background:var\(--latebg\);color:var\(--late\)\}/.test(css), 'White Label tags take the new colours (review m3)');
    ok(w.document.documentElement.dataset.skin === undefined && w.localStorage.getItem('c2m.skin') === null, 'an old look kept in the browser is cleared');
    ok(/\.pill,\.stuckp\{[^}]*border:0;border-radius:9999px/.test(css), 'tags are round with no border');
    ok(/\.btn\.ghost\{background:var\(--soft\);color:var\(--ink\)/.test(css) && /\.btn\{background:var\(--blue\);color:#fff/.test(css), 'buttons: filled blue, and soft grey for the rest');
    ok(/box-shadow:var\(--sh\)/.test(css) && /--sh:0 1px 3px rgba\(15,23,42,\.06\),0 1px 2px rgba\(15,23,42,\.04\)/.test(css), 'cards carry the soft shadow');
    ok(/ver: '2026-11-24b'/.test(js), "What's changed entry 2026-11-24b");
  } catch (e) { fail++; console.log('ERROR ' + e.message); }
  console.log(`page-ds: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 50);
