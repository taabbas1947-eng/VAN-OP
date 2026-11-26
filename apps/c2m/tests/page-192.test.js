// Costs cards with a link per blocker and their own Open button; the Guide's jobs as cards (D-192, 25 Nov 2026). Page checks in jsdom.
// Run: node apps/c2m/tests/page-192.test.js
const fs = require('fs'); const path = require('path'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const css = fs.readFileSync(path.join(__dirname, '..', 'c2m.css'), 'utf8');
const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); w.scrollTo = () => {}; } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
const main = () => doc.querySelector('main') || doc.getElementById('app');
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const card = k => main().querySelector(`.cb2 [data-cbox="${k}"]`);
setTimeout(() => {
  try {
    w.eval(fs.readFileSync(FIXTURE, 'utf8'));
    E("ST = window.__STF; ST.me.nav = ['approvals', 'clients', 'margin', 'costs', 'pricelists', 'products', 'reports']; ST.me.more = ['setup', 'guide']; _pi = null");
    /* invented blockers: 1 material with no cost, 1 pack with no packing bill, 1 change waiting for Monday */
    E("ST.rates = (ST.rates || []).concat([{ id: 9901, name: 'Zz test salt', gradeId: 9901, rate: null }]); { const p = ST.products.find(p => p.active !== false && p.packingMode !== 'bulk' && p.packingMode !== 'client' && (p.packs || []).length); p.packs[0].billId = null; window.__NB = p; } _pi = null");
    E("scr = 'costs'; cpart = null; renderPage()");
    const cards = [...main().querySelectorAll('.cb2 .cbox')];
    ok(cards.length === 6 && cards.every(c => c.tagName === 'DIV' && c.querySelector('h2.ct')), '6 cards, each a card with its heading, not 1 big button');
    ok(cards.every(c => { const b = c.querySelector('.cf .btn'); return b && b.textContent.trim() === 'Open' && b.dataset.cpart === c.dataset.cbox; }), 'each card has its own Open button for its part');
    ok(!main().querySelector('.cb2 .cbox button .cbox, .cb2 button.cbox'), 'no button inside a button');
    // materials: the link opens Material cost on the materials with no cost
    const mat = card('materials'), mg = mat.querySelector('.cgo.g-bad');
    ok(mg && /no cost/.test(mg.textContent) && mg.dataset.cfocus === 'norate' && /Opens Material cost/.test(mg.getAttribute('aria-label')), 'a red link names the blocker: ' + (mg && mg.textContent));
    ok(/s-bad/.test(mat.className) && /Problem/.test(mat.querySelector('.pill').textContent), 'a card with a problem is red, Problem');
    click(mg); ok(E('cpart') === 'materials' && E('matFilter') === 'norate' && E('cFocus') === 'norate', 'pressing it opens Material cost filtered to Waiting for a rate');
    ok(main().querySelector('[data-matf="norate"][aria-pressed="true"]'), 'the list shows Waiting for a rate pressed');
    E("cpart = null; cFocus = null; mtab = 'nutrients'; renderPage()"); click(card('materials').querySelector('.cgo')); ok(E('mtab') === 'materials' && E('mcOpen') === null, 'review M1: the link opens the materials list even if another tab was left open');
    E("cpart = null; cFocus = null; renderPage()"); click(card('materials').querySelector('.cf .btn')); ok(E('matFilter') === 'all' && E('cFocus') === null, 'review M2: Open shows the whole list after a link set the filter');
    E("cpart = null; cFocus = null; renderPage()");
    // packing: the link opens Packing cost with the packs that have no bill on top
    const pg = card('packing').querySelector('.cgo.g-bad'); ok(pg && /no packing bill/.test(pg.textContent) && pg.dataset.cfocus === 'nobill', 'packing names the packs with no bill');
    click(pg); ok(E('cpart') === 'packing' && main().querySelector('#cnb'), 'pressing it opens Packing cost with the list of those packs on top');
    const nb = main().querySelector('#cnb [data-openprod]'); ok(nb && +nb.dataset.openprod === E('window.__NB.id') && nb.dataset.ptab === 'cost', 'each pack there opens its product on Cost by pack');
    ok(E('navSnap().cFocus') === 'nobill' && E("navBase(navSnap()).includes('nobill')") !== false, 'review m5: Back keeps the focus');
    E("goPlace('margin')"); ok(E('cFocus') === null, 'review m5: going to another place clears it'); E("scr = 'costs'; cpart = 'packing'; cFocus = 'nobill'; renderPage()");
    click(main().querySelector('.crumb [data-cpart=""]')); ok(E('cpart') === null && E('cFocus') === null, 'back to Costs clears the focus');
    E("cpart = 'packing'; renderPage()"); ok(!main().querySelector('#cnb'), 'Packing cost opened from Open shows no extra list');
    E("cpart = null; renderPage()");
    // month end: progress and a link to the next step
    const mo = card('month'); ok(/\d of 5 steps done/.test(mo.querySelector('.cpt').textContent) && mo.querySelector('.cprog[role="img"] i'), 'month end shows its progress as a bar');
    const mn = mo.querySelector('.cgo'); ok(mn && mn.dataset.cfocus === 'mnext' && /id="me-now"/.test(E("(() => { cpart = 'month'; const h = vCosts(); cpart = null; return h; })()")), 'review m10: the next step of Month end has an anchor the link goes to'); ok(mn && /^Next: /.test(mn.textContent.trim()) && mn.dataset.cpart === 'month', 'and a link to its next step: ' + (mn && mn.textContent));
    // a change waiting for Monday has its own line
    E("ST.pending = [{ id: 1, status: 'waiting', kind: 'freight' }]; renderPage()");
    const fl = [...card('freight').querySelectorAll('.cgo')].map(x => x.textContent); ok(fl.some(t => /1 change waits for Monday/.test(t)), 'a change waiting for Monday is its own line: ' + fl.join(' | '));
    ok(fl.filter(t => /waits for Monday/.test(t)).length === 1, 'and is said once');
    E("ST.pending = []; renderPage()");
    // a card with nothing to settle
    E("ST.rates = ST.rates.filter(r => r.id !== 9901); renderPage()");
    const ok2 = cards.length && [...main().querySelectorAll('.cb2 .cbox.s-ok')];
    ok(ok2.every(c => !c.querySelector('.cgo') && /Nothing to do here/.test(c.textContent)), 'an up-to-date card has no link, and says so');
    ok(/\.cb2 \.cgo\.g-bad\{color:var\(--over\)\}/.test(css) && /@media \(max-width:760px\)\{\.cb2 \.cgo\{min-height:44px!important/.test(css), 'links in the state colour, 44 px on a phone');
    // Guide: own jobs as cards
    E("scr = 'guide'; renderPage()");
    const gl = main().querySelector('.gjl'), gc = gl ? [...gl.querySelectorAll('.gj')] : [];
    ok(gc.length > 3 && !gl.querySelector('.gjg'), 'the Guide shows cards, no place headings: ' + gc.length);
    ok(gc.every(c => c.querySelector('.gjn') && c.querySelector('.gjp') && /\d+ steps?/.test(c.querySelector('.gjx').textContent) && c.querySelector('.gjs[data-gstart]')), 'each card: the job, its place, its number of steps, Start');
    ok(gc.length === E('gjMine().length'), 'only the person\'s own jobs (D-160 kept)');
    ok(/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/.test(css.slice(css.indexOf('D-192'))), '3 cards a row on a desktop');
    const t0 = gc[0].querySelector('[data-gjtog]'); click(t0);
    const op = main().querySelector('.gj.open'); ok(op && op.querySelector('.gjb ol li') && /Hide the steps/.test(op.textContent) && /\.gjl \.gj\.open\{grid-column:1\/-1\}/.test(css), 'pressing a card opens its steps across the whole row');
    ok(/Press a card for its steps/.test(main().textContent), 'the answer line says cards');
    ok(![...main().querySelectorAll('.gjp')].some(p => /Other jobs/.test(p.textContent)), 'review m9: no card names Other jobs as its place');
    ok(!/whole box opens/.test(E('JSON.stringify(GUIDE_JOBS())')) && /line in colour/.test(E('JSON.stringify(GUIDE_JOBS())')), 'review M3: the Guide step describes the new cards');
    // the Find box still filters the cards
    if (main().querySelector('[data-lf="gjobs"]')) { const inp = main().querySelector('[data-lf="gjobs"]'); inp.value = 'zzzz no such job'; inp.dispatchEvent(new w.Event('input', { bubbles: true })); ok([...main().querySelectorAll('.gjl .gj')].every(c => c.classList.contains('lfh')), 'Find hides the cards that do not match'); }
    else ok(true, 'skipped: fewer than 7 jobs');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-192: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
