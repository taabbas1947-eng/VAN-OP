/* 29b (Tahir, 29 Oct 2026) - three team feedbacks:
   1. Fahim: the print box opened by itself when a document was opened to read -> no document prints by itself; the green Print / Save PDF button does it.
   2. Majid: Tornado 500 ML and Max Amino were missing from the Pack window of a Liquid Bio Stimulant batch -> the product master can say a brand may also be packed from another base.
   3. Fahim (video): "See their list" on Today closed by itself after a few seconds -> render() opens the same fold-outs again after each redraw.
   Pulls the real code out of o2s.html (no copies of the logic). Run: node apps/o2s/tests/printbase29b.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, report, grab, html } = H;
const eq = (n, a, b) => H.eq(n, JSON.stringify(a), JSON.stringify(b));   /* arrays made inside the sandbox compare by content */

/* ---------- 1. nothing prints by itself ---------- */
{ eq('no document has an onload that opens the print box', (html.match(/onload=\\?["'][^"']*window\.print/g) || []).length, 0);
  eq('no setTimeout(window.print) is left anywhere except the bar button', (html.match(/setTimeout\(function\(\)\{try\{window\.print\(\);\}catch\(e\)\{\}\},\d+\)/g) || []).length, 0);
  ['printDoc','printDC','printGatePass','printCOA','printPSI'].forEach(function (f) {
    var src = grab(f); ok(f + ' does not call window.print by itself', !/onload=/.test(src.replace(/<body onload[^>]*>/g, 'X')) || !/window\.print/.test(src) || /_docWithBar/.test(src)); });
  ok('printDoc keeps its text-only open (noPrint argument still accepted)', /function printDoc\(title,inner,noPrint\)/.test(html));
  ok('every document still opens through the bar with the Print / Save PDF button', /Print \/ Save PDF/.test(grab('_docBarHtml')) && /onclick="window\.print\(\)"/.test(grab('_docBarHtml')) && /_docBarHtml\(\)/.test(grab('_docWithBar')));
  ok('printDC still tells the person when a delivery challan is pending', /pend/.test(grab('printDC')));
  ok('printGatePass still tells the person when the pass is released', /released/.test(grab('printGatePass')));
}

/* ---------- 2. a brand may also be packed from another base ---------- */
const w = { console, SEED: { catalog: { brandsByClient: {}, clients: [] }, brandMap: {} }, BULK_BASES: [], toasts: [], logs: [] };
w.logAction = (m) => w.logs.push(m);
vm.createContext(w);
vm.runInContext(['brandsForBase', 'brandsForPack', 'applyProductsV1', 'applyCustomProducts', 'alsoBasesV1'].map(grab).join('\n'), w);
const prod = (brand, base, extra) => Object.assign({ brand, base, generic: 'g', form: 'Liquid', clients: ['VAN'], packs: [0.5], pack: 0.5, owner: 'VAN', seeded: true, active: true }, extra || {});
const mk = () => ({ masters: { products: [
  prod('Tornado', 'Amino Acid'), prod('Tornado 500 ML', 'Amino Acid'), prod('Max Amino', 'Amino Acid', { packs: [1], pack: 1, owner: 'White Label' }), prod('Amino Acid', 'Amino Acid'),
  prod('Liquid Bio Stimulant', 'Liquid Bio Stimulant', { seeded: false, bulk: true }), prod('Humi Cash', 'Liquid Bio Stimulant') ] }, audit: [] });

{ const s = mk(); vm.runInContext('alsoBasesV1', w); w.alsoBasesV1(s);
  const P = (b) => s.masters.products.find(p => p.brand === b);
  eq('Tornado 500 ML gets the Liquid Bio Stimulant link', P('Tornado 500 ML').alsoBases, ['Liquid Bio Stimulant']);
  eq('Max Amino gets the Liquid Bio Stimulant link', P('Max Amino').alsoBases, ['Liquid Bio Stimulant']);
  eq('plain Tornado (not asked for) is left alone', P('Tornado').alsoBases, undefined);
  eq('their own base does not change', [P('Tornado 500 ML').base, P('Max Amino').base], ['Amino Acid', 'Amino Acid']);
  ok('the one-time flag is written', s.masters._also29b && s.masters._also29b.did.length === 2);
  eq('one audit line', s.audit.length, 1);
  ok('the audit line names both brands', /Tornado 500 ML/.test(s.audit[0].val) && /Max Amino/.test(s.audit[0].val));
  eq('the audit line has a fixed id, so devices that each run the fix merge into 1 line', s.audit[0].id, 'AU-also29b');
  eq('the fix does not write an action-log line (it would never be saved)', w.logs.length, 0);
  const before = JSON.stringify(s); w.alsoBasesV1(s); eq('second run changes nothing', JSON.stringify(s), before);
  /* someone removes the link later: the fix does not put it back */
  P('Max Amino').alsoBases = []; w.alsoBasesV1(s); eq('a link removed later stays removed', P('Max Amino').alsoBases, []);
  /* the brand map and the Pack window list */
  w.applyProductsV1(s);
  eq('brand map: Tornado 500 ML lists the extra base', w.SEED.brandMap['Tornado 500 ML'].also, ['Liquid Bio Stimulant']);
  eq('brand map: its own base is still Amino Acid', w.SEED.brandMap['Tornado 500 ML'].base, 'Amino Acid');
  eq('brand map: Max Amino link removed -> no also', w.SEED.brandMap['Max Amino'].also, undefined);
  P('Max Amino').alsoBases = ['Liquid Bio Stimulant']; w.applyProductsV1(s);
  eq('Pack window for a Liquid Bio Stimulant batch lists its own brands and the two linked ones', w.brandsForPack('Liquid Bio Stimulant'), ['Humi Cash', 'Liquid Bio Stimulant', 'Max Amino', 'Tornado 500 ML']);
  eq('Pack window for an Amino Acid batch still lists them', w.brandsForPack('Amino Acid'), ['Amino Acid', 'Max Amino', 'Tornado', 'Tornado 500 ML']);
  eq('the divert list (brandsForBase) is not widened', w.brandsForBase('Liquid Bio Stimulant'), ['Humi Cash', 'Liquid Bio Stimulant']);
  const app = html.slice(0, html.indexOf('/*SYSDOC_DATA_START*/'));
  eq('brandsForPack is defined once and called in the Pack window and its multi-PO pre-select only (not the Divert list)', (app.match(/brandsForPack\(/g) || []).length, 3);
  ok('the call is in renderPackModal', /brandsForPack\(b\.base\)/.test(grab('renderPackModal')));
}
{ /* a link to its own base is ignored */
  const s = mk(); s.masters.products[1].alsoBases = ['Amino Acid', 'Liquid Bio Stimulant'];
  w.applyProductsV1(s); eq('own base is dropped from the link list', w.SEED.brandMap['Tornado 500 ML'].also, ['Liquid Bio Stimulant']);
}
{ /* the Liquid Bio Stimulant product is not there yet: nothing is done, nothing is flagged, it tries again later */
  const s = mk(); s.masters.products = s.masters.products.filter(p => p.brand !== 'Liquid Bio Stimulant');
  w.alsoBasesV1(s);
  eq('no Liquid Bio Stimulant product: no link made', s.masters.products.some(p => p.alsoBases), false);
  eq('...and no flag, so it runs again later', s._also29b || s.masters._also29b, undefined);
  s.masters.products.push(prod('Liquid Bio Stimulant', 'Liquid Bio Stimulant', { seeded: false, bulk: true })); w.alsoBasesV1(s);
  eq('once it exists the link is made', s.masters.products.filter(p => p.alsoBases).length, 2);
}
{ /* Max Amino missing: Tornado 500 ML is linked, no flag yet */
  const s = mk(); s.masters.products = s.masters.products.filter(p => p.brand !== 'Max Amino'); w.alsoBasesV1(s);
  eq('Tornado 500 ML linked even when Max Amino is not there', s.masters.products.find(p => p.brand === 'Tornado 500 ML').alsoBases, ['Liquid Bio Stimulant']);
  eq('no flag while a brand is missing', s.masters._also29b, undefined);
}
{ /* a brand whose own base is already Liquid Bio Stimulant needs no link */
  const s = mk(); s.masters.products.find(p => p.brand === 'Max Amino').base = 'Liquid Bio Stimulant'; w.alsoBasesV1(s);
  eq('base already Liquid Bio Stimulant: no link', s.masters.products.find(p => p.brand === 'Max Amino').alsoBases, undefined);
}
{ /* a server copy that lost the flag makes the fix run again: the audit line is not written twice */
  const s = mk(); w.alsoBasesV1(s); delete s.masters._also29b; s.masters.products.forEach(p => { delete p.alsoBases; }); w.alsoBasesV1(s);
  eq('fix run again after the flag was lost: links back, 1 audit line', [s.masters.products.filter(p => p.alsoBases).length, s.audit.filter(x => x.id === 'AU-also29b').length], [2, 1]); }
{ eq('no masters at all: no crash', (function () { try { w.alsoBasesV1({}); w.alsoBasesV1(null); return 'ok'; } catch (e) { return e.message; } })(), 'ok'); }
{ /* an edit of the product keeps the link, drops it only if it now equals the base */
  const src = grab('pmSave'); ok('pmSave carries alsoBases through an edit, whatever the base is changed to', /rec\.alsoBases=arr\[i\]\.alsoBases\.slice\(\)/.test(src) && !/x!==base/.test(src));
  ok('the load chain runs the fix after the 27 Oct fix', /dataFix27dV1\(s\);\s*alsoBasesV1\(s\);/.test(html));
}

/* ---------- 3. fold-outs stay open when the page is drawn again ---------- */
{ const mkDet = (t, open) => ({ open: !!open, firstElementChild: { tagName: 'SUMMARY', textContent: t, nextElementSibling: null } });
  const b = { console, state: { screen: 'today' }, _list: [] };
  b.$ = (id) => id === 'view' ? { querySelectorAll: () => b._list } : null;
  vm.createContext(b); vm.runInContext("var _detScr='';\n" + ['detList', 'detCapture', 'detRestore'].map(grab).join('\n'), b);
  const draw = (n) => { const c = b.detCapture(); b._list = [mkDet('Escalated to youProduction Officer · Ali Raza, Jawad Naseer' + n + ' jobs'), mkDet('Escalated to youQC Officer · Z' + n + ' jobs'), mkDet('Show more'), mkDet('Show more')]; b.detRestore(c); return b._list.map(d => d.open); };
  eq('first draw: all closed', draw(9), [false, false, false, false]);
  b._list[0].open = true; b._list[3].open = true;
  eq('after a redraw the two open ones are open again (count in the heading changed)', draw(10), [true, false, false, true]);
  b._list[0].open = false;
  eq('one the person closed is not opened again', draw(11), [false, false, false, true]);
  { /* a fold-out the screen draws open on purpose is never closed again (Back Office focus, complaint trail) */
    const c = b.detCapture(); b._list = [mkDet('Lab test templates (COA)', true)]; c.m['Lab test templates (COA)#1'] = false; b.detRestore(c);
    eq('a fold-out the screen opened on purpose stays open', b._list[0].open, true); b._list = [mkDet('Show more'), mkDet('Show more')]; b.detCapture(); }
  { /* a count early in the heading changes (16 jobs, then 15): still the same fold-out */
    b._list = [mkDet('Escalated to youLead Supply Chain16 jobs left too long')]; b._list[0].open = true;
    const c = b.detCapture(); b._list = [mkDet('Escalated to youLead Supply Chain15 jobs left too long')]; b.detRestore(c);
    eq('a fold-out stays open when the count in its heading changes', b._list[0].open, true); b.detCapture(); }
  b.state.screen = 'plant';
  eq('a different screen starts closed', draw(12), [false, false, false, false]);
  b._list[1].open = true; b.state.screen = 'today';
  eq('coming back to a screen does not borrow the other screen\'s open lists', draw(13), [false, false, false, false]);
  ok('the Pack window dropdown writes the brand\'s own base beside a borrowed brand and keeps the value plain', /<option value="\$\{x\}"/.test(grab('renderPackModal')) && /' \(base '\+_ob\+'\)'/.test(grab('renderPackModal')));
  ok('a multi-PO batch pre-selects its brand from the Pack list', /brandsForPack\(b\.base\)\.indexOf\(_bs\[0\]\)>-1\) packForm\.brand=_bs\[0\]/.test(html));
  const r = grab('render');
  ok('render() notes the open ones before it draws and restores them after', r.indexOf('detCapture()') > -1 && r.indexOf('detRestore(_detC)') > r.indexOf('[state.screen])()'));
  eq('a missing view does not crash', (function () { const c = { console, state: { screen: 'today' }, $: () => null }; vm.createContext(c); vm.runInContext("var _detScr='';\n" + ['detList', 'detCapture', 'detRestore'].map(grab).join('\n'), c); return [c.detCapture(), c.detRestore(null)]; })().map(String), ['null', 'undefined']);
}
/* ---------- the Guide and the build ---------- */
{ const g = grab('guideRules');
  ok('Guide rule: opening a document does not print it', /<h3>Opening a document does not print it<\/h3>/.test(g) && /Print \/ Save PDF/.test(g));
  ok('Guide rule: a brand that can be packed from more than one base', /<h3>A brand that can be packed from more than one base<\/h3>/.test(g) && /own base written beside it/.test(g));
  ok('both rules have their numbers', /'Opening a document does not print it':'R-046'/.test(html) && /'A brand that can be packed from more than one base':'R-047'/.test(html));
  ok('the changelog has the 29b entry and the build matches', /ver:'2026-10-29b'/.test(html) && /var BUILD_ID='2026-10-29[bc]'/.test(html) && /var SYSDOC_VER='2026-10-29[bc]'/.test(html)); }
report('printbase29b');
