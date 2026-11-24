// Audit fixes of 24 Nov 2026 (D-185 point 6; docs 12, W1, W2, C3, C6): page checks in jsdom.
// Run: node apps/c2m/tests/page-185.test.js (or give a page file as the first argument)
const fs = require('fs'); const path = require('path'); const { JSDOM, html: PAGE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(process.argv[2] || PAGE, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} }); } });
const w = dom.window; const E = s => w.eval(s);
setTimeout(async () => {
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'c2m.js'), 'utf8');
    // C6: 1 place works out the price for a target
    ok(Math.abs(E('tpFor(77, 23)') - 100) < 1e-9, 'C6: cost 77 at a 23% target needs 100: ' + E('tpFor(77, 23)'));
    ok(E('tpFor(100, 100)') === null && E('tpFor(100, 150)') === null && E('tpFor(null, 23)') === null && E('tpFor(100, null)') === null && E('tpFor(100, undefined)') === null, 'C6: no price with no cost, no target, or a target of 100% or more');
    ok(E('tpFor(50, 0)') === 50, 'C6: a 0% target needs the cost itself');
    ok(!/\.total \/ \(1 - |c \/ \(1 - t \/ 100\) :|C\(k\) \/ \(1 - /.test(src.replace(/const tpFor = [^\n]*/, '')), 'C6: no screen writes the formula itself any more');
    // C3 on the New client prices grid and the COO's card (review M1, m3): 1 helper, with the allowance
    ok(E('belowT(22.97, 23)') === false && E('belowT(22.94, 23)') === true && E('belowT(22.97, null)') === false && E('belowT(null, 23)') === false, 'C3: belowT has the 0.05 point allowance');
    ok(!/ngp < r\.t\b/.test(src) && !/gp < t \? 'late'/.test(src) && (src.match(/belowT\(r\.ngp, r\.t\)/g) || []).length === 5, 'C3: the New client prices grid uses belowT in all 5 places: ' + (src.match(/belowT\(r\.ngp, r\.t\)/g) || []).length);
    // C3: the below-target reason follows the pack colour's 0.05 point allowance
    const K = t => ({ cost: { total: 77.03 }, approvedCost: 77.03, product: { target: t } });
    w.__K = K(23); E("propose = { v: '100' }"); let N = E('propNow(window.__K)');
    ok(N.below === false && Math.abs(N.gp - 22.97) < 1e-9, 'C3: GP 22.97 against a 23 target is not below target: ' + JSON.stringify(N));
    E("propose = { v: '99.8' }"); N = E('propNow(window.__K)'); ok(N.below === true, 'C3: GP ' + N.gp.toFixed(2) + ' against 23 is below target');
    w.__K = K(null); E("propose = { v: '50' }"); N = E('propNow(window.__K)'); ok(N.below === false && N.tp === null, 'C3: no target, never below target');
    w.__K = K(100); E("propose = { v: '100' }"); N = E('propNow(window.__K)'); ok(N.tp === null, 'C6: a 100% target gives no price for target, not Infinity');
    E('propose = null');
    // W1, W2: the sender of a list revision takes it back or drops it
    E("ST = { today: '2026-11-24', me: { role: 'cfo', admin: false, user: 'yawar', actions: ['list.revise', 'price.propose'], nav: [], more: [] } }");
    let h = E("lrTake({ id: 3, status: 'proposed', proposed_by: 'yawar' })");
    ok(/data-lrretract="3"/.test(h) && />Take back</.test(h) && /data-confirm="Confirm: take back this revision"/.test(h), 'W1: Take back on my waiting revision, with a confirm: ' + h);
    h = E("lrTake({ id: 4, status: 'sent_back', proposed_by: 'yawar' })"); ok(/data-lrretract="4"/.test(h) && />Drop it</.test(h), 'W2: Drop it on my sent-back revision: ' + h);
    ok(E("lrTake({ id: 5, status: 'proposed', proposed_by: 'umer' })") === '', 'W1: no button on another person\'s revision');
    ok(E("lrTake({ id: 6, status: 'approved', proposed_by: 'yawar' })") === '' && E("lrTake({ id: 7, status: 'withdrawn', proposed_by: 'yawar' })") === '', 'W1: no button once it is approved or withdrawn');
    E("ST.me.actions = ['see.price']"); ok(E("lrTake({ id: 3, status: 'proposed', proposed_by: 'yawar' })") === '', 'W1: no button without the right to revise a list');
    ok(/d\.lrretract\) \{ await act\(`\/api\/c2m\/lists\/revisions\/\$\{d\.lrretract\}\/retract`/.test(src), 'W1: the press posts to the retract address');
    ok(/data-pretract="\$\{p\.id\}" data-confirm="Confirm: drop this price">Drop it</.test(src), 'W2: Drop it on a sent-back price, with a confirm');
    // W9 (D-187): the certificate box offers a correction only after a reopen
    ok(/c\.redo && yw \? `<span class="acts"><button class="btn ghost" data-lfcert="no_change" data-confirm=/.test(src), 'W9: Correct buttons only when the month was reopened, each with a confirm');
    ok(!/billPacks = \(\) => [^\n]*packingMode !== 'client'/.test(src), 'W3: client-packed packs can be ticked on a packing bill');
    // Guide and What's changed
    ok(/ver: '2026-11-24a'/.test(src), "What's changed entry 2026-11-24a");
    ok(/A list revision waiting for the COO: \*\*Take back\*\*/.test(src) && /or \*\*Drop it\*\*, when the price is no longer wanted/.test(src) && /or \*\*Drop it\*\*, when the revision is no longer wanted/.test(src), 'Guide: Correct a mistake and the 2 sent-back jobs say Take back and Drop it');
  } catch (e) { fail++; console.log('ERROR ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 4).join(' ')); }
  console.log(`page-185: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 50);
