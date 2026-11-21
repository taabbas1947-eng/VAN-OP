// Push 10g page checks in jsdom. Run: node apps/c2m/tests/page-10g.test.js (or give a page file as the first argument)
const fs = require('fs'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(process.argv[2] || PAGE, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document; const tick = (ms = 20) => new Promise(r => setTimeout(r, ms));
setTimeout(async () => {
  try {
    w.eval(fs.readFileSync(FIXTURE, 'utf8'));
    w.__calls = 0; E("api = () => { window.__calls++; return Promise.resolve(JSON.parse(JSON.stringify(window.__STF))); }");
    E("localStorage.setItem('c2m_changelog_seen_tahir', CHANGELOG[CHANGELOG.length - 1].ver)"); await E("load()"); const c0 = w.__calls; ok(!doc.querySelector('.wn'), 'no What is new box in the way'); ok(E('loadedAt') > 0, 'load stamps the time');
    E("scr = 'approvals'; render()"); ok(/Updated \d\d:\d\d/.test(doc.querySelector('main .phd').textContent), 'Approvals says when it was updated: ' + doc.querySelector('main .phd').textContent.replace(/\s+/g, ' ').slice(0, 120));
    // shown again after more than 60 s: reads again
    E('loadedAt = Date.now() - 61000'); Object.defineProperty(doc, 'visibilityState', { configurable: true, get: () => 'visible' }); doc.dispatchEvent(new w.Event('visibilitychange')); await tick();
    ok(w.__calls === c0 + 1, 'C-04 shown again after 61 s reads again');
    doc.dispatchEvent(new w.Event('visibilitychange')); await tick(); ok(w.__calls === c0 + 1, 'C-04 shown again within 60 s does not');
    // busy: a panel open, or typing: no read
    E("loadedAt = Date.now() - 61000; pan = { k: 'tochange', only: 'price' }"); doc.dispatchEvent(new w.Event('visibilitychange')); await tick(); ok(w.__calls === c0 + 1, 'C-04 not while a panel is open'); E('pan = null; render()');
    const inp = doc.createElement('input'); doc.querySelector('main').appendChild(inp); inp.focus(); doc.dispatchEvent(new w.Event('visibilitychange')); await tick(); ok(w.__calls === c0 + 1, 'C-04 not while typing'); inp.remove(); E('render()');
    E('actBusy = true'); doc.dispatchEvent(new w.Event('visibilitychange')); await tick(); ok(w.__calls === c0 + 1, 'C-04 not while a save runs'); E('actBusy = false');
    // a new day in Pakistan reads again at once
    E("ST.today = '2026-11-19'; loadedAt = Date.now(); dayTry = null"); ok(E('pkToday()') !== '2026-11-19', 'pk date differs'); doc.dispatchEvent(new w.Event('visibilitychange')); await tick(); ok(w.__calls === c0 + 2, 'C-04 a new day reads again at once');
    ok(E('busyNow()') === false, 'not busy when idle');
    // review fixes (push 10g)
    w.Element.prototype.checkVisibility = () => true; // jsdom does no layout
    const vis = async () => { doc.dispatchEvent(new w.Event('visibilitychange')); await tick(); };
    E("dayTry = pkToday(); ST.today = pkToday()"); let c1 = w.__calls;
    // M-1: typed, not saved, clicked away: no read
    { const t = doc.createElement('input'); t.id = 'tx1'; doc.querySelector('main').appendChild(t); t.focus(); t.value = '30'; t.dispatchEvent(new w.Event('input', { bubbles: true })); t.blur(); E('loadedAt = Date.now() - 61000'); await vis();
      ok(w.__calls === c1, 'M-1 typed text not saved holds the refresh'); ok(t.isConnected && t.value === '30', 'M-1 the typed text stays'); t.remove(); E('NAVTYPED.clear()'); }
    { const d = doc.createElement('input'); d.type = 'date'; d.setAttribute('value', '2026-11-20'); doc.querySelector('main').appendChild(d); d.value = '2026-11-25'; await vis(); ok(w.__calls === c1, 'M-1 a changed date holds the refresh'); d.remove(); }
    // m-3: an armed 2-step button holds it
    { const b = doc.createElement('button'); b.className = 'btn armed'; doc.querySelector('main').appendChild(b); await vis(); ok(w.__calls === c1, 'm-3 an armed button holds the refresh'); b.remove(); }
    // m-4: the Saved box holds it for 10 minutes, then it is cleared and the refresh runs
    E("saved = { t: 'Saved.', re: 0, at: Date.now() }"); await vis(); ok(w.__calls === c1, 'm-4 a fresh Saved box holds the refresh');
    E("saved = { t: 'Saved.', re: 0, at: Date.now() - 601000 }"); await vis(); ok(w.__calls === c1 + 1 && E('saved') === null, 'm-4 a Saved box older than 10 minutes is cleared and the refresh runs'); c1 = w.__calls;
    // B-1: a refresh on its way is dropped when the person starts typing meanwhile
    { let rel; E("api = () => { window.__calls++; return new Promise(r => { window.__rel = () => r(JSON.parse(JSON.stringify(window.__STF))); }); }"); const st0 = E('ST'); E('loadedAt = Date.now() - 61000'); doc.dispatchEvent(new w.Event('visibilitychange')); await tick();
      ok(w.__calls === c1 + 1, 'B-1 the refresh started'); const t = doc.createElement('input'); t.id = 'tx2'; doc.querySelector('main').appendChild(t); t.focus(); t.value = '30'; w.__rel(); await tick(50);
      ok(E('ST') === st0 && t.isConnected && t.value === '30' && doc.activeElement === t, 'B-1 the answer is dropped, the typed text and focus stay'); ok(E('Date.now() - loadedAt') > 60000, 'B-1 loadedAt stays old so the next tick tries again'); t.remove();
      E("api = () => { window.__calls++; return Promise.resolve(JSON.parse(JSON.stringify(window.__STF))); }"); c1 = w.__calls; }
    // m-8: text typed in a box that is no longer on the screen does not hold the refresh
    E("NAVTYPED.add('gone-box')"); ok(E('busyNow()') === false, 'm-8 a box typed in and left does not hold the refresh'); E('NAVTYPED.clear()');
    // m-9: a refresh does not cancel a load the person asked for
    { const R = []; E("api = () => { window.__calls++; return new Promise(r => window.__R.push(r)); }"); w.__R = R; const pU = E('load()'); const pS = E('load(true)'); await tick();
      R[0](Object.assign(JSON.parse(JSON.stringify(w.__STF)), { mark: 'mine' })); await pU; R[1](Object.assign(JSON.parse(JSON.stringify(w.__STF)), { mark: 'timer' })); await pS;
      ok(E('ST.mark') === 'mine' || E('ST.mark') === 'timer', 'm-9 the person\'s load lands (not dropped): ' + E('ST.mark'));
      const R2 = []; w.__R = R2; const q1 = E('load()'); const q2 = E('load(true)'); await tick(); R2[1](Object.assign(JSON.parse(JSON.stringify(w.__STF)), { mark: 'timer2' })); await q2; R2[0](Object.assign(JSON.parse(JSON.stringify(w.__STF)), { mark: 'mine2' })); await q1;
      ok(E('ST.mark') === 'mine2', 'm-9 the person\'s load still lands after a refresh answered first: ' + E('ST.mark'));
      E("api = () => { window.__calls++; return Promise.resolve(JSON.parse(JSON.stringify(window.__STF))); }"); c1 = w.__calls; }
    // m-2: a wrong clock tries the new day once, not every time
    E("ST.today = '2026-11-01'; dayTry = null; loadedAt = Date.now()"); await vis(); ok(w.__calls === c1 + 1, 'm-2 a new day reads once'); E("ST.today = '2026-11-01'; loadedAt = Date.now()"); await vis(); ok(w.__calls === c1 + 1, 'm-2 not again for the same device date');
    // m-2: Updated uses the server's clock, in Pakistan time
    E("ST.builtAt = Date.UTC(2026, 10, 20, 10, 5); scr = 'approvals'; render()"); ok(/Updated 15:05/.test(doc.querySelector('main .phd').textContent), 'm-2 Updated 15:05 from the server time 10:05 UTC');
    ok(E("CHANGELOG.some(c => c.ver === '2026-11-20g')"), 'change list 2026-11-20g');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-10g: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
