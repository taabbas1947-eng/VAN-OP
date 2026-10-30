/* BUILD 2026-10-30f. Tahir, 30 Oct 2026 (panel; picture page Also Packed From): Also packed from can be changed on the Pack sheet
   (COO, CFO, Plant Manager, Production Manager) and in the Back Office product form (COO, CFO, Plant Manager); a reason is required;
   every add or remove writes an audit row and a log line. Himayat (QCM): the 5 old V Compost tests belong to the Compost base. D-355.
   Run: node also30f.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const SRC = ['alsoMay', 'alsoProduct', 'alsoListOf', 'alsoRaw', 'alsoUniq', 'bfxJs', 'alsoDiff', 'alsoAudit', 'alsoPackLine', 'openAlsoWin', 'alsoChoices', 'alsoAdd', 'alsoTake', 'renderAlsoWin', 'alsoClose', 'alsoSaveWin', 'pmAlsoField', 'compostTests30fV1', 'hardRole']
  .map(n => grab(n)).join('\n') + '\nvar alsoForm=null;';
function box(role, products) {
  const el = { innerHTML: '', classList: { add() {} } };
  const b = { console, JSON, Object, String, Array, Date, state: { role, masters: { products }, audit: [] }, logs: [], toasts: [], saved: 0, applied: 0, packDrawn: 0,
    customProducts: () => b.state.masters.products, pmBases: () => ['Amino Acid', 'Liquid Bio Stimulant', 'Compost', 'Zinc 21%'], qsEsc: x => String(x), _av: x => String(x == null ? '' : x),
    $: () => el, el, toast: m => b.toasts.push(m), logAction: m => b.logs.push(m), save: () => { b.saved++; }, render: () => {}, closeModal: () => {},
    applyCustomProducts: () => { b.applied++; }, scWho: () => 'Abdul Majid', nid: p => p + Math.random().toString(36).slice(2, 7),
    packForm: { bid: 'B1', brand: 'Tornado' }, renderPackModal: () => { b.packDrawn++; } };
  vm.createContext(b); vm.runInContext(SRC, b); return b; }
const prods = () => [{ brand: 'Tornado', base: 'Amino Acid' }, { brand: 'Tornado 500 ML', base: 'Amino Acid', alsoBases: ['Liquid Bio Stimulant'] }];
['COO', 'CFO', 'Plant Manager', 'Production Manager'].forEach(r => ok(r + ' may change Also packed from', box(r, prods()).alsoMay() === true));
['Production', 'Supply Chain', 'Lab Rep', 'KAM', 'Warehouse', 'QA Inspector'].forEach(r => ok(r + ' may not', box(r, prods()).alsoMay() === false));
{ const b = box('Production Manager', prods());
  const l = b.alsoPackLine('Tornado'); ok('the Pack sheet line names the main base and the link', /Packed from: <b>Amino Acid<\/b> \(main\)/.test(l) && /Change which bases this brand is packed from/.test(l), l);
  ok('a brand with a second base lists it', /also Liquid Bio Stimulant/.test(b.alsoPackLine('Tornado 500 ML')));
  ok('no brand picked: no line', b.alsoPackLine('') === '');
  ok('a role that may not change it sees the bases but no link', !/Change which/.test(box('Production', prods()).alsoPackLine('Tornado')) && /Packed from/.test(box('Production', prods()).alsoPackLine('Tornado'))); }
{ const b = box('Production Manager', prods()); b.openAlsoWin('Tornado'); b.alsoAdd('Liquid Bio Stimulant');
  ok('the window shows the main base and the added base', /Main base/.test(b.el.innerHTML) && /Liquid Bio Stimulant/.test(b.el.innerHTML) && /Why is this changing\?/.test(b.el.innerHTML));
  ok('the main base is not offered to add', !/<option value="Amino Acid">/.test(b.el.innerHTML));
  b.alsoSaveWin(); ok('no reason: refused, nothing saved', b.saved === 0 && /Say why it is changing/.test(b.toasts.pop()) && !b.state.masters.products[0].alsoBases);
  b.alsoForm.reason = 'same product, any of the 2 bases'; b.alsoSaveWin();
  eq('with a reason: saved', JSON.stringify(b.state.masters.products[0].alsoBases), JSON.stringify(['Liquid Bio Stimulant']));
  ok('1 audit row with who, the base and the reason', b.state.audit.length === 1 && b.state.audit[0].field === 'Also packed from' && b.state.audit[0].user === 'Abdul Majid' && /added Liquid Bio Stimulant/.test(b.state.audit[0].val) && /any of the 2 bases/.test(b.state.audit[0].val) && !!b.state.audit[0].id);
  ok('1 log line, saved once, product maps rebuilt, back to the Pack sheet', b.logs.length === 1 && /Also packed from changed/.test(b.logs[0]) && b.saved === 1 && b.applied === 1 && b.packDrawn >= 1 && b.alsoForm === null); }
{ const b = box('COO', prods()); b.openAlsoWin('Tornado 500 ML'); b.alsoTake(0); b.alsoForm.reason = 'test remove'; b.alsoSaveWin();
  ok('taking the only second base off removes the field', !('alsoBases' in b.state.masters.products[1]) && /removed/.test(b.state.audit[0].val) && b.state.audit[0].old === 'Liquid Bio Stimulant'); }
{ const b = box('COO', prods()); b.openAlsoWin('Tornado'); b.alsoSaveWin(); ok('no change: nothing written', b.saved === 0 && b.state.audit.length === 0 && /Nothing changed/.test(b.toasts.pop())); }
{ const b = box('Supply Chain', prods()); b.openAlsoWin('Tornado'); ok('a role that may not cannot open the window', b.alsoForm === null && /Only the COO, CFO, Plant Manager or Production Manager/.test(b.toasts.pop())); }
{ const b = box('COO', prods()); const f = { ownBase: false, base: 'Amino Acid', brand: 'Tornado', alsoBases: ['Liquid Bio Stimulant'], alsoOld: [], alsoReason: '' };
  const h = b.pmAlsoField(f); ok('the Back Office field shows the base and asks why when it changed', /Also packed from/.test(h) && /Liquid Bio Stimulant/.test(h) && /Why is Also packed from changing\?/.test(h));
  ok('unchanged: no reason box', !/Why is/.test(b.pmAlsoField({ ownBase: false, base: 'Amino Acid', brand: 'Tornado', alsoBases: [], alsoOld: [] }))); }
{ const sv = grab('pmSave');
  ok('pmSave refuses a change with no reason', /Say why Also packed from is changing \(a few words\)\. Nothing was saved\./.test(sv));
  ok('pmSave writes the form list and the audit rows', /if\(_alL&&_alL\.length\) rec\.alsoBases=_alL\.slice\(\);/.test(sv) && /alsoAudit\(brand,_alD,f\.alsoReason\)/.test(sv));
  ok('pmSave keeps the old list when the form has none (an old form)', /if\(!_alL&&Array\.isArray\(arr\[i\]\.alsoBases\)/.test(sv));
  ok('pmEdit and pmStartAdd fill the field (the list as stored)', /alsoBases:alsoRaw\(p\),alsoOld:alsoRaw\(p\)/.test(grab('pmEdit')) && /alsoBases:\[\],alsoOld:\[\]/.test(grab('pmStartAdd')));
  ok('the Pack sheet shows the line under the brand', /<\/select>\$\{alsoPackLine\(packForm\.brand\)\}<\/div>/.test(html)); }
/* 30f review fixes: pmSave run for real */
{ const PS = ['alsoListOf', 'alsoRaw', 'alsoUniq', 'alsoDiff', 'alsoAudit', 'pmSave', 'pmCanEdit', 'hardRole', 'pmFormGroup', 'pmEdit'].map(n => grab(n)).join('\n') + '\nvar prodMForm=null;';
  const pbox = (role, products) => { const b = { console, JSON, Object, String, Array, Date, Number, state: { role, masters: { products, groupOfBrand: {} }, audit: [] }, logs: [], toasts: [], saved: 0,
    customProducts: () => b.state.masters.products, brandCanon: x => x, BRAND_AKA: {}, SEED: { brandMap: {}, catalog: { channelByClient: {} } },
    toast: m => b.toasts.push(m), logAction: m => b.logs.push(m), save: () => { b.saved++; }, render: () => {}, closeModal: () => {}, applyCustomProducts: () => {},
    scWho: () => 'X', nid: p => p + Math.random().toString(36).slice(2, 7), pmSheetOpen: () => {} }; vm.createContext(b); vm.runInContext(PS, b); return b; };
  const P1 = () => [{ brand: 'T', base: 'Amino Acid', generic: 'g', form: 'Liquid', clients: ['VAN'], packs: [1], alsoBases: ['LBS'] }];
  const edit = (b, code) => { b.pmEdit(0); if (code) vm.runInContext(code, b); b.pmSave(); return b.state.masters.products[0]; };
  let b = pbox('COO', P1()); let r = edit(b, '');
  ok('pmSave, no change: list kept, no audit row, no reason asked', JSON.stringify(r.alsoBases) === '["LBS"]' && b.state.audit.length === 0 && b.saved === 1);
  b = pbox('COO', P1()); r = edit(b, "prodMForm.alsoBases=[]");
  ok('pmSave, base taken off with no reason: refused, nothing saved', b.saved === 0 && /Say why Also packed from/.test(b.toasts.pop()) && JSON.stringify(b.state.masters.products[0].alsoBases) === '["LBS"]');
  b = pbox('COO', P1()); r = edit(b, "prodMForm.alsoBases=[];prodMForm.alsoReason='wrong base'");
  ok('pmSave, base taken off with a reason: removed, 1 audit row', !('alsoBases' in r) && b.state.audit.length === 1 && /removed/.test(b.state.audit[0].val));
  b = pbox('COO', P1()); r = edit(b, "prodMForm.base='LBS'");
  ok('pmSave, main base changed to the second base: the second base is kept, no reason asked, no audit row', r.base === 'LBS' && JSON.stringify(r.alsoBases) === '["LBS"]' && b.state.audit.length === 0 && b.saved === 1);
  r = edit(b, "prodMForm.base='Amino Acid'");
  ok('changed back: Amino Acid main, Liquid Bio Stimulant still a second base (29b)', r.base === 'Amino Acid' && JSON.stringify(r.alsoBases) === '["LBS"]' && b.state.audit.length === 0);
  b = pbox('COO', P1()); r = edit(b, "delete prodMForm.alsoBases; delete prodMForm.alsoOld");
  ok('an old form without the field keeps the stored list', JSON.stringify(r.alsoBases) === '["LBS"]');
  b = pbox('COO', P1()); r = edit(b, "prodMForm.alsoBases=['LBS','Compost','Compost'];prodMForm.alsoReason='ok go'");
  ok('a base added twice is stored once, 1 audit row', JSON.stringify(r.alsoBases) === '["LBS","Compost"]' && b.state.audit.length === 1 && /added Compost/.test(b.state.audit[0].val));
  b = pbox('Production Manager', P1()); b.pmEdit(0); b.pmSave(); ok('the Production Manager cannot save in Back Office', b.saved === 0);
  const W = box('COO', [{ brand: 'T', base: 'LBS', alsoBases: ['LBS', 'Compost'] }]); W.openAlsoWin('T');
  ok('the window hides a stored entry equal to the main base', JSON.stringify(W.alsoForm.list) === '["Compost"]');
  W.alsoTake(0); W.alsoForm.reason = 'not packed from it'; W.alsoSaveWin();
  ok('saving the window keeps that hidden entry', JSON.stringify(W.state.masters.products[0].alsoBases) === '["LBS"]' && W.state.audit.length === 1); }
{ const b = box('COO', prods()); b.state.batches = [{ id: 'B1', base: 'Liquid Bio Stimulant' }]; b.packForm.brand = 'Tornado 500 ML'; b.packForm.oid = 'O1'; b.packForm.lid = 'L1';
  b.openAlsoWin('Tornado 500 ML'); b.alsoTake(0); b.alsoForm.reason = 'only Amino Acid'; b.alsoSaveWin();
  ok('the Pack sheet drops the brand when the base being packed from was taken off it', b.packForm.brand === '' && b.packForm.oid === '' && b.packForm.lid === '');
  const b2 = box('COO', prods()); b2.state.batches = [{ id: 'B1', base: 'Amino Acid' }]; b2.packForm.brand = 'Tornado 500 ML'; b2.packForm.oid = 'O1';
  b2.openAlsoWin('Tornado 500 ML'); b2.alsoTake(0); b2.alsoForm.reason = 'only Amino Acid'; b2.alsoSaveWin();
  ok('but keeps it when packing from its main base', b2.packForm.brand === 'Tornado 500 ML' && b2.packForm.oid === 'O1'); }
{ const E = ['qsEsc', '_av', 'bfxJs', 'alsoMay', 'hardRole', 'alsoProduct', 'alsoListOf', 'alsoRaw', 'alsoUniq', 'alsoDiff', 'alsoChoices', 'alsoPackLine', 'pmAlsoField'].map(n => grab(n)).join('\n');
  const c = { String, Array, Object, JSON, state: { role: 'COO', masters: {} }, customProducts: () => [{ brand: "Kisan's Gold \\ x", base: "Farmer's Base" }], pmBases: () => ["Farmer's Base", 'Amino Acid'] };
  vm.createContext(c); vm.runInContext(E, c);
  const dec = a => a.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const handlers = h => (h.match(/onclick="[^"]*"/g) || []).map(x => dec(x.slice(9, -1)));
  const parses = js => { try { new Function(js); return true; } catch (e) { return false; } };
  const h1 = handlers(c.alsoPackLine("Kisan's Gold \\ x")); ok('an apostrophe or backslash in a brand name keeps the Pack line link working', h1.length === 1 && parses(h1[0]) && h1[0].indexOf("openAlsoWin('Kisan\\'s Gold \\\\ x')") === 0, h1[0]);
  const h2 = handlers(c.pmAlsoField({ ownBase: false, base: 'Amino Acid', brand: 'K', alsoBases: ["Farmer's Base"], alsoOld: ["Farmer's Base"] }));
  ok('and the remove mark in Back Office', h2.length === 1 && parses(h2[0]), h2[0]); }
{ const G = grab('bs26001Shift30fV1'); const c = { JSON, Date, String, Array, Object }; vm.createContext(c); vm.runInContext(G, c);
  const s = { shiftEntries: [{ id: 'SE3828-gcy6', batchId: 'B3826-rjou', date: '2026-09-26', kg: 500 }], batches: [{ id: 'B3826-rjou', batchNo: 'BS26001', base: 'Amino Acid', status: 'closed', producedKg: 0, packedKg: 0, lots: [] }], productionLog: [], masters: {}, audit: [] };
  c.bs26001Shift30fV1(s); s.shiftEntries.push({ id: 'SE3828-gcy6', batchId: 'B3826-rjou', date: '2026-09-26', kg: 450 }); c.bs26001Shift30fV1(s);
  ok('BS26001: back with other figures after a removal: kept, and the skip note is written', s.shiftEntries.length === 1 && /left as it is/.test((s.masters._bs26001se30f.skipped || [])[0] || '') && !!s.masters._bs26001se30f.skippedAt && s.masters._bs26001se30f.did.length === 1); }
{ ok('the main base select redraws the Back Office field', /onchange="pmSet\(\\'base\\',this\.value\);pmRenderSheet\(\)"/.test(grab('pmRenderSheet'))); }
/* Compost tests (Himayat) */
{ const tests = [{ name: 'Physical Status' }, { name: 'Color' }, { name: 'Moisture' }, { name: 'OM' }, { name: 'CEC' }];
  const s = { masters: { labTemplates: { 'V Compost': tests } }, audit: [] }; const b = box('COO', []); b.compostTests30fV1(s);
  eq('Compost gets the 5 tests', s.masters.labTemplates.Compost.map(x => x.name).join(','), 'Physical Status,Color,Moisture,OM,CEC');
  ok('the old V Compost list stays', s.masters.labTemplates['V Compost'].length === 5);
  ok('flag and 1 audit row with a fixed id', !!s.masters._compost30f && s.audit.length === 1 && s.audit[0].id === 'AU-compost30f');
  s.masters.labTemplates.Compost[0].name = 'changed by the lab'; delete s.masters._compost30f; b.compostTests30fV1(s);
  ok('a Compost list of its own is never overwritten', s.masters.labTemplates.Compost[0].name === 'changed by the lab' && /already has/.test(s.masters._compost30f.skipped[0]) && s.audit.length === 1);
  ok('it runs in the load chain after alsoBasesV1', /alsoBasesV1\(s\); compostTests30fV1\(s\);/.test(html)); }
/* BS26001 shift row (Majid) */
{ const G = grab('bs26001Shift30fV1'); const vm2 = require('vm');
  const mk = () => ({ shiftEntries: [{ id: 'SE3828-gcy6', batchId: 'B3826-rjou', batchNo: 'BS26001', date: '2026-09-26', shift: 'Morning', kg: 500 }, { id: 'SE4010-n28n', batchId: 'B4008-lohw', batchNo: 'LBS26001', date: '2026-09-28', kg: 500 }],
    batches: [{ id: 'B3826-rjou', batchNo: 'BS26001', base: 'Amino Acid', status: 'closed', producedKg: 0, packedKg: 0, lots: [] }], productionLog: [], masters: {}, audit: [] });
  const c = { JSON, Date, String, Array, Object }; vm2.createContext(c); vm2.runInContext(G, c);
  let s = mk(); c.bs26001Shift30fV1(s);
  ok('BS26001 shift row removed, LBS26001 row kept', s.shiftEntries.length === 1 && s.shiftEntries[0].id === 'SE4010-n28n');
  ok('1 audit row with a fixed id, and the flag', s.audit.length === 1 && s.audit[0].id === 'AU-bs26001se30f' && s.masters._bs26001se30f.did.length === 1);
  s.shiftEntries.unshift({ id: 'SE3828-gcy6', batchId: 'B3826-rjou', batchNo: 'BS26001', date: '2026-09-26', kg: 500 }); c.bs26001Shift30fV1(s);
  ok('brought back by an old screen: removed again, no second audit row', s.shiftEntries.length === 1 && s.audit.length === 1 && !!s.masters._bs26001se30f.again);
  s = mk(); s.batches[0].producedKg = 500; c.bs26001Shift30fV1(s);
  ok('if the batch no longer matches (now shows production), nothing is removed and it says why', s.shiftEntries.length === 2 && /left as it is/.test(s.masters._bs26001se30f.skipped[0]) && s.audit.length === 0);
  s = mk(); s.productionLog.push({ id: 'X', batchNo: 'BS26001', kg: 500 }); c.bs26001Shift30fV1(s); ok('if a production log row exists again, nothing is removed', s.shiftEntries.length === 2);
  ok('it runs in the load chain after the Compost tests', /compostTests30fV1\(s\); bs26001Shift30fV1\(s\);/.test(html)); }
ok('Guide R-047 says who changes it and that a reason is needed', /<b>Who changes it\.<\/b> The COO, the CFO, the Plant Manager and the Production Manager/.test(html) && /Every change needs a reason and is kept on the audit trail/.test(html));
ok('the changelog has 30f and the build matches', /ver:'2026-10-30f'/.test(html) && /var BUILD_ID='2026-10-(30[f-z]|31[a-z])'/.test(html) && /var SYSDOC_VER='2026-10-(30[f-z]|31[a-z])'/.test(html));
process.exitCode = report('30f: Also packed from, and the Compost tests') ? 1 : 0;
