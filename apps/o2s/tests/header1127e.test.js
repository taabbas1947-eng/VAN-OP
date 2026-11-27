/* BUILD 2026-11-27e. Header, phase D (D-385). Tahir ruled on 27 Nov 2026 (design page "O2S header, phase D"):
   a Launcher button beside search (the word from 1,161 px, the icon below); on a phone the words are 1 row that
   slides sideways; a guard so the clock, search and Launcher never leave the screen; the brief's z-index 1000,
   fixed 56 px height, overflow removal and 24 px padding left out. Looks only: no job, rule, right or screen changes.
   Run: node header1127e.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

/* 1. The Launcher button: first in the right group, a plain link to the launcher, labelled for screen readers */
ok('Launcher link sits first in the right group, before the magnifier', /<div class="qs-right"><a class="qs-launch" href="\/" title="Back to the VAN launcher" aria-label="Back to the VAN launcher">[\s\S]*?<span class="ql">Launcher<\/span><\/a><a class="qs-find" href="#"/.test(html));
eq('exactly 1 Launcher button', (html.match(/class="qs-launch"/g) || []).length, 1);
ok('the O2S mark still goes to the launcher', /<a class="qs-mark" href="\/" title="Back to the VAN launcher">/.test(html));
ok('the magnifier stays beside the name', /aria-label="Search">[\s\S]*?<\/a><div id="qsMe"><\/div><div class="qs-clock" id="qsClock">/.test(html));
ok('the word shows from 1,161 px; the icon below', /\.qs-launch \.ql\{display:none\}\n@media \(min-width:1161px\)\{\.qs-launch \.ql\{display:inline\}\}/.test(html));

/* 2. The header stays as it was where the brief would have broken it */
ok('the header stays sticky at the top, z-index 30', /\.qs-top\{position:sticky;top:0;z-index:30;/.test(html));
ok('no z-index 1000 on the header', !/\.qs-top\{[^}]*z-index:1000/.test(html) && !/\.qs-top-in\{[^}]*z-index/.test(html));
ok('no fixed header height', !/\.qs-top(-in)?\{[^}]*[^-]height:\s*56px/.test(html));
ok('sheets, search and the COA view still sit above the header', /\.modal-bg\{[^}]*z-index:320/.test(html) && /\.cmdk\{[^}]*z-index:200/.test(html));
ok('from 1,300 px the header box is 1,280 px', /@media \(min-width:1300px\)\{\.qs-top-in\{max-width:1280px\}\}/.test(html));

/* 3. The guard */
ok('clock and magnifier never shrink; Launcher never shrinks', /\.qs-find,\.qs-clock\{flex-shrink:0\}/.test(html) && /\.qs-launch\{[^}]*flex-shrink:0\}/.test(html));
ok('name and title shorten with ... at 140 px', /\.qs-me \.nm,\.qs-me \.tt\{max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap\}/.test(html));
ok('from 900 to 1,060 px they shorten at 100 px', /@media \(min-width:900px\) and \(max-width:1060px\)\{\.qs-me \.nm,\.qs-me \.tt\{max-width:100px\}\}/.test(html));
ok('the Today count uses even-width figures', /\.qs-nav a \.k\{font-variant-numeric:tabular-nums\}/.test(html));
ok('the guard block comes after the older header rules, so it wins', html.indexOf('.qs-launch{display:inline-flex') > html.indexOf('@media (min-width:900px) and (max-width:1060px){.qs-nav a{padding:4px 6px'));

/* 4. Phone: 1 row that slides */
ok('under 900 px the words are 1 row that slides, with no scrollbar', /@media \(max-width:899\.98px\)\{\.qs-nav\{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;/.test(html) && /\.qs-nav::-webkit-scrollbar\{display:none\}/.test(html));
ok('a fade shows there are more words', /\.qs-nav\.more\{-webkit-mask-image:linear-gradient/.test(html));
ok('under 600 px the name shows as initials; the menu stays', /@media \(max-width:599\.98px\)\{\.qs-me summary>span:not\(\.av\)\{display:none\}/.test(html));
ok('renderTopNav calls qsNavFit after drawing the words', /el\.innerHTML=html; qsNavFit\(el\);/.test(grab('renderTopNav')));

/* 5. qsNavFit, run in a sandbox. Positions are measured from the nav itself (independent review, 27 Nov):
   the current word is brought into view from either side, also when it sits under the 32 px fade, and again on resize. */
function navBox(w, onX, sw, cw, startScroll) {
  const c = { console, Math };
  vm.createContext(c);
  vm.runInContext(grab('qsNavFit'), c);
  const cls = new Set(); let listeners = 0; let resize = null;
  const navLeft = 12;
  const el = { scrollLeft: startScroll || 0, scrollWidth: sw, clientWidth: cw,
    getBoundingClientRect: () => ({ left: navLeft }),
    classList: { toggle: (k, v) => { if (v) cls.add(k); else cls.delete(k); } },
    addEventListener: () => { listeners++; } };
  const on = onX == null ? null : { offsetWidth: 90, getBoundingClientRect: () => ({ left: navLeft + onX - el.scrollLeft }) };
  el.querySelector = () => on;
  c.window = { innerWidth: w, addEventListener: (t, f) => { listeners++; if (t === 'resize') resize = f; } };
  c.qsNavFit(el);
  return { el, cls, get listeners() { return listeners; }, c, resize };
}
let r = navBox(375, 480, 583, 351);
eq('phone: the current word off to the right is scrolled into view', r.el.scrollLeft, 468);
r = navBox(375, 12, 583, 351, 232);
eq('phone: scrolled to the end, then back on Today: the row comes back to Today', r.el.scrollLeft, 0);
r = navBox(375, 12, 583, 351);
eq('phone: Today, already in view, does not scroll', r.el.scrollLeft, 0);
ok('phone: the fade shows while words are off to the right', r.cls.has('more'));
r = navBox(375, 240, 583, 351);
eq('phone: a word under the fade is brought clear of it', r.el.scrollLeft, 228);
r = navBox(1280, 900, 591, 591);
ok('laptop: no scroll and no fade', r.el.scrollLeft === 0 && !r.cls.has('more'));
r = navBox(375, null, 583, 351);
ok('no current word: nothing breaks', r.el.scrollLeft === 0);
{ const x = navBox(375, 12, 583, 351); x.c.qsNavFit(x.el); eq('listeners are added once, not on every redraw', x.listeners, 2);
  ok('a resize brings the current word into view again', typeof x.resize === 'function');
  x.c.window.innerWidth = 375; x.el.scrollLeft = 232; x.resize(); eq('...and it does', x.el.scrollLeft, 0); }

/* 5b. Independent review fixes */
ok('the name and title are blocks by CSS, before the rule that hides the title from 900 to 1,299 px', /\.qs-me \.nm\{display:block;/.test(html) && /\.qs-me \.tt\{display:block;/.test(html) && html.indexOf('.qs-me .tt{display:block;') < html.indexOf('@media (min-width:900px) and (max-width:1299px){.qs-me .tt{display:none}}'));
ok('no inline display:block on the name or title, so that rule works', !/class="nm" style="display:block"/.test(html) && !/class="tt" style="display:block"/.test(html));
ok('the name button carries the name and title for screen readers', /<summary title="'\+qsEsc\(nm\)\+' \\u00b7 '\+qsEsc\(tt\)\+'" aria-label="'\+qsEsc\(nm\)\+', '\+qsEsc\(tt\)\+'">/.test(grab('renderTopNav')));
ok('from 1,300 px the words take 6 px side padding', /@media \(min-width:1300px\)\{\.qs-nav a\{padding:4px 6px\}\}/.test(html));
ok('a printed report has no header', /@media print\{\.qs-top\{display:none!important\}\}/.test(html));

/* 6. Nothing else changed in the header logic */
const rtn = grab('renderTopNav');
ok('every role check in the header is unchanged', /canView\(state\.role,id\)/.test(rtn) && /if\(id==='dash'&&!howMay\(\)\) return;/.test(rtn) && /if\(id==='morning'&&!mvMay\(\)\) return;/.test(rtn) && /onclick="setScreen\(\\''\+id\+'\\'\)"/.test(rtn));

/* 7. Guide, build, changelog, documentation */
ok('the Guide says where the Launcher button is and how the phone row works', /<h2>The header<\/h2><div class="gd-intro">The <b>Launcher<\/b> button, beside the magnifier/.test(grab('guideHow')));
ok('BUILD_ID 2026-11-27e or later', /var BUILD_ID='2026-(11-(27[e-z]|2[89][a-z]|30[a-z])|12-\d\d[a-z])';/.test(html));
ok('changelog has 2026-11-27e', /ver:'2026-11-27e'/.test(html));
ok('system documentation carries D-385', /"id":"D-385"/.test(html));

report('header1127e');
