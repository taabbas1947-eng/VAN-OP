// Push 10a page checks in jsdom. Run: node apps/c2m/tests/page-10a.test.js (or give a page file as the first argument)
const fs = require('fs'); const { JSDOM, html: PAGE, fixture: FIXTURE } = require('./_page.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL ' + m); } };
const html = fs.readFileSync(process.argv[2] || PAGE, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/c2m', beforeParse(w) { w.fetch = () => new Promise(() => {}); w.localStorage.setItem('van_token', 't'); } });
const w = dom.window; const E = s => w.eval(s);
setTimeout(() => {
  try {
    const pack = (id, size, cost, ap, gaps) => ({ id, size, unit: 'kg', cost: cost == null ? null : { total: cost }, approvedCost: ap, costGaps: gaps || [] });
    const prod = (id, brand, cust, packs, extra) => ({ id, brand, customer: cust, soldPer: 'kg', channel: 'White label', grp: 'White label', packs, target: 23, active: true, ...extra });
    w.__ST = { today: '2026-11-24', me: { role: 'coo', admin: true, actions: ['see.cost', 'see.margin', 'see.products', 'see.price', 'price.approve'], nav: ['approvals'], more: [], user: 'tahir', name: 'Tahir' },
      settings: [{ k: 'reapprove_pct', v: '3' }, { k: 'budget_gp', v: '23' }], golive: { on: true, until: '2026-11-30' },
      products: [prod(1, 'Alpha', 'LCI', [pack(11, 25, 110, 100), pack(12, 50, 101, 100)]), prod(2, 'Beta', 'UPL', [pack(21, 10, 200, null), pack(22, 20, null, 150, ['no packing bill'])]), prod(3, 'Gamma', 'BKK', [pack(31, 5, 50, 50)]),
        prod(4, 'Delta', 'VAN brand', [], { channel: 'VAN brand', grp: 'VAN brand' }), prod(5, 'Eps', 'VAN brand', [pack(51, 1, null, null, ['no approved recipe'])], { channel: 'VAN brand', grp: 'VAN brand', recipeState: 'approved', approvedVersionId: 9 })],
      recipes: [], pending: [], reapprovals: [], proposals: [], listRevisions: [], settingRequests: [], targetRequests: [], checks: [], actuals: [], imports: [], notices: [], sales: [], open: [], rates: [], materials: [], listItems: [], mrpMissing: [], mrpIssues: [] };
    E('ST = window.__ST; _pi = null;');
    // 10a-2: the review list
    const R = E('glRevRows()'); ok(R.moved.length === 1 && R.moved[0].k.id === 11 && R.small.length === 1 && R.first.length === 1 && R.left.length === 1 && R.none.length === 1 && R.n === 3, 'glRevRows groups ' + JSON.stringify({ m: R.moved.length, s: R.small.length, f: R.first.length, l: R.left.length, z: R.none.length, n: R.n }));
    const B = E('glRevBox()'); ok(/Moved more than 3%: 1/.test(B) && /\+10\.0%/.test(B) && /On 1 Dec 2026|On Tue 1 Dec|On 1 Dec/.test(B) && /keeps its approved cost: 1/.test(B) && /keeps Rs 150\.00/.test(B) && /No cost and no approved cost, stays without one: 1/.test(B) && !/keeps the old/.test(B), 'glRevBox text: ' + B.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 400));
    const J = E('jobs()'); const g = J.find(j => j.pan && j.pan.k === 'glrev'); ok(!!g && /3 packs/.test(g.t) && /1 pack moved more than 3%/.test(g.d) && /1 takes its first approved cost/.test(g.d) && /1 with no cost stays without/.test(g.d), 'COO job from 7 days before: ' + JSON.stringify(g));
    E("ST.today = '2026-11-20'; if (typeof RSEQ !== 'undefined') RSEQ++"); ok(!E('jobs()').some(j => j.pan && j.pan.k === 'glrev'), 'no job before 23 Nov');
    E("ST.today = '2026-11-24'; ST.me.admin = false; ST.me.role = 'cfo'; if (typeof RSEQ !== 'undefined') RSEQ++"); ok(!E('jobs()').some(j => j.pan && j.pan.k === 'glrev'), 'CFO gets no job');
    ok(/data-panopen="glrev"/.test(E("glStrip('costs')")), 'CFO sees the list button on the go-live line');
    E("ST.me.admin = true; ST.me.role = 'coo'");
    E("pan = { k: 'glrev' }"); ok(/Costs that become approved/.test(E('vPanel()')), 'panel opens'); E('pan = null');
    // 10a-5: Guide words in the window
    ok(/Send to the CFO \(go-live window, until/.test(E("glGuide('Press **Send to the QC Head**.')")), 'guide step in window');
    E("ST.golive = { on: false }"); ok(E("glGuide('Press **Send to the QC Head**.')") === 'Press **Send to the QC Head**.', 'guide unchanged outside window');
    E("ST.golive = { on: true, until: '2026-11-30' }");
    // 10a-5: VAN brand count, packs only
    E("ncp = ncp || {}"); const V = E('vVanProducts()').replace(/<[^>]+>/g, ' ');
    ok(/2 VAN brand products, 1 pack\. 1 pack cannot be costed yet\. 1 product has no pack yet\./.test(V.replace(/\s+/g, ' ')), 'VAN brand line: ' + V.replace(/\s+/g, ' ').slice(0, 200));
    // 10a-4: a viewer downloads the latest issued list
    E("ST.me = { role: 'viewer', admin: false, actions: ['pricedoc.granted', 'see.granted_lists'], nav: ['lists'], more: [], user: 'ali' }; ST.grants = [{ grant_kind: 'list', grant_value: 'dist' }]; ST.lists = { dist: [], dealer: [], farmer: [] }; ST.listItems = [];");
    E("VPLX = [{ id: 7, ref: 'VAN/PL/2026/001', audience: 'dist', client: null, effective: '2026-10-11', till: null }]");
    let L = ''; try { L = E('vLists()'); } catch (e) { L = 'ERR ' + e.message + e.stack.split('\n').slice(1,4).join(' '); }
    ok(/data-plget="7"/.test(L) && !/data-mkpdf/.test(L) && /VAN\/PL\/2026\/001/.test(L), 'viewer downloads the issued list: ' + L.slice(0, 300));
    E("VPLX[0].till = '2026-10-20'; ST.today = '2026-11-24'"); L = E('vLists()'); ok(!/data-plget/.test(L) && !/data-mkpdf/.test(L) && /ended on/.test(L), 'ended list: no download, ask the CFO');
    E("VPLX[0].till = null"); L = E('vLists()'); ok(/data-plget="7"/.test(L), 'open-ended list downloads');
    E('VPLX = []'); try { L = E('vLists()'); } catch (e) { L = 'ERR ' + e.message; } ok(/data-mkpdf/.test(L) && /not been issued yet/.test(L), 'never issued: makes the first ' + L.slice(0, 200));
    // 10a-4: a grant tick that was not saved goes back (code check)
    ok(/if \(!r\) t\.checked = !t\.checked;/.test(html), 'grant revert present');
    // review m4: a failed read never offers to make a new number
    E("VPLX = 'error'"); L = E('vLists()'); ok(!/data-mkpdf/.test(L) && /could not be read/.test(L), 'failed read: no make button');
    // review m8: C-06 opens the listcheck report on All dates and the flagged lines
    ok(/if \(k === 'listcheck'\) lcF = 'flag';/.test(html), 'C-06 resets the filter chip');
    // review m2: a blank re-approval % splits at 3, as the server
    E("ST.me = { role: 'coo', admin: true, actions: ['see.cost'], nav: ['approvals'], more: [], user: 'tahir' }; ST.settings = []; _pi = null");
    const R2 = E('glRevRows()'); ok(R2.moved.length === 1 && R2.small.length === 1, 'blank % splits at 3');
  } catch (e) { fail++; console.log('ERROR', e && e.stack); }
  console.log(`page-10a: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
}, 300);
