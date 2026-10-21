/* 21a (Tahir, 21 Oct 2026): Zain Ghaffar issued gate pass GP-0180 on DC 5255 several times; each
   time the screen said it was issued, and a refresh brought the button back. The live action log
   showed 1 line only (21:53:51): the earlier tries never reached the server. Each save sends the
   whole O2S data (2.7 MB; 9.3 seconds on a good line, measured on the live server that night), and a
   dropped connection or a 500/502/503 answer was caught and ignored.

   This runs the REAL save code (save, saveNow and the 21a helpers, pulled out of o2s.html) against a
   fake server that fails on purpose, and checks that a change is always either saved or shown as not
   saved and tried again, never dropped in silence.
   Run: node savestate21a.test.js */
const vm = require('vm');
const H = require('./harness.js');
let pass = 0, fail = 0; const fails = [];
const ok = (n, c, x) => c ? pass++ : (fail++, fails.push(n + (x ? '  [' + x + ']' : '')));
const eq = (n, g, w) => ok(n, JSON.stringify(g) === JSON.stringify(w), 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w));
const html = H.html;

const FNS = ['save', 'saveNow', 'saveRetryMs', 'saveStateEl', 'saveStateShow', 'saveStateHide', 'saveStateBusy', 'saveStateDone', 'saveStateReset', 'saveFailed', 'saveTryNow', 'saveUnsaved'];
const SRC = FNS.map(n => H.grab(n)).join('\n');
const varLine = (n) => { const m = new RegExp('\\nvar ' + n + '=[^\\n]*;').exec(html); if (!m) throw new Error('no var ' + n); return m[0].trim(); };

/* a sandbox with a fake clock, a fake DOM element for the chip, and a scripted server */
function box(script, opt) {
  opt = opt || {};
  let now = 0; const timers = [];
  const el = { className: '', innerHTML: '', setAttribute() {} };
  const s = {
    console: { log: console.log, error: () => {} }, JSON, Math: Object.assign(Object.create(Math), { random: () => 0.5 }), Object, String, Array, Promise,   /* random 0.5 = no jitter, so the waits read 3, 6, 12 s */
    toasts: [], sent: [], calls: 0, script: script.slice(),
    navigator: { onLine: opt.offline ? false : true },
    document: { getElementById: (id) => (id === 'saveState' && s._made ? el : null), body: { appendChild: () => { s._made = true; } }, createElement: () => el, activeElement: null },
    el,
    setTimeout: (f, ms) => { const id = timers.length + 1; timers.push({ id, at: now + ms, f, done: false }); return id; },
    clearTimeout: (id) => { const t = timers.find(x => x.id === id); if (t) t.done = true; },
    toast: (m) => s.toasts.push(m), $: () => null, authed: () => true, render: () => {}, renderApp: () => {}, setSession: () => { s._token = ''; },
    authHdr: () => ({}), dataOnly: (x) => ({ orders: x.orders || [], shipments: x.shipments || [] }), ensureState: (x) => x, merge3: (b, l, srv) => l,
    _srvCopy: (d) => d, mergeDupNumbers: () => [], logAction: () => {}, pushAfterSave: () => {}, tdAfterSave: null, tdLastTaken: null,
    _token: 'T', _buildStale: !!opt.stale, _rev: 10, _baseSnapshot: null, _saveTimer: null, _savePending: false, _saveRetries: 0, _dupSaid: {},
    state: { orders: [{ id: 'O1' }], shipments: [{ id: 'S1', gatePass: '' }] },
  };
  s.fetch = async (url, o) => {
    s.calls++; s.sent.push(o && o.body);
    const step = s.script.length ? s.script.shift() : { status: 200, rev: 11 };
    if (step.gate) await step.gate;
    if (step.throw) throw new Error('network');
    return { status: step.status, ok: step.status >= 200 && step.status < 300, json: async () => (step.body || { rev: step.rev }) };
  };
  /* run the clock forward, firing timers in order, letting promises settle between them */
  s.advance = async (ms) => {
    const end = now + ms;
    for (;;) {
      await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
      const due = timers.filter(t => !t.done && t.at <= end).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      now = due.at; due.done = true; due.f();   /* not awaited: a save may wait on the network, like a real timer */
    }
    now = end; await new Promise(r => setImmediate(r));
  };
  s.chip = () => ({ cls: el.className, text: String(el.innerHTML).replace(/<[^>]+>/g, '') });
  vm.createContext(s);
  vm.runInContext([varLine('_savesOut'), varLine('SAVE_RETRY_MS'), SRC].join('\n'), s);
  return s;
}

(async () => {
  /* ---------- 1. a fast clean save shows nothing ---------- */
  {
    const s = box([{ status: 200, rev: 11 }]);
    s.state.shipments[0].gatePass = 'GP-0180'; s.save();
    await s.advance(500);
    eq('1. a clean save goes out once', s.calls, 1);
    eq('1. ...and the change is no longer pending', s._savePending, false);
    ok('1. ...and no chip shows for a fast save', !/show/.test(s.chip().cls), s.chip().cls);
    eq('1. ...and refresh is not stopped', s.saveUnsaved(), false);
  }

  /* ---------- 2. the connection drops: shown, kept, tried again, then saved ---------- */
  {
    const s = box([{ throw: true }, { throw: true }, { status: 200, rev: 11 }]);
    s.state.shipments[0].gatePass = 'GP-0180'; s.save();
    await s.advance(500);
    eq('2. the first try went out', s.calls, 1);
    ok('2. a dropped connection turns the chip red', /bad/.test(s.chip().cls), s.chip().cls);
    ok('2. ...saying it is not saved and not to refresh', /Not saved yet/.test(s.chip().text) && /Do not refresh/.test(s.chip().text), s.chip().text);
    ok('2. ...and when it tries again', /Trying again in 3 s/.test(s.chip().text), s.chip().text);
    eq('2. the change is still pending (not dropped)', s._savePending, true);
    eq('2. a refresh now asks first', s.saveUnsaved(), true);
    await s.advance(3000);
    eq('2. tried again by itself after 3 s', s.calls, 2);
    ok('2. the second wait is 6 s', /Trying again in 6 s/.test(s.chip().text), s.chip().text);
    await s.advance(6000);
    eq('2. third try after 6 more s', s.calls, 3);
    eq('2. saved in the end', s._savePending, false);
    ok('2. the chip says Saved', /ok/.test(s.chip().cls) && /Saved/.test(s.chip().text), JSON.stringify(s.chip()));
    ok('2. the last try sent the gate pass', /GP-0180/.test(s.sent[2]));
    await s.advance(3000);
    ok('2. Saved goes away after 2.5 s', !/show/.test(s.chip().cls), s.chip().cls);
  }

  /* ---------- 3. the server answers 500 / 502 / 503 / 413 ---------- */
  for (const code of [500, 502, 503, 413]) {
    const s = box([{ status: code }, { status: 200, rev: 11 }]);
    s.save(); await s.advance(500);
    ok('3. a ' + code + ' answer is shown as not saved', /bad/.test(s.chip().cls) && new RegExp('answered ' + code).test(s.chip().text), s.chip().text);
    await s.advance(3000);
    eq('3. ...and tried again after a ' + code, s.calls, 2);
    eq('3. ...and saved', s._savePending, false);
  }

  /* ---------- 4. a 409 that brings no server copy: tried again, not just a toast ---------- */
  {
    const s = box([{ status: 409, body: { conflict: true } }, { status: 200, rev: 11 }]);
    s.save(); await s.advance(500);
    ok('4. a 409 without the server copy is shown as not saved', /bad/.test(s.chip().cls), s.chip().cls);
    await s.advance(3000);
    eq('4. ...and tried again', s.calls, 2);
    eq('4. ...and saved', s._savePending, false);
  }

  /* ---------- 5. a slow save says Saving, then Saved ---------- */
  {
    const s = box([{ status: 200, rev: 11 }]);
    let release; const gate = new Promise(r => { release = r; });
    const f = s.fetch; s.fetch = async (u, o) => { await gate; return f(u, o); };
    s.save(); await s.advance(400 + 1300);
    ok('5. after 1.2 s the chip says Saving and not to refresh', /busy/.test(s.chip().cls) && /Saving/.test(s.chip().text) && /do not refresh/.test(s.chip().text), JSON.stringify(s.chip()));
    eq('5. a refresh while it is out asks first', s.saveUnsaved(), true);
    release(); await s.advance(10);
    ok('5. when it lands, Saved', /Saved/.test(s.chip().text), s.chip().text);
    eq('5. nothing pending', s.saveUnsaved(), false);
  }

  /* ---------- 6. retry waits grow and stop growing at 30 s ---------- */
  {
    const s = box([]);
    eq('6. waits: 3, 6, 12, 24, 30, 30 s', [1, 2, 3, 4, 5, 9].map(n => s.saveRetryMs(n, 0)), [3000, 6000, 12000, 24000, 30000, 30000]);
    eq('6. with +-20% so waiting tabs do not all send at once', [s.saveRetryMs(1, -0.2), s.saveRetryMs(1, 0.2)], [2400, 3600]);
  }

  /* ---------- 7. no internet on the device ---------- */
  {
    const s = box([{ throw: true }], { offline: true });
    s.save(); await s.advance(500);
    ok('7. offline says so', /no internet/.test(s.chip().text), s.chip().text);
  }

  /* ---------- 8. a new O2S was pushed while the page was open ---------- */
  {
    const s = box([], { stale: true });
    s.save(); await s.advance(500);
    eq('8. nothing is sent from an old page', s.calls, 0);
    ok('8. the chip says refresh, then do the step again', /bad/.test(s.chip().cls) && /Refresh, then do this step again/.test(s.chip().text), s.chip().text);
    eq('8. the leave question does not fight the Refresh banner', s.saveUnsaved(), false);
  }

  /* ---------- 9. signed out while saving ---------- */
  {
    const s = box([{ status: 401 }]);
    s.save(); await s.advance(500);
    ok('9. signed out: the chip says it was not saved', /bad/.test(s.chip().cls) && /signed out/.test(s.chip().text), s.chip().text);
  }

  /* ---------- 10. Try now sends at once ---------- */
  {
    const s = box([{ throw: true }, { status: 200, rev: 11 }]);
    s.save(); await s.advance(500);
    s.saveTryNow(); await s.advance(10);
    eq('10. Try now sends straight away', s.calls, 2);
    eq('10. ...and it saved', s._savePending, false);
  }

  /* ---------- 12. review S2: A is out, B fails fast, A lands: B is still pending ---------- */
  {
    let rel; const gA = new Promise(r => { rel = r; });
    const s = box([{ gate: gA, status: 200, rev: 11 }, { status: 503 }]);
    s.save(); await s.advance(500);                 // A out
    s.state.shipments[0].gatePass = 'GP-0181'; s.save(); await s.advance(500);   // B out, fails fast
    rel(); await s.advance(10);                     // A lands
    eq('12. a newer change that failed keeps the page pending', s._savePending, true);
    eq('12. ...so a refresh still asks first', s.saveUnsaved(), true);
    ok('12. ...and the note stays red', /bad/.test(s.chip().cls), s.chip().cls);
    await s.advance(3100);
    eq('12. ...and B is tried again', s.calls, 3);
    ok('12. ...with its gate pass', /GP-0181/.test(s.sent[2]));
    eq('12. ...and saved', s._savePending, false);
  }

  /* ---------- 13. review S1: A slow, B out too; A lands first: no Saved yet ---------- */
  {
    let rA, rB; const gA = new Promise(r => { rA = r; }), gB = new Promise(r => { rB = r; });
    const s = box([{ gate: gA, status: 200, rev: 11 }, { gate: gB, status: 200, rev: 12 }]);
    s.save(); await s.advance(400 + 1300);            // A out, Saving shown
    s.save(); await s.advance(500);                   // B out
    rA(); await s.advance(10);
    ok('13. A lands while B is out: the note does not say Saved', !/Saved/.test(s.chip().text), s.chip().text);
    eq('13. ...and the page is still pending', s.saveUnsaved(), true);
    rB(); await s.advance(10);
    ok('13. B lands: Saved', /Saved/.test(s.chip().text), s.chip().text);
    eq('13. ...nothing pending', s.saveUnsaved(), false);
  }

  /* ---------- 14. review S3: A failed, B carried it and landed: no red, no extra upload ---------- */
  {
    const s = box([{ throw: true }, { status: 200, rev: 11 }]);
    s.save(); await s.advance(500);                   // A fails, retry in 3 s
    s.save(); await s.advance(500);                   // B goes at 400 ms, lands
    ok('14. B carried A and landed: Saved, not red', /Saved/.test(s.chip().text) && !/bad/.test(s.chip().cls), JSON.stringify(s.chip()));
    await s.advance(4000);
    eq('14. ...and the old retry does not send again', s.calls, 2);
  }

  /* ---------- 15. review S4/S5: a failure, then signed out, then signed in ---------- */
  {
    const s = box([{ throw: true }]);
    s.save(); await s.advance(500);
    s._token = '';                                    // signed out (logout or a 401 on the pull)
    await s.advance(3100);
    eq('15. signed out: the retry sends nothing', s.calls, 1);
    ok('15. ...and says so instead of "trying again"', /signed out/.test(s.chip().text), s.chip().text);
    eq('15. ...and asks nothing on leaving', s.saveUnsaved(), false);
    s.saveStateReset(); s._token = 'T2';             // what doLogin does before loading the server copy
    eq('15. signed in again: nothing pending', s._savePending, false);
    eq('15. ...no Leave site question', s.saveUnsaved(), false);
    ok('15. ...the note is gone', !/show/.test(s.chip().cls), s.chip().cls);
    await s.advance(40000);
    eq('15. ...and no old retry fires under the new login', s.calls, 1);
  }

  /* ---------- 16. the same 4xx each time: stops after 5 tries, says so ---------- */
  {
    const s = box([{ status: 400 }, { status: 400 }, { status: 400 }, { status: 400 }, { status: 400 }, { status: 400 }]);
    s.save(); await s.advance(200000);
    eq('16. a 400 is tried 5 times, then O2S stops by itself', s.calls, 5);
    ok('16. ...and says so: Try now, or tell the COO', /stopped trying by itself/.test(s.chip().text) && /tell the COO/.test(s.chip().text), s.chip().text);
    eq('16. ...the change is still pending, so leaving asks first', s.saveUnsaved(), true);
    s.script.push({ status: 200, rev: 11 }); s.saveTryNow(); await s.advance(10);
    eq('16. Try now still sends', s.calls, 6);
  }

  /* ---------- 17. a 409 with a rev and no copy: takes the rev, stops after 5 ---------- */
  {
    const s = box([1, 2, 3, 4, 5, 6].map(() => ({ status: 409, body: { conflict: true, rev: 99, data: null } })));
    s.save(); await s.advance(200000);
    eq('17. 409 without a copy: the rev is taken', s._rev, 99);
    eq('17. ...and it stops after 5 tries', s.calls, 5);
  }

  /* ---------- 18. an error inside the merge is not called a dropped line ---------- */
  {
    const s = box([{ status: 409, body: { conflict: true, rev: 12, data: { orders: [] } } }]);
    s.merge3 = () => { throw new Error('boom'); };
    s.save(); await s.advance(500);
    ok('18. an error in the merge says O2S hit an error', /O2S hit an error while saving/.test(s.chip().text), s.chip().text);
  }

  /* ---------- 19. review 2: the last person's sign-out save lands after the next person signed in ---------- */
  {
    let rel; const g = new Promise(r => { rel = r; });
    const s = box([{ gate: g, status: 200, rev: 50 }]);
    s.save(); await s.advance(500);                  // the sign-out save is out
    s.saveStateReset(); s._rev = 40; s._baseSnapshot = 'fresh';   // doLogin loaded the server copy (rev 40)
    rel(); await s.advance(10);
    eq('19. a late reply from the last page does not move the new page on', [s._rev, s._baseSnapshot], [40, 'fresh']);
    ok('19. ...and shows nothing to the new person', !/show/.test(s.chip().cls), s.chip().cls);
  }

  /* ---------- 11. the source: no silent catch left in saveNow, and the leave question is wired ---------- */
  {
    const sn = H.grab('saveNow');
    ok('11. saveNow no longer ends in an empty catch', !/\}catch\(e\)\{\}\s*\}\s*$/.test(sn.trim()));
    ok('11. saveNow marks a failure on a dropped connection', /catch\(e\)\{ (if\(_mySess!==_saveSess\) return; )?saveFailed\(\(typeof navigator/.test(sn));
    ok('11. any other error says so, not "the line dropped"', /saveFailed\('O2S hit an error while saving\.'\)/.test(sn));
    ok('11. signing in starts clean (no retry of the last page)', /saveStateReset\(\); setSession\(j\.token, j\.user\)/.test(H.grab('doLogin')));
    ok('11. signing out with an unsaved change asks first', /if\(saveUnsaved\(\) && typeof confirm==='function' && !confirm\(/.test(H.grab('logoutAsk')) && !/onclick="(closeReadSign\(\);)?logout\(\)"/.test(html));
    ok('11. saveNow marks a failure on any other answer', /saveFailed\('The server answered '\+r\.status/.test(sn));
    ok('11. the old "Refreshed - please re-check" give-up is gone', !/Refreshed — please re-check your last change/.test(sn));
    ok('11. the page asks before leaving with an unsaved change', /addEventListener\('beforeunload',function\(e\)\{ if\(saveUnsaved\(\)\)/.test(html));
    ok('11. the chip has its style', /\.savestate\{position:fixed/.test(html) && /\.savestate\.bad\{/.test(html));
  }

  console.log((fails.length ? fails.map(f => '  FAIL  ' + f).join('\n') + '\n' : '') + '21a: a save is shown, kept and tried again: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
