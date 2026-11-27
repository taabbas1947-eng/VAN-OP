/* BUILD 2026-11-26b (D-380). Tahir ruled on 26 Nov 2026, after 420 Kg of Max Sulfur 1 Kg packs were entered on the 10 Kg line of
   PO 23214: 1A the pack size on every PO line (grouped by size) and on Today, QA, Divert and Add missing packing; 2A the PO's
   instruction note in those lists; 3A the packer types whole packs (Majid: the floor counts packs at shift end, loose product is
   not packing). Run: node pack1126b.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;
const esc = x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const box = (st) => { const c = Object.assign({ console, Math, String, Object, Array, JSON, state: st, PACK_FLAG_KG: 10000, seedPackForBrand: () => 0,
  unitOf: b => (/Liquid/.test(b) ? 'L' : 'Kg'), fmt: n => Math.round(n).toLocaleString('en-US'), qsEsc: esc, _av: x => String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/"/g, '&quot;'),
  batchPackableKg: b => b.left, pqMax: () => 1e9, lineFacts: () => ({ gap: 0, ordered: 0, logged: 0 }), refreshed: 0 });
  vm.createContext(c);
  vm.runInContext(['packFmt', 'packSizeOf', 'packSizeTxt', 'packNoteTxt', 'packLineLabel', 'packPoOptions', 'packQtyHTML', 'packSetPacks', 'packEntryCalc', 'packConfirmInner', 'packConfirmGate', 'packFormOf', 'packFitHTML'].map(grab).join('\n')
    + '\nvar packForm=null,pqForm=null,dfForm=null,lfForm=null,divForm=null; function packConfirmRefresh(){ refreshed++; }', c);
  return c; };
const O14 = { id: 'O14', po: '23214', client: 'MAXIM AGRI (PVT) LTD', instructions: 'Order for Hyderabad', lines: [{ id: 'A', brand: 'Max Sulfur', pack: 10, ordered: 15000, packed: 420 }, { id: 'B', brand: 'Max Sulfur', pack: 1, ordered: 1000, packed: 1000 }] };
const O15 = { id: 'O15', po: '23215', client: 'MAXIM AGRI (PVT) LTD', instructions: 'Order for Sheikhupura', lines: [{ id: 'C', brand: 'Max Sulfur', pack: 10, ordered: 15000, packed: 1000 }, { id: 'D', brand: 'Max Sulfur', pack: 1, ordered: 1000, packed: 0 }] };
const st = () => ({ orders: [JSON.parse(JSON.stringify(O14)), JSON.parse(JSON.stringify(O15))], batches: [{ id: 'B1', left: 5000 }] });

/* 1A + 2A: the line label and the list */
{ const c = box(st()); const o = c.state.orders;
  eq('a line reads PO, customer, pack size, note, need in Kg and packs', c.packLineLabel(o[1], o[1].lines[1]), '23215 · MAXIM AGRI (PVT) LTD · 1 Kg pack · “Order for Sheikhupura” · needs 1,000 Kg = 1,000 packs');
  ok('the 10 Kg line says 10 Kg pack and 1,458 packs', /10 Kg pack/.test(c.packLineLabel(o[0], o[0].lines[0])) && /needs 14,580 Kg = 1,458 packs/.test(c.packLineLabel(o[0], o[0].lines[0])));
  eq('a long note is cut to 40 characters', c.packNoteTxt({ instructions: 'Deliver to the Sheikhupura warehouse gate number two before Friday' }).length, 40);
  ok('no note, no quotes', !/“/.test(c.packLineLabel({ po: 'X', client: 'C', instructions: '' }, o[0].lines[0])));
  ok('no pack size: no size and no packs', c.packLineLabel({ po: 'X', client: 'C' }, { brand: 'Max Sulfur', pack: 0, ordered: 100, packed: 0 }) === 'X · C · needs 100 Kg');
  const opts = [{ o: o[1], l: o[1].lines[0] }, { o: o[1], l: o[1].lines[1] }, { o: o[0], l: o[0].lines[0] }];
  const h = c.packPoOptions(opts, 'O15', 'D', x => ' · linked');
  ok('lines of 2 sizes are grouped, bigger pack first', h.indexOf('<optgroup label="10 Kg pack">') >= 0 && h.indexOf('<optgroup label="1 Kg pack">') > h.indexOf('<optgroup label="10 Kg pack">'));
  ok('the chosen line stays selected and the extra text is kept', /value="O15\|D" selected>23215[^<]*1 Kg pack[^<]* · linked<\/option>/.test(h));
  ok('every option says its pack size', (h.match(/<option /g) || []).length === 3 && (h.match(/Kg pack ·/g) || []).length === 3);
  const one = c.packPoOptions([opts[0], opts[2]], '', '');
  ok('lines of 1 size are not grouped', !/optgroup/.test(one) && (one.match(/<option /g) || []).length === 2);
  ok('the customer and note are escaped', /&lt;b&gt;/.test(c.packPoOptions([{ o: { id: 'Z', po: 'Z', client: '<b>X', instructions: '' }, l: o[0].lines[0] }], '', ''))); }

/* 3A: the quantity box and the gate */
{ const c = box(st()); c.packForm = { bid: 'B1', oid: 'O15', lid: 'D', kg: '' };
  let h = c.packQtyHTML('pack', 'packForm', 'kg', '3 · Qty (Kg/L)', '3', 'max 5,000');
  ok('a line with a pack size asks for whole packs', /3 · Packs packed \(1 Kg pack\)/.test(h) && /step="1"/.test(h) && /packSetPacks\('pack','kg',this\.value\)/.test(h) && !/Qty \(Kg\/L\)/.test(h));
  c.packSetPacks('pack', 'kg', '225'); eq('225 packs of 1 Kg store 225 Kg', c.packForm.kg, '225'); ok('...and refresh the packs line', c.refreshed === 1);
  eq('...which passes the gate', c.packConfirmGate(c.packForm, 'pack'), '');
  c.packForm.lid = 'C'; c.packSetPacks('pack', 'kg', '22'); eq('22 packs of 10 Kg store 220 Kg', c.packForm.kg, '220');
  c.packForm.kg = '225'; ok('225 Kg on the 10 Kg line (22.5 packs) is refused', /Packs are counted whole: 22\.5 packs of 10 Kg/.test(c.packConfirmGate(c.packForm, 'pack')));
  h = c.packQtyHTML('pack', 'packForm', 'kg', 'Q', '3', ''); ok('...and the box shows 22.5 so the fault is seen', /value="22\.5"/.test(h));
  ok('...and the packs line says it in red', /class="note sg bad"/.test(c.packConfirmInner(c.packForm, 'pack')) && /Packs are counted whole/.test(c.packConfirmInner(c.packForm, 'pack')));   /* 2026-11-27d: red by class, not border-color (D-384) */
  c.packForm.lid = 'D'; c.packForm.kg = '1500'; ok('more packs than the line needs are refused with the number that fits', /Only 1,000 whole packs can be packed here \(the PO line needs only 1,000 Kg more\)/.test(c.packConfirmGate(c.packForm, 'pack')));
  c.state.batches[0].left = 305; c.packForm.lid = 'C'; c.packForm.kg = '310'; ok('more than the batch has left: refused, with the whole packs that fit', /Only 30 whole packs can be packed here \(the batch has only 305 Kg left\)/.test(c.packConfirmGate(c.packForm, 'pack')));
  c.packForm.lid = ''; h = c.packQtyHTML('pack', 'packForm', 'kg', '3 · Qty (Kg/L)', '3', 'max 5,000'); ok('with no line picked the Kg box shows as before', /3 · Qty \(Kg\/L\)/.test(h) && /packForm\.kg=this\.value/.test(h) && /placeholder="max 5,000"/.test(h));
  c.state.orders[0].lines[0].pack = 0; c.packForm = { bid: 'B1', oid: 'O14', lid: 'A', kg: '225' };
  ok('a line with no pack size keeps the Kg box', /Q<\/label>/.test(c.packQtyHTML('pack', 'packForm', 'kg', 'Q', '3', '')));
  eq('...and passes the gate', c.packConfirmGate(c.packForm, 'pack'), ''); }
{ const c = box(st()); c.lfForm = { po: '23215', lid: 'D', kg: '' }; c.lineFacts = () => ({ gap: 40, ordered: 1000, logged: 0 });
  ok('Write the packing record: the default is shown in packs', /value="40"/.test(c.packQtyHTML('lf', 'lfForm', 'kg', 'Quantity (Kg)', '', ''))); }

/* independent review fixes (26 Nov): no excess is cut, divert keeps small packs, a new line clears the quantity, Today names the size */
{ const c = box(st()); c.state.batches[0].left = 10.6; c.packForm = { bid: 'B1', oid: 'O15', lid: 'D', kg: '11' };
  ok('batch has 10.6 Kg left, 11 packs of 1 Kg typed: refused (no 0.4 Kg cut into a part pack)', /Only 10 whole packs can be packed here/.test(c.packConfirmGate(c.packForm, 'pack'))); }
{ const c = box(st()); c.state.orders[1].lines[1].pack = 0.5; c.state.orders[1].lines[1].ordered = 10; c.packForm = { bid: 'B1', oid: 'O15', lid: 'D', kg: '10.5' };
  ok('0.5 Kg packs, the line needs 10, 21 packs typed: refused, not cut to 20', /Only 20 whole packs can be packed here/.test(c.packConfirmGate(c.packForm, 'pack'))); }
{ const c = box(st()); c.state.orders[1].lines[1].pack = 0.5; c.state.batches.push({ id: 'PL', plannedKg: 100 }); c.divForm = { poolId: 'PL', oid: 'O15', lid: 'D', qty: '1.5' };
  const k = c.packEntryCalc(c.divForm, 'div'); eq('divert with 0.5 Kg packs keeps 1.5 Kg (3 packs), not rounded to 2', k.typed, 1.5); eq('...and passes', c.packConfirmGate(c.divForm, 'div'), ''); }
ok('submitDivert does not round whole packs to a whole Kg', /if\(packSizeOf\(l\)>0\)\{ qty=Math\.round\(\(\+divForm\.qty\|\|0\)\*1000\)\/1000;/.test(grab('submitDivert')));
ok('Divert and Add missing packing clear the quantity on a new line', /onchange="packQtyReset\(divForm,'qty',/.test(html) && /packQtyReset\(dfForm,'qty',dfForm\.oid,this\.value\)/.test(grab('dfLineSelect')));
ok('a batch made for a PO no longer pre-fills the packs on a line with a pack size', /if\(!\(packSizeOf\(hit\.l\)>0\)\) packForm\.kg=Math\.max\(0,/.test(grab('openPackFor')));
{ const c = Object.assign({ console, String, RegExp, seedPackForBrand: () => 0, unitOf: () => 'Kg' }); vm.createContext(c);
  vm.runInContext(['packFmt', 'packSizeOf', 'packSizeTxt', '_tdWhat'].map(grab).join('\n') + '\nfunction _tdEsc(x){ return String(x); } function _tdPo(o){ return o.po; } function _tdClient(o){ return o.client; }', c);
  const it = { label: 'Pack from base', o: { po: '23214', client: 'Maxim' }, l: { brand: 'Max Sulfur', pack: 10 }, what: 'x' };
  eq('the Today card reads brand, pack size, PO, customer', c._tdWhat(it), 'Max Sulfur · 10 Kg pack · 23214 · Maxim');
  ok('...a Ship job is not changed', c._tdWhat(Object.assign({}, it, { label: 'Ship' })) === 'Max Sulfur · 23214 · Maxim'); }

/* second review (27 Nov): no-size lines keep their figure; pool, Add missing packing and Write the packing record refuse any excess */
ok('picking a line clears the quantity only when the line has a pack size', /function packQtyReset\(f,field,oid,lid\)\{[^\n]*if\(packSizeOf\(l\)>0\) f\[field\]='';/.test(html) && /^function packPickPO\(v\)\{ packQtyReset\(packForm,'kg'/.test(grab('packPickPO')));
{ const c = box(st()); vm.runInContext(grab('packQtyReset'), c); c.state.orders[0].lines[0].pack = 0; const f = { kg: '50' };
  c.packQtyReset(f, 'kg', 'O14', 'A'); eq('a line with no pack size keeps the batch figure', f.kg, '50'); c.packQtyReset(f, 'kg', 'O15', 'D'); eq('a line with a pack size starts empty', f.kg, ''); }
ok('divert refuses more than the pool by any amount on a pack-size line', /if\(qty>avail\+0\.001\)\{ toast\('Quantity must be ≤ '/.test(grab('submitDivert')) && /typed>\(\+pl\.plannedKg\|\|0\)\+\(\(packSizeOf\(l\)>0\)\?0\.001:0\.5\)/.test(grab('packEntryCalc')));
ok('Add missing packing refuses any excess over the line and the batch on a pack-size line', (grab('dfSubmitPacking').match(/\(\(packSizeOf\(l\)>0\)\?0\.001:0\.5\)/g) || []).length === 2);
ok('Write the packing record refuses any excess over the gap and the batch on a pack-size line', (grab('lineFixRecord').match(/\(\(packSizeOf\(l\)>0\)\?0\.001:0\.5\)/g) || []).length === 2);
{ const c = box(st()); c.state.orders[1].lines[1].pack = 0.2; c.state.batches.push({ id: 'PL', plannedKg: 10 }); c.divForm = { poolId: 'PL', oid: 'O15', lid: 'D', qty: '10.4' };
  ok('pool 10, 0.2 Kg packs, 10.4 typed: the packs line says it will be refused', /more than the pool has/.test(c.packConfirmInner(c.divForm, 'div'))); }

/* the read-and-sign brief (Tahir approved the text 27 Nov) */
{ const m = /\{id:'2026-11-26b', title:'Packing: pack size on every line, whole packs only \(26 Nov\)', roles:\[([^\]]*)\]/.exec(html);
  ok('a new brief 2026-11-26b for Production, Production Manager, Plant Manager, QA Inspector and COO', !!m && /'Production','Production Manager','Plant Manager','QA Inspector','COO'/.test(m[1]));
  ok('...its packing part asks the 225 cartons question, right answer first', /You packed 225 cartons of Max Sulfur 1 Kg\. Which line do you pick and what do you type\?',o:\['The 1 Kg pack line, and type 225'/.test(html));
  ok('...its QA part says do not pass a wrong pack size', /If they are not that size, do not pass it; tell the Production Manager the entry is on the wrong pack size line\./.test(html));
  ok('...the 15 Oct brief text is not changed', /You still type Kg\/L\. If the PO line has a pack size, the screen shows the <b>number of packs<\/b>, and you tick that this is what was packed\./.test(html)); }

/* wired in */
const pk = grab('renderPackModal');
ok('the Pack sheet lists PO lines with packPoOptions and keeps the closed-short and linked notes', /packPoOptions\(poOpts,packForm\.oid,packForm\.lid,function\(x\)\{ return \(lineShortClosed\(x\.l\)/.test(pk) && /' · linked'/.test(pk));
ok('the Pack sheet quantity box is packQtyHTML', /packQtyHTML\('pack','packForm','kg','3 · Qty \(Kg\/L\)','3'/.test(pk));
ok('Divert uses the same list and box', /packPoOptions\(poOpts,divForm\.oid,divForm\.lid\)/.test(html) && /packQtyHTML\('div','divForm','qty'/.test(html));
ok('the run sheet, Add missing packing and Write the packing record use the box', /packQtyHTML\('pq','pqForm','qty'/.test(html) && /packQtyHTML\('df','dfForm','qty'/.test(html) && /packQtyHTML\('lf','lfForm','kg'/.test(html));
ok('the old tick text is gone from the packs line', !/Tick this box to continue/.test(grab('packConfirmInner')) && !/tick below/.test(grab('packConfirmInner')));
ok('Add missing packing shows the size on the product and the note on the PO', /\$\{l\.brand\}\$\{packSizeTxt\(l\)\?\(' · '\+packSizeTxt\(l\)\):''\}/.test(grab('dfLineSelect')) && /packNoteTxt\(o\)/.test(grab('dfPOSelect')));
ok('the Today Pack from base card names the pack size', /what:'Pack '\+l\.brand\+\(packSizeTxt\(l\)\?\(' · '\+packSizeTxt\(l\)\):''\)\+' from base — '\+o\.po/.test(html));
ok('QA Awaiting, Cleared, the row and the inspection sheet name the pack size', (grab('screenQA').match(/packSizeTxt\(/g) || []).length >= 6 && /<b>\$\{l\.brand\}<\/b>\$\{packSizeTxt\(l\)/.test(grab('renderPackInspect')));
ok('Guide rule R-004 says whole packs', /you type the <b>number of whole packs<\/b> packed/.test(grab('guideRules')) && !/the box must be ticked again/.test(html));
ok('My job note for Production, Production Manager, Plant Manager, QA Inspector, COO', /New on 26 Nov \(2026-11-26b\)/.test(grab('guideMyJob')));
ok('change log 2026-11-26b says it', /ver:'2026-11-26b'/.test(html) && /Pack size on every pick, and whole packs only/.test(html));
ok('BUILD_ID of the build form (2026-11-26b or later) and SYSDOC_VER follows', (function () { var m = html.match(/var BUILD_ID='(2026-\d\d-\d\d[a-z])';/); return !!m && m[1] >= '2026-11-26b' && html.indexOf("var SYSDOC_VER='" + m[1] + "'") >= 0; })());
ok('documentation carries D-380', /"D-380"/.test(html));
report('2026-11-26b: pack size on every pick, whole packs only');
