// Push 10b page checks in jsdom. Run: node apps/c2m/tests/page-10b.test.js (or give a page file as the first argument)
const fs = require('fs'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(process.argv[2] || PAGE, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.localStorage.setItem('van_token', 't'); w.fetch = () => new Promise(() => {}); } });
const w = dom.window; const E = s => w.eval(s); const doc = w.document;
setTimeout(() => {
  try {
    const pack = (id, size, cost, ap) => ({ id, size, unit: 'kg', cost: cost == null ? null : { total: cost }, approvedCost: ap, costGaps: [] });
    const notices = []; for (let i = 1; i <= 20; i++) notices.push({ id: 100 + i, text: `P${i} edited by yawar (packing bill of the 25 pack). No pack moved more than the re-approval % (5%).`, by_user: 'yawar', at: '2026-11-18 10:' + String(i).padStart(2, '0') + ':00' });
    notices.push({ id: 200, text: 'Urgent cost change waits for you', by_user: 'cfo', at: '2026-11-19 09:00:00' });
    w.__ST = { today: '2026-11-20', me: { role: 'coo', admin: true, label: 'COO', actions: ['see.cost', 'see.margin', 'see.products', 'see.price', 'price.approve', 'targets.approve', 'actuals.ratecheck'], nav: ['approvals', 'clients', 'margin', 'costs', 'pricelists'], more: [], user: 'tahir', name: 'Tahir' },
      settings: [{ k: 'reapprove_pct', v: '5' }, { k: 'budget_gp', v: '23.2' }], golive: { on: true, until: '2026-11-30' },
      products: [{ id: 1, brand: 'Alpha', customer: 'LCI', soldPer: 'kg', channel: 'White label', grp: 'White label', packs: [pack(11, 25, 110, 100)], target: 23 }],
      recipes: [{ id: 5, state: 'draft', brand: 'Tornado', customer: 'VAN brand (all channels)', clientProductId: 1, version: 1, steps: [{ action: 'start', by_user: 'majid', at: '2026-10-19 10:00:00' }] }, { id: 6, state: 'draft', brand: 'Bio Dividend', customer: 'VAN brand (all channels)', clientProductId: 1, version: 1, steps: [{ action: 'start', by_user: 'majid', at: '2026-10-19 10:00:00' }] }],
      targetRequests: [{ id: 1, status: 'open', brand: 'Ferti Huma Super', customer: 'LCI', from_gp: null, to_gp: 34.3, reason: 'Compared with others.', at: '2026-11-18 10:00:00', byAdmin: false }, { id: 2, status: 'open', brand: 'Ferti Climate', customer: 'LCI', from_gp: null, to_gp: 19.8, reason: 'x', at: '2026-11-18 10:00:00' }],
      pending: [], reapprovals: [], proposals: [], listRevisions: [], settingRequests: [], checks: [], actuals: [], imports: [], notices, noticesReadUpto: 0, sales: [], open: [], rates: [], materials: [], listItems: [], packingItems: [], packingBills: [], rules: [], freight: [], people: [{ username: 'yawar', name: 'Yawar Hussain' }] };
    E('ST = window.__ST; _pi = null; scr = "approvals"');
    const J = E('jobs()'); const stuck = J.filter(j => /^Recipe stuck/.test(j.t));
    if (!stuck.length) console.log('note: stuck recipes need lastStep data; jobs:', J.map(j => j.t).join(' | '));
    E('renderPage()'); const h = doc.body.innerHTML; const txt = doc.body.textContent.replace(/\s+/g, ' ');
    const badge = doc.querySelector('.hdr nav [data-scr="approvals"] .n'); ok(badge && badge.textContent === '2', 'badge counts only decisions: ' + (badge && badge.textContent));
    ok(/2 decisions need you\./.test(txt), 'answer line: ' + (txt.match(/Approvals ([^.]*\.[^.]*\.)/) || [])[0]);
    ok(/Raise the company target 23\.2% to 34\.3%/.test(txt) && /Lower the company target 23\.2% to 19\.8%/.test(txt), 'target words say which way');
    ok(doc.querySelector('.phd .helpb') && doc.querySelector('.helpx').hidden === true, 'page head has ? Help, closed');
    doc.querySelector('.helpb').click(); ok(doc.querySelector('.helpx').hidden === false && doc.querySelector('.helpb').getAttribute('aria-expanded') === 'true', 'help opens');
    E('renderPage()'); ok(doc.querySelector('.helpx').hidden === false, 'help stays open across a redraw');
    ok(/Go-live window open until/.test(txt) && !/data-glclose/.test(doc.querySelector('main').innerHTML) && /data-scr="costs">Open on Costs/.test(doc.querySelector('main').innerHTML), 'go-live 1 line, no controls on Approvals');
    const chips = [...doc.querySelectorAll('.jchips button')].map(b => b.textContent.trim()); const nums = chips.map(c => +c.match(/(\d+)$/)[1]); ok(chips.length >= 3 && nums.slice(1).reduce((a, b) => a + b, 0) === nums[0], 'chip counts add up: ' + chips.join(', '));
    ok(/To approve/.test(txt) && /To do/.test(txt), 'groups shown'); ok(/2 recipes stuck with the Production Manager/.test(txt) && doc.querySelector('.jsub').hidden, 'stuck recipes as 1 line, closed: ' + (txt.match(/\d recipes? stuck[^.]*/)||[])[0]);
    doc.querySelector('[data-jtopic="Prices and targets"]').click(); const rows = doc.querySelectorAll('.jl .jrow'); ok([...rows].every(r => /target|price|list/i.test(r.textContent)), 'chip filters: ' + [...rows].map(r => r.querySelector('.t').textContent).join(' | '));
    doc.querySelector('[data-jtopic="All"]').click();
    ok(/20 updates by Yawar/.test(doc.body.textContent) && doc.querySelectorAll('details.dg').length === 1, 'digest folds 20 notices into 1 line');
    ok(/Urgent cost change waits for you/.test(doc.body.textContent), 'a lone notice still shows on its own');
    const nr = doc.querySelector('[data-nread]'); ok(nr && nr.getAttribute('data-nread') === '200', 'mark as read up to the highest id shown');
    // review 10b, M4: topics by panel and title start
    const tp = E(`[jobTopic({ t: 'Re-approve cost: X', pan: { k: 'reapp' } }), jobTopic({ t: 'Not costed: 3 packs cannot be priced until', pan: { k: 'notcosted' } }), jobTopic({ t: 'Fill Labour rate Low', go: 1 }), jobTopic({ t: 'Approve target: A for B', pan: { k: 'treq' } }), jobTopic({ t: 'Recipe stuck 3 working days: X', pan: { k: 'rec' } }), jobTopic({ t: '5 white label clients flagged red on margin, FY to date' }), jobTopic({ t: 'Names to settle: 1 O2S name', pan: { k: 'names' } })]`);
    ok(JSON.stringify(tp) === JSON.stringify(['Costs and month end', 'Costs and month end', 'Costs and month end', 'Prices and targets', 'Recipes', 'Margin', 'Setup']), 'topics: ' + JSON.stringify(tp));
    // M3: Find hides empty group headers and opens a matching folded group
    E('scr = "approvals"; LFQ.jobs = "zzz"; renderPage()'); /* B7 (D-195): the Find box shows above 12 rows, or while it holds text */ const inp = doc.querySelector('[data-lf="jobs"]'); inp.value = 'zzz'; E("LFQ.jobs = 'zzz'; lfApply('jobs')");
    ok([...doc.querySelectorAll('.jl .jgh')].every(h => h.classList.contains('lfh')), 'no group header over an empty list');
    E("LFQ.jobs = 'tornado'; lfApply('jobs')"); const sub = doc.querySelector('.jsub'); ok(sub && !sub.hidden, 'a match inside a folded group opens it');
    E("LFQ.jobs = ''; lfApply('jobs')"); const lfc = doc.querySelector('[data-lfc="jobs"]'); ok(!lfc || /^5 in the list/.test(lfc.textContent), 'count counts folded items: ' + (lfc && lfc.textContent));
    // M5: red but not stuck stays red
    const ag = E(`(() => { ST.today = '2026-11-20'; const J2 = [{ t: 'Fill Labour rate Low', d: '', btn: 'Open', kind: 'red', pri: 0, since: '2026-11-19' }]; const d = document.createElement('div'); d.innerHTML = homeGrid(J2, -1, []); return d.querySelector('.jrow').className + ' ' + d.querySelector('.sw').textContent; })()`);
    ok(/red/.test(ag) && /Act now/.test(ag), 'red job not yet stuck is red: ' + ag);
    // m12: other roles keep their list
    E("ST.me = { role: 'production', admin: false, label: 'Production Manager', actions: ['recipe.start'], nav: ['today'], more: [], user: 'majid' }; scr = 'today'; renderPage()");
    ok(!doc.querySelector('.jl .jgh') && /Then|Needs you/.test(doc.querySelector('.jl h2').textContent), 'production keeps the old list');
    E("ST.me = window.__ST.me; ST.me = { role: 'coo', admin: true, label: 'COO', actions: ['see.cost', 'see.margin', 'see.products', 'see.price', 'price.approve', 'targets.approve', 'actuals.ratecheck'], nav: ['approvals', 'clients', 'margin', 'costs', 'pricelists'], more: [], user: 'tahir', name: 'Tahir' }");
    // other screens still render with the new head
    for (const s of ['costs', 'margin', 'pricelists', 'clients']) { let e = null; try { E(`scr = "${s}"; renderPage()`); } catch (x) { e = x.message; } ok(!e && doc.querySelector('main h1.topic'), 'renders ' + s + ' ' + (e || '')); }
    E('scr = "costs"; renderPage()'); ok(/data-glclose/.test(doc.querySelector('main').innerHTML), 'go-live controls remain on Costs');
    ok(/@media print\{\.hdr\{display:none!important\}/.test(html), 'top bar hidden in print');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-10b: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
