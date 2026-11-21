// Push 10l page checks in jsdom (audit C-23): a redraw writes only the parts that changed. Run: node apps/c2m/tests/page-10l.test.js (or give a page file as the first argument)
const fs = require('fs'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(process.argv[2] || PAGE, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document; const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));
setTimeout(async () => {
  try {
    w.eval(fs.readFileSync(FIXTURE, 'utf8'));
    E("api = () => Promise.resolve(JSON.parse(JSON.stringify(window.__STF)))");
    E("localStorage.setItem('c2m_changelog_seen_tahir', CHANGELOG[CHANGELOG.length - 1].ver)"); await E('load()');
    const M = () => doc.querySelector('#app > .shell > main'), H = () => doc.querySelector('#app > aside.hdr');
    const firstKid = () => M().firstElementChild;
    E("scr = 'costs'; cpart = null; render()"); await tick();
    // 1. nothing changed: main and the side bar are not written again
    let k0 = firstKid(), h0 = H(); E('render()'); await tick();
    ok(firstKid() === k0 && H() === h0, 'a redraw with nothing changed leaves main and the side bar as they were');
    // 2. a refresh with the same data: not written again either
    await E('load()'); await tick(); ok(firstKid() === k0, 'a refresh with the same data leaves main as it was');
    // 3. a change in state that shows in main: written again
    E("cpart = 'materials'; render()"); await tick(); ok(firstKid() !== k0 && /Material/i.test(M().textContent), 'a change of place writes main again');
    // 4. typed text not saved: written again, so the box shows what the state says (as a full redraw would)
    E("scr = 'costs'; cpart = null; render()"); await tick(); k0 = firstKid();
    const inp = doc.createElement('input'); inp.id = 'tx10l'; inp.setAttribute('value', ''); M().appendChild(inp); E('paintSettled()'); inp.value = 'typed';
    E('render()'); await tick(); ok(!doc.getElementById('tx10l'), 'a box with typed text makes main be written again');
    // 5. something else changed main (code, a sort, a filter): written again
    k0 = firstKid(); k0.setAttribute('data-touched', '1'); await tick(); E('render()'); await tick(); ok(firstKid() !== k0 && !M().querySelector('[data-touched]'), 'main changed by code is written again');
    // 6. an armed 2-step button: written again (a full redraw disarms it)
    k0 = firstKid(); const b = doc.createElement('button'); b.className = 'btn armed'; M().appendChild(b); E('paintSettled()'); E('render()'); await tick(); ok(!M().querySelector('.btn.armed'), 'an armed button makes main be written again');
    // 7. a panel opens: the panel is drawn and main is made inert; closing it takes the panel away
    E("pan = { k: 'tochange', only: 'price' }; render()"); await tick(); ok(!!doc.querySelector('#app > aside.panel') && M().hasAttribute('inert') && M().getAttribute('aria-hidden') === 'true', 'a panel is drawn and main is inert behind it');
    E('pan = null; render()'); await tick(); ok(!doc.querySelector('#app > aside.panel') && !M().hasAttribute('inert') && !M().hasAttribute('aria-hidden'), 'closing it takes the panel away and main is live again');
    // 8. the side bar: a new skin writes the side bar, not main
    k0 = firstKid(); h0 = H(); E("skin = skin === 'silver' ? 'slate' : 'silver'; render()"); await tick(); ok(H() !== h0 && firstKid() === k0, 'a change only in the side bar writes only the side bar');
    // 9. the same HTML as a full redraw: what shows equals a page written from nothing
    const keep = M().innerHTML; E('PAINT.app = null; render()'); await tick(); ok(M().innerHTML === keep, 'what shows equals a full redraw');
    // 10. More and Find open and close
    E("moreOpen = true; render()"); await tick(); ok(!!doc.querySelector('#app .sheet'), 'More opens'); E("moreOpen = false; render()"); await tick(); ok(!doc.querySelector('#app .sheet'), 'More closes');
    E("finder = { q: '', i: 0 }; render()"); await tick(); ok(!!doc.getElementById('fq'), 'Find opens'); E("finder = null; render()"); await tick(); ok(!doc.getElementById('fq'), 'Find closes');
    // 12. a fold the person opens stays open through quiet redraws and then a redraw that writes main (review 10l B-1)
    { let found = null; for (const k of E('ST.me.nav.concat(ST.me.more || [])')) { E(`scr = '${k}'; cpart = null; render()`); const d = [...doc.querySelectorAll('#app main details')].find(x => E('foldKey')(x) && !x.open); if (d) { found = d; break; } }
      ok(!!found, 'a screen with a closed fold found');
      if (found) { const key = E('foldKey')(found); found.querySelector(':scope > summary').click(); if (!found.open) found.open = true; await tick(30);
        const q = () => { const d = [...doc.querySelectorAll('#app main details')].find(x => E('foldKey')(x) === key); return d ? d.open : 'gone'; };
        E('render()'); E('render()'); const quiet = q(); E('PAINT.dirty.main = true; render()'); ok(quiet === true && q() === true, 'an opened fold stays open through quiet redraws and a redraw that writes main: ' + quiet + ' / ' + q()); } }
    // 13. a sorted table: equal values keep the page order, as a full redraw; a quiet redraw does not move rows (review 10l m-1)
    E(`window.vMargin2 = () => '<h1 class="phd">T</h1><div class="wrapx"><table id="tt"><thead><tr><th>Name</th><th>Zone</th><th>Qty</th></tr></thead><tbody>' + [['Delta','North',5],['Alpha','South',5],['Charlie','North',7],['Bravo','South',7],['Echo','North',5],['Foxtrot','South',9]].map(r => '<tr><td>'+r[0]+'</td><td>'+r[1]+'</td><td>'+r[2]+'</td></tr>').join('') + '</tbody></table></div>'; scr = 'margin'; for (const k in SORTS) delete SORTS[k]; render()`);
    const order = () => [...doc.querySelectorAll('#tt tbody tr')].map(r => r.cells[0].textContent).join(',');
    const th = i => doc.querySelectorAll('#tt th')[i]; ok(!!(th(0) && th(0).classList.contains('srt')), 'the test table sorts');
    th(0).click(); await tick(); th(0).click(); await tick(); th(2).click(); await tick(); const a1 = order(); E('PAINT.app = null; render()'); ok(order() === a1, 'equal values keep the page order, as a full redraw: ' + a1 + ' / ' + order());
    { let moved = 0; const mo = new w.MutationObserver(r => { moved += r.length; }); mo.observe(doc.querySelector('#tt tbody'), { childList: true }); E('render()'); await tick(); mo.disconnect(); ok(moved === 0 && doc.querySelector('#tt'), 'a quiet redraw does not move the rows of a sorted table: ' + moved); }
    // 14. a choice box with no option marked selected is not "typed" (review 10l m-2)
    E("scr = 'costs'; cpart = null; render()"); { const sel = doc.createElement('select'); sel.id = 'sel10l'; sel.innerHTML = '<option value="a">A</option><option value="b">B</option>'; M().appendChild(sel); E('paintSettled()'); E('render()'); await tick(); ok(!!doc.getElementById('sel10l'), 'a choice box showing its first option does not make main be written again'); }
    // 11. the time of the build comes from the server's header, not the answer
    E("api = () => Promise.resolve(Object.defineProperty(JSON.parse(JSON.stringify(window.__STF)), '_built', { value: Date.UTC(2026, 10, 21, 5, 0) }))"); await E('load()');
    ok(E('ST.builtAt') === Date.UTC(2026, 10, 21, 5, 0), 'ST.builtAt from the X-C2M-Built header');
    ok(E("CHANGELOG.some(c => c.ver === '2026-11-21c')"), 'change list 2026-11-21c');
  } catch (e) { fail++; console.log('ERROR', e.stack); }
  console.log(`page-10l: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
