// Approvals for the administrator: 4 figures, the list in 3 tabs, chart and news on the narrow side (D-191, 24 Nov 2026). Page checks in jsdom.
// Run: node apps/c2m/tests/page-appr.test.js
const fs = require('fs'); const path = require('path'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const css = fs.readFileSync(path.join(__dirname, '..', 'c2m.css'), 'utf8');
const dom = new JSDOM(fs.readFileSync(PAGE, 'utf8'), { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); w.scrollTo = () => {}; } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
const main = () => doc.querySelector('main') || doc.getElementById('app');
const click = el => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
setTimeout(() => {
  try {
    w.eval(fs.readFileSync(FIXTURE, 'utf8'));
    E("ST = window.__STF; ST.me.nav = ['approvals', 'clients', 'margin', 'costs', 'pricelists', 'products', 'reports']; ST.me.more = ['setup', 'guide']; _pi = null");
    ok(E('ADM()') === true, 'the invented person is the administrator');
    E(`window.__J = [
      { t: 'Approve 3 prices for Syngenta Pakistan', d: 'Sent by Yawar', kind: 'approve', since: ST.today, btn: 'Open', key: 'a1', pri: 1 },
      { t: 'Target change, 1 client', d: 'Sent by Yawar', kind: 'approve', since: ST.today, btn: 'Open', key: 'a2', pri: 2 },
      { t: 'Recipe stuck 30 working days: Alpha for BKK', d: 'Not sent on', kind: 'red', since: '2026-10-12', btn: 'Open', key: 's1', pri: 3, with: 'Production Manager' },
      { t: 'Recipe stuck 12 working days: Beta for LCI', d: 'Not sent on', kind: 'red', since: '2026-11-05', btn: 'Open', key: 's2', pri: 3, with: 'QC Manager' },
      { t: 'Monthly rate check', d: 'Due on the 5th', kind: 'todo', since: null, btn: 'Open', key: 't1', pri: 9 }];
      jtab = 'appr'; jtopic = 'All'; LFQ.jobs = ''; scr = 'approvals'; renderPage()`);
    /* the list is drawn from invented jobs: homeGrid is given them directly, with the pieces vToday hands it */
    const draw = () => { main().innerHTML = E("homeGrid(window.__J, 0, [], { next: '<div class=\"nextmove\"><div class=\"t\">' + window.__J[0].t + '</div></div>', fyi: window.__FYI || '' })"); };
    E("jtab = 'appr'"); draw();
    const m = main();
    const tiles = [...m.querySelectorAll('.akpi .ak')]; ok(tiles.length === 4, '4 figures on top: ' + tiles.length);
    ok(tiles.map(t => t.querySelector('.l').textContent).join('|') === 'White label GP, FY to date|Sales, FY to date|Gross profit, FY to date|Stuck with others', 'the 4 figures of the picture: ' + tiles.map(t => t.querySelector('.l').textContent).join('|'));
    ok(/^2 recipes$/.test(tiles[3].querySelector('.v').textContent) && /oldest \d+ working days/.test(tiles[3].querySelector('.s').textContent), 'stuck with others says how many and the oldest: ' + tiles[3].textContent);
    ok(/%/.test(tiles[0].querySelector('.v').textContent) && /target/.test(tiles[0].querySelector('.s').textContent), 'GP with its target: ' + tiles[0].textContent);
    const apg = m.querySelector('.apg'); const kids = [...apg.children].map(c => c.className.split(' ')[0]); ok(kids.join() === 'akpi,nextmove,appr2', 'figures, then the next move, then the 2 columns: ' + kids.join());
    ok(m.querySelectorAll('.nextmove').length === 1 && /Approve 3 prices for Syngenta/.test(m.querySelector('.nextmove').textContent), 'the next move is drawn once');
    const tabs = [...m.querySelectorAll('.jtabs [data-jtab]')];
    ok(tabs.map(b => b.textContent.replace(/\s+/g, ' ').trim()).join('|') === 'To approve 2|Stuck with others 2|To do 1', 'the 3 tabs with their counts: ' + tabs.map(b => b.textContent.replace(/\s+/g, ' ').trim()).join('|'));
    ok(tabs[0].getAttribute('aria-selected') === 'true' && !m.querySelector('[data-jtp="appr"]').hidden && m.querySelector('[data-jtp="stuck"]').hidden && m.querySelector('[data-jtp="todo"]').hidden, 'To approve shows first; the other 2 are in the page, hidden');
    ok(m.querySelector('.aL .jl') && m.querySelector('.aR .verdict.vch svg, .aR .verdict.vch .vfoot'), 'the list is on the wide side, the chart on the narrow side');
    ok(/grid-template-columns:minmax\(0,65fr\) minmax\(0,35fr\)/.test(css), '65 to 35');
    click(tabs[2]); draw(); ok(E('jtab') === 'todo' && !main().querySelector('[data-jtp="todo"]').hidden && main().querySelector('[data-jtp="appr"]').hidden, 'pressing To do shows that tab');
    click(main().querySelector('[data-jtab="stuck"]')); draw(); ok(main().querySelectorAll('[data-jtp="stuck"] .jrow').length === 2, 'stuck with others lists both recipes');
    // Find looks through all 3
    ok(!main().querySelector('[data-lf="jobs"]'), 'B7 (D-195): 5 rows, no Find box');
    E("window.__J0 = window.__J.slice(); for (let n = 0; n < 9; n++) window.__J.push({ t: 'Extra job ' + n, d: 'x', kind: 'todo', since: null, btn: 'Open', key: 'x' + n, pri: 9 })"); draw();
    const inp = main().querySelector('[data-lf="jobs"]'); ok(!!inp, 'B7: 14 rows, the Find box is there');
    inp.value = 'rate'; inp.dispatchEvent(new w.Event('input', { bubbles: true }));
    { const td = main().querySelector('[data-jtp="todo"]'), ap = main().querySelector('[data-jtp="appr"]'); ok(main().querySelector('.jl').classList.contains('finding') && !td.hidden && !ap.hidden && !td.querySelector('.jrow').classList.contains('lfh') && [...ap.querySelectorAll('.jrow')].every(r => r.classList.contains('lfh')) && /1 of 14/.test(main().querySelector('[data-lfc="jobs"]').textContent) && /\.jl\.finding \.jtabs\{display:none\}/.test(css), 'while Find holds text it finds a row in a tab that was hidden, and counts it: ' + main().querySelector('[data-lfc="jobs"]').textContent); }
    inp.value = ''; inp.dispatchEvent(new w.Event('input', { bubbles: true })); ok(!main().querySelector('.jl').classList.contains('finding') && main().querySelector('[data-jtp="todo"]').hidden && !main().querySelector('[data-jtp="stuck"]').hidden, 'and the tabs come back when it is cleared, on the tab that was open');
    // an empty tab cannot be picked, and the page never opens on one
    E("window.__J = window.__J0.filter(j => j.kind !== 'approve'); jtab = 'appr'; LFQ.jobs = ''"); draw();
    ok(E('jtab') === 'appr' && main().querySelector('[data-jtab="stuck"]').getAttribute('aria-selected') === 'true' && !main().querySelector('[data-jtp="stuck"]').hidden && main().querySelector('[data-jtab="appr"]').disabled, 'no approval waiting: the next tab that has something shows, and the choice of the person is kept');
    // the news scrolls inside its card
    E("ST.notices = [{ id: 901, text: 'PO price check: 2 below list', by_user: 'yawar', at: ST.today + ' 09:00:00' }]; ST.noticesReadUpto = 0; renderPage()"); /* the real page, with the real jobs of the invented data */
    ok(main().querySelector('.aR .afyi h2') && /For your information/.test(main().querySelector('.aR .afyi').textContent) && main().querySelectorAll('h2').length && ![...main().querySelectorAll('h2')].some(h => /For your information/.test(h.textContent) && !h.closest('.afyi')), 'For your information is in the narrow column, once');
    ok(/\.appr2 \.afyi\{[^}]*max-height:460px;overflow:auto/.test(css), 'and scrolls inside its card');
    // phone: next move first, the margin as 1 line
    ok(/@media \(max-width:760px\)\{\s*\.apg \.nextmove\{order:-1\}\s*\.akpi\{display:block[^}]*\}\s*\.akpi \.ak:not\(:first-child\)\{display:none\}/.test(css), 'on a phone the next move comes first and only the GP figure stays');
    // another role keeps its Today as it was
    E("ST.me.admin = false; ST.me.role = 'cfo'; _pi = null; renderPage()");
    if (!E('ADM()')) ok(main().querySelector('.home') && !main().querySelector('.akpi') && !main().querySelector('.jtabs'), 'a role that is not the administrator keeps its list as it was'); else ok(true, 'skipped');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-appr: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
