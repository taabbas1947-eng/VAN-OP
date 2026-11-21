// Push 10c page checks in jsdom. Run: node apps/c2m/tests/page-10c.test.js (or give a page file as the first argument)
const fs = require('fs'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(process.argv[2] || PAGE, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
setTimeout(() => {
  try {
    const pk = (id, size, cost, ap, gaps) => ({ id, size, cost: cost == null ? null : { total: cost }, approvedCost: ap, costGaps: gaps || [] });
    const vp = (id, brand, packs, extra) => ({ id, brand, customer: 'VAN brand', soldPer: 'L', channel: 'VAN brand', grp: 'VAN brand', packs, target: 23.2, recipeState: 'approved', approvedVersionId: 9, active: true, ...extra });
    w.__ST = { today: '2026-11-20', me: { role: 'coo', admin: true, label: 'COO', actions: ['see.cost', 'see.margin', 'see.products', 'see.price', 'price.approve', 'actuals.ratecheck'], nav: ['approvals', 'clients', 'margin', 'costs', 'pricelists'], more: [], user: 'tahir', name: 'Tahir' },
      settings: [{ k: 'reapprove_pct', v: '5' }, { k: 'budget_gp', v: '23.2' }], golive: { on: true, until: '2026-11-30' },
      products: [vp(1, 'VL-Potash', [pk(11, 1, 439.39, 439.39), pk(12, 20, 346.8, 346.8), pk(13, 200, 323.68, 323.68), pk(14, 3, 373.28, 373.28)]), vp(2, 'Bio Dividend', [pk(21, 1, null, null, ['no approved recipe'])], { recipeState: 'draft', approvedVersionId: null }),
        vp(3, 'Chelated Zinc', [pk(31, 2, null, null, ['no approved recipe', 'no packing bill'])], { recipeState: null, approvedVersionId: null }), vp(4, 'Humi Grow', [pk(41, 25, null, null, ['no packing bill'])], {}), vp(5, 'Delta', [], {})],
      recipes: [], pending: [], reapprovals: [], proposals: [], listRevisions: [], settingRequests: [], targetRequests: [], checks: [], actuals: [], imports: [], notices: [], sales: [], open: [], listItems: [],
      rates: [{ gradeId: 1, rate: 10 }], materials: [], packingItems: [{ id: 1, date: '2026-11-17' }], packingBills: [{ id: 1, at: '2026-11-18 11:40:00' }], rules: [], freight: [],
      lf: { ready: true, from: '2026-11-17', rates: [{ kind: 'labour', name: 'Low', rsPerKg: 5, validFrom: '2026-11-17' }, { kind: 'labour', name: 'High', rsPerKg: 7.5, validFrom: '2026-11-17' }, { kind: 'foh', name: 'Low', rsPerKg: 15, validFrom: '2026-11-17' }, { kind: 'foh', name: 'High', rsPerKg: 22.5, validFrom: '2026-11-17' }] } };
    E('ST = window.__ST; _pi = null; scr = "clients"; cl = { kind: "van" }; ncp = ncp || {}; ncp.tab = "vprod"');
    const V = () => { const d = doc.createElement('div'); d.innerHTML = E('vVanProducts()'); return d; };
    let d = V(); const t = d.textContent.replace(/\s+/g, ' ');
    ok(/5 VAN brand products, 7 packs\. 3 packs cannot be costed yet\. 1 product has no pack yet\./.test(t), 'answer line: ' + (t.match(/VAN Brands (.{0,120})/) || [])[1]);
    const bx = [...d.querySelectorAll('.vpb')].map(b => b.textContent.replace(/\s+/g, ' ').trim()); ok(bx.join('|') === '7All packs|3Cannot be costed|1Recipe waitingpart of cannot be costed|4Costed', 'boxes: ' + bx.join('|'));
    ok(!/Standard margin/.test(d.innerHTML), 'no Standard margin column');
    const rows = [...d.querySelectorAll('tbody tr.go')]; ok(rows.length === 7 && rows.every(r => r.dataset.openprod && r.tabIndex === 0), 'whole rows open the product');
    const vl = rows.filter(r => /VL-Potash/.test(r.textContent)).map(r => r.querySelector('.vpk').textContent); ok(vl.join(',') === '1 L,3 L,20 L,200 L', 'packs small to large: ' + vl.join(','));
    ok(rows.filter(r => /VL-Potash/.test(r.textContent)).filter(r => r.querySelector('.vpn.same')).length === 3, 'name bold once, muted after');
    const bio = rows.find(r => /Bio Dividend/.test(r.textContent)); ok(/Recipe not approved/.test(bio.textContent) && /with the Production Manager/.test(bio.textContent) && !/no approved recipe/.test(bio.textContent), 'state said once: ' + bio.textContent.replace(/\s+/g, ' '));
    E("vpF = 'nc'"); d = V(); ok(d.querySelectorAll('tbody tr.go').length === 3, 'box filters to 3');
    E("vpF = 'wait'"); d = V(); ok(d.querySelectorAll('tbody tr.go').length === 1, 'recipe waiting 1'); E("vpF = 'all'");
    // Costs
    E('scr = "costs"; cpart = null'); const c = doc.createElement('div'); c.innerHTML = E('vCosts()'); const ct = c.textContent.replace(/\s+/g, ' ');
    ok(/need attention: .*Month end/.test(ct) && /Freight cost/.test(ct.match(/need attention: [^.]*\./)[0]), 'answer names them: ' + ct.match(/\d of \d need attention: [^.]*\./));
    const boxes = [...c.querySelectorAll('.cb2 .cbox')]; ok(boxes.length === 6 && boxes.every(b => b.tagName === 'BUTTON' && b.dataset.cpart), 'whole boxes are buttons');
    ok(!/>Open</.test(c.querySelector('.cb2').innerHTML), 'no Open buttons');
    const order = boxes.map(b => b.dataset.cpart); ok(order.indexOf('month') < order.indexOf('materials') && order.indexOf('freight') < order.indexOf('materials'), 'attention first: ' + order.join(','));
    const fr = boxes.find(b => b.dataset.cpart === 'freight'); ok(/Not set up/.test(fr.textContent), 'freight not set up');
    const mo = boxes.find(b => b.dataset.cpart === 'month'); ok(/0 of 5 steps done · next: actuals/.test(mo.textContent) && mo.querySelectorAll('.csteps span').length === 5, 'month end steps: ' + mo.textContent.replace(/\s+/g, ' '));
    const pa = boxes.find(b => b.dataset.cpart === 'packing'); ok(/Last change 18 Nov/.test(pa.textContent), 'packing last change from the bill: ' + pa.textContent.replace(/\s+/g, ' '));
    const la = boxes.find(b => b.dataset.cpart === 'labour'); ok(/Low Rs 5\.00 · High Rs 7\.50 per kg or L|High Rs 7\.50 · Low Rs 5\.00 per kg or L|Low Rs 5\.00 · High Rs 7\.50/.test(la.textContent) && /per kg or L/.test(la.textContent), 'labour with unit: ' + la.textContent.replace(/\s+/g, ' '));
    ok(/data-glclose/.test(c.innerHTML) && /What the window does/.test(c.innerHTML), 'go-live 1 line with controls and fold');
    ok(/Last change 17 Nov/.test(la.textContent), 'labour last change: ' + la.textContent.replace(/\s+/g, ' '));
    ok(mo.querySelector('.csteps').textContent.replace(/✓ /g, '').replace(/\s+/g, '') === 'ActualsChargedonkgmadeTietothebooksCOOcheckLock', 'month steps match Month end: ' + mo.querySelector('.csteps').textContent);
    ok(boxes.every(b => /\bs-(bad|warn|off|wait|ok)\b/.test(b.className)), 'every box has a state class');
    ok(/\.cboxes\.cb2 \.cbox\.s-bad\{border-left-color:var\(--over\)!important\}/.test(html) && /\.cboxes\.cb2 \.cbox\.s-ok\{border-left-color:var\(--ok\)!important\}/.test(html), 'edge colour beats the shared border rule');
    ok(boxes.every(b => /Open .*: /.test(b.getAttribute('aria-label'))), 'aria-label');
    // waiting is not attention: a freight rate that starts later only
    E("ST.freight = [{ segment: 'A', region: 'Lahore', valid_from: '2026-11-17', rs_per_kg: 2 }, { segment: 'A', region: 'Lahore', valid_from: '2026-11-24', rs_per_kg: 3 }]");
    const c2 = doc.createElement('div'); c2.innerHTML = E('vCosts()'); const fr2 = c2.querySelector('[data-cpart="freight"]');
    ok(/Waiting/.test(fr2.textContent) && /s-wait/.test(fr2.className) && /Last change 17 Nov/.test(fr2.textContent) && !/Freight cost/.test((c2.textContent.match(/need attention: [^.]*\./) || [''])[0]), 'freight later-dated waits: ' + fr2.textContent.replace(/\s+/g, ' '));
    E("ST.freight = [{ segment: 'A', region: 'Lahore', valid_from: '2026-11-24', rs_per_kg: 3 }]");
    const c3 = doc.createElement('div'); c3.innerHTML = E('vCosts()'); const fr3 = c3.querySelector('[data-cpart="freight"]');
    ok(/Not set up/.test(fr3.textContent) && /starts later/.test(fr3.textContent) && /Freight cost/.test((c3.textContent.match(/need attention: [^.]*\./) || [''])[0]), 'no rate today is Not set up even with a later one: ' + fr3.textContent.replace(/\s+/g, ' '));
    E("ST.freight = []; ST.pending = [{ id: 1, status: 'waiting', kind: 'rate' }]");
    const c4 = doc.createElement('div'); c4.innerHTML = E('vCosts()'); const ma4 = c4.querySelector('[data-cpart="materials"]');
    ok(/To do/.test(ma4.textContent) && /save it again or drop it/.test(ma4.textContent), 'in the window a Monday wait is To do: ' + ma4.textContent.replace(/\s+/g, ' '));
    E("ST.golive = { on: false }"); const c5 = doc.createElement('div'); c5.innerHTML = E('vCosts()'); const ma5 = c5.querySelector('[data-cpart="materials"]');
    ok(/Waiting/.test(ma5.textContent) && /s-wait/.test(ma5.className), 'outside the window a Monday wait is Waiting: ' + ma5.textContent.replace(/\s+/g, ' '));
    E("ST.golive = { on: true, until: '2026-11-30' }; ST.pending = []");
    ok(/\.cb2 \.s-wait \.cwhy\{color:var\(--blue\)\}/.test(html), 'waiting reason in blue');
    // a follower with no cost is not Costed
    E("ST.products.push({ id: 6, brand: 'Zeta', customer: 'VAN brand', soldPer: 'kg', channel: 'VAN brand', packs: [{ id: 61, size: 10, cost: null, approvedCost: null, costGaps: ['no packing bill'] }], followsId: 1, followsBrand: 'VL-Potash', recipeState: null, active: true }); _pi = null; scr = 'clients'");
    d = V(); const z = [...d.querySelectorAll('tbody tr.go')].find(r => /Zeta/.test(r.textContent)); ok(z && /Cost missing/.test(z.textContent) && /no packing bill/.test(z.textContent), 'follower with no cost: ' + (z && z.textContent.replace(/\s+/g, ' ')));
    ok(/4 packs cannot be costed yet\./.test(d.textContent) && /4Cannot be costed/.test([...d.querySelectorAll('.vpb')].map(b => b.textContent.replace(/\s+/g, ' ')).join('|')), 'answer and box agree');
    // sort key keeps sizes in order and drops the muted name when sorted by another column
    const r1 = [...d.querySelectorAll('tbody tr.go')].filter(r => /VL-Potash/.test(r.textContent)).map(r => r.cells[0].dataset.v); ok(r1.slice().sort().join() === r1.join() && r1[0] === 'VL-Potash|000001000', 'sort key: ' + r1.join(','));
    E("Object.keys(SORTS).forEach(k => delete SORTS[k]); SORTS['clients|Product and pack/Cost today, Rs per kg or L/State/What is missing'] = { i: 1, n: true, d: -1 }");
    d = V(); ok(d.querySelectorAll('.vpn.same').length === 0, 'no muted name when sorted by cost');
    E("SORTS['clients|Product and pack/Cost today, Rs per kg or L/State/What is missing'] = { i: 0, n: false, d: -1 }"); d = V(); ok(d.querySelectorAll('.vpn.same').length === 0, 'no muted name when the Product column runs down'); E("Object.keys(SORTS).forEach(k => delete SORTS[k])");
    E('scr = "costs"; cpart = null');
    E('renderPage()'); ok(doc.querySelector('main .cb2'), 'Costs renders in the page');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-10c: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
