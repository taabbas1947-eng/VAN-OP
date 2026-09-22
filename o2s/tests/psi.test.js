/* Pre-shipment inspection report — the consignment-scoping checks.
 *
 * The one thing this document must never do is name material that was not on
 * the truck. Three different join keys were tried while it was being built and
 * the first two both leaked; each leak is pinned here so it cannot come back.
 *
 *   PO + product        -> DSP1556 picked up batch RUOK26004, 25,000 Kg that
 *                          never left on that vehicle.
 *   internal batch      -> DSP1469 picked up Enrich and V-Transfarm, because
 *                          one bulk batch (VT10396) is packed under several
 *                          brands.
 *   pack batch (right)  -> one product's one packed lot.
 *
 * Run against the real snapshot in data/state.json, so the counts printed are
 * the counts that snapshot actually produces.
 */
const path = require('path');
const vm = require('vm');
const fs = require('fs');
const H = require('./harness.js');
const { ok, eq, report, grab } = H;

const state = JSON.parse(fs.readFileSync(H.STATE, 'utf8')).data;

/* the report's own helpers, pulled out of the app — no second copy here */
const src = ['psiPackNo', 'psiDetailFor', 'psiLinesFor', 'psiCOAsFor', 'dispatchGroups',
             'shipStageOf', 'linePackSize', 'seedPackForBrand']
  .map(n => { try { return grab(n); } catch (e) { return ''; } }).join('\n\n');

const sandbox = {
  console, state, Date,
  fmt: n => String(n),
  shipClientFor: () => '',
  SEED: { brandMap: {} },
  _pe: x => String(x == null ? '' : x),
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const { psiDetailFor, psiLinesFor, psiCOAsFor, dispatchGroups, psiPackNo } = sandbox;

const groups = dispatchGroups();
ok('the snapshot has consignments to check', groups.length > 0, groups.length + ' groups');

/* ---- psiPackNo prefers the number printed on the bag ---- */
eq('pack number wins over the internal batch',
   psiPackNo({ batch: 'VT10320', brand: 'MAXZ10320' }), 'MAXZ10320');
eq('falls back to the internal batch when no pack number was recorded',
   psiPackNo({ batch: 'RUOK26005', brand: '' }), 'RUOK26005');
eq('an empty entry yields nothing to match on', psiPackNo(null), '');

/* ---- THE INVARIANT: nothing on the sheet may reference off-truck material ---- */
let printed = 0, refused = 0, leaks = [];
groups.forEach(g => {
  const det = psiDetailFor(g);
  if (!det) { refused++; return; }
  printed++;

  const onTruck = new Set();
  const products = new Set();
  (g.rows || []).forEach(r => {
    if (r.brand) products.add(r.brand);
    (r.batches || []).forEach(b => {
      if (b && b.brand) onTruck.add(String(b.brand).trim());
      if (b && b.batch) onTruck.add(String(b.batch).trim());
    });
  });

  if (det.src === 'packed') {
    (det.recs || []).forEach(x => {
      if (!products.has(x.brand)) leaks.push(g.dispId + ': foreign product ' + x.brand);
      /* the record may legitimately span other batches; what matters is that
         at least one of its batches is on this truck, and that the display
         filter (det.want) would drop the rest */
      const mine = (x.batches || []).filter(b => det.want[psiPackNo(b)]);
      if (!mine.length) leaks.push(g.dispId + ': record with no batch on this truck');
    });
  }

  psiCOAsFor(g).forEach(z => {
    if (!onTruck.has(z.batchNo)) leaks.push(g.dispId + ': COA for off-truck batch ' + z.batchNo);
    z.packNos.forEach(pn => {
      if (!onTruck.has(pn)) leaks.push(g.dispId + ': COA pack batch ' + pn + ' not on this truck');
    });
    z.products.forEach(pr => {
      if (!products.has(pr)) leaks.push(g.dispId + ': COA product ' + pr + ' not on this truck');
    });
  });

  psiLinesFor(g).forEach(L => {
    if (L.packNo && !onTruck.has(L.packNo)) leaks.push(g.dispId + ': consignment line ' + L.packNo);
  });
});

ok('no report references material that was not on its truck', leaks.length === 0,
   leaks.length + ' leak(s): ' + leaks.slice(0, 5).join(' | '));
ok('some consignments produce a report', printed > 0, printed + ' printed');
ok('a consignment with no recorded inspection produces none', refused > 0,
   refused + ' refused of ' + groups.length);

/* ---- the legacy stub must never be treated as an inspection ---- */
const stub = groups.find(g => (g.rows || []).every(r => r.qa && !(r.qa.checklist || []).length));
if (stub) {
  const det = psiDetailFor(stub);
  ok('a {pass:true} stub is never reported as a truck-level check',
     !det || det.src !== 'truck', det ? det.src : 'null');
}

/* ---- a truck-level check, once one exists, wins over the packing fallback ---- */
{
  const g = JSON.parse(JSON.stringify(groups.find(x => psiLinesFor(x).length > 0)));
  g.rows.forEach(r => {
    r.qa = { pass: true, by: 'Ahtsham Ali', date: '2026-09-21',
             checklist: [{ item: 'Packaging intact & correct', result: 'pass' }],
             verify: [{ item: 'Price on the pack is correct', result: 'pass' }], remarks: '' };
  });
  const det = psiDetailFor(g);
  eq('the truck-level check is preferred once captured', det && det.src, 'truck');
  eq('and it carries the inspector who signed it', det && det.by, 'Ahtsham Ali');
}

/* ---- quantities on the consignment table are the truck's, not the batch's ---- */
groups.slice(0, 25).forEach(g => {
  const lines = psiLinesFor(g);
  const lineTot = lines.reduce((a, L) => a + (+L.kg || 0), 0);
  const rowTot = (g.rows || []).reduce((a, r) => a + (+r.kg || 0), 0);
  ok('consignment lines total the shipment for ' + g.dispId,
     Math.abs(lineTot - rowTot) < 1, lineTot + ' vs ' + rowTot);
});

/* ---------------------------------------------------------------------------
 * What the printed sheet may and may not carry — Tahir, 22 Sept 2026.
 *
 * printPSI builds its document as a STRING, so the whole sheet can be rendered
 * and read here with no browser and no dependencies. These are asserted against
 * the real output, not against the source: "searching the file for a button is
 * not proof the button appears".
 * ------------------------------------------------------------------------- */
const vm2 = require('vm');
const psiSrc = ['psiPackNo', 'psiSig', 'psiInternalOnly', 'psiSafeRef', 'psiDetailFor',
                'psiLinesFor', 'psiCOAsFor', 'printPSI', 'dispatchGroups', 'shipStageOf',
                'linePackSize', 'seedPackForBrand']
  .map(n => { try { return grab(n); } catch (e) { return ''; } }).join('\n\n');

function renderSheet(stateObj, dispId) {
  let html = '';
  const win = { open: () => ({ document: { write: h => { html += h; }, close() {} }, focus() {} }) };
  const box = {
    console, state: stateObj, Date,
    window: win,
    toast: () => {},
    fmt: n => String(n),
    _pe: x => String(x == null ? '' : x),
    _isRoleName: nm => ['coo', 'qcm', 'aqcm', 'lab rep', 'qa inspector', 'plant manager', 'administrator']
      .indexOf(String(nm || '').trim().toLowerCase()) > -1,
    sigName: s => String((s && s.name) || ''),
    shipClientFor: () => '',
    SEED: { brandMap: {} },
    VAN_LOGO_REAL: 'data:,',
    TODAY: new Date('2026-09-22'),
  };
  box.globalThis = box;
  vm2.createContext(box);
  vm2.runInContext(psiSrc, box);
  box.printPSI(dispId);
  return html;
}

const clone = o => JSON.parse(JSON.stringify(o));

/* a consignment that renders, given a truck-level check carrying a real price
   reading — the shape dispQASubmit writes when the inspector types what the bag
   actually said */
const st = clone(state);
const gsAll = (function () {
  const box = { console, state: st, Date, fmt: String, shipClientFor: () => '', SEED: { brandMap: {} } };
  box.globalThis = box; vm2.createContext(box);
  vm2.runInContext(psiSrc, box);
  return box.dispatchGroups();
})();
const target = gsAll.find(g => (g.rows || []).some(r => (r.batches || []).length));
const CHECKS = ['Packaging intact & correct', 'Label / artwork correct', 'Net weight / count verified',
  'Seal & closure OK', 'Cleanliness — no contamination', 'Batch & expiry printed',
  'No leakage / damage', 'Pallet / loading condition'];
const qaOf = (pass) => ({
  pass, fail: !pass, by: 'Ahtsham Ali', date: '2026-09-21',
  checklist: CHECKS.map((it, i) => ({ item: it, result: (!pass && i === 6) ? 'fail' : 'pass' })),
  /* the price row carries a NUMBER, never pass/fail */
  verify: [{ item: 'Price on the pack is correct', result: '1450' },
           { item: 'Batch # on the pack matches the record', result: 'pass' },
           { item: 'Mfg & expiry on the pack match the record', result: 'pass' }],
  remarks: 'Seal checked at gate.',
});

st.shipments.forEach(r => { if (r.dispId === target.dispId) r.qa = qaOf(true); });
const sheet = renderSheet(st, target.dispId);

ok('the sheet renders', sheet.length > 500, sheet.length + ' chars');

/* --- no price, anywhere, ever --- */
ok('the price the inspector read off the bag never reaches the sheet',
   sheet.indexOf('1450') < 0);
ok('no currency or MRP anywhere on the sheet',
   !/PKR|\bRs\.?\s*\d|\bMRP\b|per pack|\/pack/i.test(sheet),
   (sheet.match(/.{0,40}(PKR|Rs\.?\s*\d|MRP|per pack|\/pack).{0,25}/i) || [''])[0]);
ok('the price CHECK itself still appears, as a result and not a figure',
   /Price on the pack is correct/.test(sheet) && /VERIFIED/.test(sheet));

/* --- the dispatch approver is not printed --- */
ok('no dispatch "Approved by" signature block', !/class="signs"/.test(sheet));
{
  const ap = (target.rows[0] && target.rows[0].approvedBy) || target.approvedBy;
  if (ap) ok('the dispatch approver name is not printed', sheet.indexOf('>' + ap + '<') < 0, ap);
}

/* --- the sheet ends by naming both documents and their signatories --- */
ok('it closes with the certification block', /Certification &mdash; which document, and who signed it/.test(sheet));
ok('it names the pre-shipment inspection', /PRE-SHIPMENT INSPECTION<\/div>/.test(sheet));
ok('it names the certificate of analysis', /CERTIFICATE OF ANALYSIS<\/div>/.test(sheet));
ok('it says who signed the inspection', /Inspected and signed by <b>Ahtsham Ali<\/b>/.test(sheet));
/* The three offices are named ONCE, side by side, not per certificate —
   Tahir, 22 Sept 2026: "the COA is signed by positions, so no matter who the
   person is it's always the same positions." Repeating them per certificate
   said nothing new seven times and cost a page. */
ok('it names the three offices that sign a certificate',
   /ANALYSED BY|Analysed by/.test(sheet) && /Reviewed by/i.test(sheet) && /Approved by/i.test(sheet));
ok('and names them once, not once per certificate',
   (sheet.match(/class="sgt">Approved by</g) || []).length === 1,
   (sheet.match(/class="sgt">Approved by</g) || []).length + ' signature labels');
ok('they are laid out side by side', /class="sgrow"/.test(sheet) && (sheet.match(/class="sg"/g) || []).length === 3);
ok('the customer still gets a line to sign for receipt', /Received by \(customer\)/.test(sheet));
ok('"Approved by" on the sheet belongs to the COA, not the dispatch',
   (sheet.match(/class="sgt">Approved by</g) || []).length
     === (sheet.match(/class="sgt">Analysed by</g) || []).length);

/* --- a failed load is never stamped as cleared --- */
st.shipments.forEach(r => { if (r.dispId === target.dispId) r.qa = qaOf(false); });
const failSheet = renderSheet(st, target.dispId);
ok('a failed consignment is stamped FAILED', /<div class="b">FAILED<\/div>/.test(failSheet));
ok('and is never stamped cleared for dispatch',
   !/>CLEARED FOR DISPATCH</.test(failSheet.replace(/NOT CLEARED FOR DISPATCH/g, '')));
ok('and says so in a banner at the top', /class="failbar"/.test(failSheet));

/* --- nothing is certified when nothing was recorded --- */
st.shipments.forEach(r => { if (r.dispId === target.dispId) r.qa = { pass: true, closed: true }; });
const stubState = clone(st); stubState.inspections = [];
ok('a legacy {pass:true} stub with no packing inspection prints nothing',
   renderSheet(stubState, target.dispId) === '');

/* ---------------------------------------------------------------------------
 * NO INTERNAL BATCH NUMBER ON ANYTHING THAT LEAVES THE BUILDING
 * Tahir, 22 Sept 2026 — across every outgoing document, not just the report.
 *
 * VAN runs two numbering systems: the number on the bag (`b.brand` —
 * VAN6FU003, MAXH26003) and the internal production batch (`b.batch` —
 * VU26140, HG26015). The customer's world is the bag.
 *
 * Checked by rendering each document and reading it. Token-exact, never
 * substring: pack batch VMG10412 CONTAINS internal batch MG10412 and reading
 * that as a leak is how a false positive gets chased for ten minutes.
 * ------------------------------------------------------------------------- */
const DOCS = ['printDC', 'printGatePass', 'printPSI', 'printPO'];
const docSrc = ['psiPackNo', 'psiSig', 'psiInternalOnly', 'psiSafeRef', 'psiDetailFor',
                'psiLinesFor', 'psiCOAsFor', 'dispatchGroups', 'shipStageOf', 'linePackSize',
                'seedPackForBrand', 'lotBaseNo', 'lotBrandNo',
                'printDoc', '_docHead', 'printPolicy', 'printPolicyOL',
                'poLineFor', 'printInspect', 'printInspectPriceRule'].concat(DOCS)
  .map(n => { try { return grab(n); } catch (e) { return ''; } }).join('\n\n');

function docBox(stateObj) {
  let html = '';
  const box = {
    console, state: stateObj, Date,
    window: { open: () => ({ document: { write: h => { html += h; }, close() {} }, focus() {} }) },
    toast: () => {}, fmt: n => String(n),
    _pe: x => String(x == null ? '' : x),
    _at: x => String(x == null ? '' : x),
    _isRoleName: () => true,
    sigName: s => String((s && s.name) || ''),
    shipClientFor: () => '', SEED: { brandMap: {} },
    VAN_LOGO_REAL: 'data:,', VAN_FOOTER: 'VAN', TODAY: new Date('2026-09-22'),
    mrpTagFor: () => '', qcExpect: () => ({ price: '', batch: '', dates: '' }),
    evLag: () => null, _tx: x => String(x || ''), _DOC_CSS: '',
  };
  box.globalThis = box;
  vm2.createContext(box);
  vm2.runInContext(docSrc, box);
  return { box, read: () => { const h = html; html = ''; return h; } };
}

{
  const st2 = clone(state);
  /* every consignment gets a gate pass, or that document never renders and the
     check silently passes on nothing — the suite's own warning about stubs */
  st2.shipments.forEach(r => { if (!r.gatePass) r.gatePass = 'GP-TEST'; });
  const { box, read } = docBox(st2);
  const groups = box.dispatchGroups();

  const interesting = groups.filter(g => (g.rows || []).some(r => (r.batches || []).some(x =>
    x.batch && x.brand && String(x.batch).trim() !== String(x.brand).trim())));
  ok('the snapshot has consignments where the internal number differs from the pack number',
     interesting.length > 0, interesting.length + ' of ' + groups.length);

  const leaks = { printDC: [], printGatePass: [], printPSI: [], printPO: [] };
  let rendered = { printDC: 0, printGatePass: 0, printPSI: 0, printPO: 0 };
  const docErr = {};
  interesting.forEach(g => {
    const hidden = Object.keys(box.psiInternalOnly(g));
    if (!hidden.length) return;
    DOCS.forEach(fn => {
      read();
      try { fn === 'printPO' ? box[fn]((g.pos && g.pos[0]) || g.po) : box[fn](g.dispId); }
      catch (e) { docErr[fn] = docErr[fn] || e.message; return; }
      const html = read();
      if (!html) return;
      rendered[fn]++;
      const text = html.replace(/<[^>]*>/g, ' ');
      const toks = new Set(text.match(/[A-Za-z0-9][A-Za-z0-9\-]*/g) || []);
      hidden.forEach(n => { if (toks.has(n)) leaks[fn].push(g.dispId + ':' + n); });
    });
  });
  DOCS.forEach(fn => {
    ok(fn + ' renders for these consignments', rendered[fn] > 0,
       rendered[fn] + ' rendered' + (docErr[fn] ? ' — ' + docErr[fn] : ''));
    ok(fn + ' prints no internal production batch number', leaks[fn].length === 0,
       leaks[fn].length + ' leak(s): ' + leaks[fn].slice(0, 4).join(', '));
  });
}

/* the QC No guard — two of 142 certificates have a production batch typed into
   the lab-reference field, and printing it unchecked leaked VU26140 */
{
  const { box } = docBox(clone(state));
  eq('a QC No that is an internal batch is dropped',
     box.psiSafeRef('VU26140', { VU26140: 1 }), '');
  eq('a genuine lab reference still prints',
     box.psiSafeRef('PQ0726', { VU26140: 1 }), 'PQ0726');
  eq('a batch that is also the number on the bag is not hidden',
     box.psiSafeRef('RUOK26005', {}), 'RUOK26005');
}

/* the signatory block names the office, and does not label it twice */
ok('signatories carry no "(position)" marker', sheet.indexOf('(position)') < 0);
ok('the office that approves is still named on the sheet',
   /class="sgn">[^<]*[A-Za-z]/.test(sheet));

/* ---------------------------------------------------------------------------
 * PRINTING AND PDF — Tahir, 22 Sept 2026: "by default it should be A4".
 *
 * These read the generated document, which is the artifact that gets printed,
 * so they are not a grep of the app source. Where the paper actually divides
 * was checked by rendering a real PDF (4 pages for DSP1469, the worst
 * consignment on file) and looking at it; what a string check can hold is that
 * the rules which produced those breaks are still in the document.
 * ------------------------------------------------------------------------- */
{
  ok('the report declares A4', /@page\{size:A4/.test(sheet));
  ok('and sets its own margin rather than leaving it to the browser',
     /@page\{size:A4;margin:0\}/.test(sheet) && /\.sheet\{[^}]*padding:14mm/.test(sheet));

  /* a heading stranded at the foot of a page with its content overleaf */
  ok('a section heading never ends a page', /h2\.sec\{page-break-after:avoid/.test(sheet));
  ok('the multi-lot note stays with the certificates it explains',
     /\.srcnote\{page-break-after:avoid/.test(sheet));
  ok('a certificate header stays with its own table',
     /\.coah\{page-break-after:avoid/.test(sheet));

  /* a table crossing a break */
  ok('column headings repeat on a table that crosses a page break',
     /thead\{display:table-header-group\}/.test(sheet));
  ok('a row is never cut through the middle',
     /tr\{page-break-inside:avoid/.test(sheet));

  /* blocks that mean nothing when halved */
  ['insblk', 'coablk', 'crow', 'recv', 'parties', 'rem'].forEach(c => {
    ok('.' + c + ' is not split across pages',
       new RegExp('[.,]' + c + '[,{][^}]*page-break-inside:avoid').test(sheet), c);
  });

  /* every page identifies itself — these pages get separated */
  ok('a running footer is emitted', /class="runfoot"/.test(sheet));
  ok('it repeats on every printed page', /\.runfoot\{display:block;position:fixed/.test(sheet));
  ok('it is hidden on screen', /\.runfoot\{display:none\}/.test(sheet));
  ok('it carries the report number', /class="runfoot"[\s\S]{0,200}PSI-/.test(sheet));
  ok('the sheet leaves room for it so nothing runs underneath',
     /\.sheet\{padding-bottom:22mm\}/.test(sheet));
}

/* the other outgoing documents are A4 too, and degrade the same way when an
   order finally runs past one page */
{
  const st3 = clone(state);
  st3.shipments.forEach(r => { if (!r.gatePass) r.gatePass = 'GP-TEST'; });
  const { box, read } = docBox(st3);
  const g = box.dispatchGroups().find(x => (x.rows || []).length);
  [['printDC', 'Delivery Challan'], ['printGatePass', 'Gate Pass']].forEach(([fn, label]) => {
    read();
    try { box[fn](g.dispId); } catch (e) { /* reported by the next check */ }
    const html = read();
    ok(label + ' renders', html.length > 500, html.length + ' chars');
    ok(label + ' declares A4', /@page\{size:A4/.test(html));
    ok(label + ' repeats column headings across a page break',
       /thead\{display:table-header-group\}/.test(html));
    ok(label + ' never cuts a row in half', /tr\{page-break-inside:avoid/.test(html));
  });
}

/* ---------------------------------------------------------------------------
 * TWO DOCUMENTS, ONE NAME — they differ by content, not by title.
 *
 * Tahir, 22 Sept 2026: "printInspect is both actually... if internal, it should
 * only be the inspection report. If for customer, then it's going to stitch the
 * COA and the other things." And on the title: "the internal document is titled
 * PRE-SHIPMENT INSPECTION REPORT is fine" — both are exactly that.
 *
 * So the line these checks hold is the CONTENT one: the PO-level record is the
 * inspection and nothing else; the consignment copy is the one that stitches.
 * ------------------------------------------------------------------------- */
{
  const st4 = clone(state);
  const { box, read } = docBox(st4);
  const poWithInspection = (st4.inspections || []).map(x => x.po).find(Boolean);
  ok('the snapshot has a PO with a recorded inspection', !!poWithInspection, poWithInspection);

  read();
  let internal = '';
  try { box.printInspect(poWithInspection); internal = read(); } catch (e) { internal = 'ERR ' + e.message; }

  ok('the PO-level inspection record renders', internal.length > 400, internal.slice(0, 90));
  ok('it says which of the two documents it is',
     /<b>Inspection record only<\/b>/.test(internal));
  ok('it points to where the customer copy comes from',
     /issued to a customer is produced per consignment/.test(internal));

  /* the content line: the record does not stitch */
  ok('it does not stitch in the certificates of analysis',
     !/Laboratory analysis/i.test(internal));
  ok('it offers the customer no line to sign',
     !/Received by \(customer\)/i.test(internal));
  ok('it carries no closing certification block',
     !/which document, and who signed it/i.test(internal));

  /* and the consignment copy does all three */
  ok('the customer copy stitches in the certificates', /Laboratory analysis/i.test(sheet));
  ok('the customer copy carries the closing certification block',
     /which document, and who signed it/i.test(sheet));
  ok('the customer copy gives the customer a line to sign',
     /Received by \(customer\)/i.test(sheet));
}

/* ---------------------------------------------------------------------------
 * WHAT GOES ON THE CUSTOMER COPY — Tahir's rulings, 22 Sept 2026.
 * Full lab results stay. The inspector's free-text remarks come off: written
 * for the floor, unreviewed, and they read oddly on a certificate. A complaint
 * line goes on, carrying the reference to quote.
 * ------------------------------------------------------------------------- */
{
  ok('full lab results stay on the customer copy',
     /Specification/.test(sheet) && /Method/.test(sheet) && /FIT/.test(sheet));
  ok('every inspection check is still listed, not summarised',
     (sheet.match(/PASS|VERIFIED/g) || []).length >= 8);
  ok('mfg and expiry stay on each consignment line',
     />Mfg</.test(sheet) && />Expiry</.test(sheet));
  ok('vehicle stays on the customer copy', /Vehicle #/.test(sheet));

  /* the remarks were on it and are not any more */
  ok('the inspector\'s free-text remarks are NOT on the customer copy',
     !/Inspector&rsquo;s remarks|Inspector\u2019s remarks/.test(sheet)
       && sheet.indexOf('Seal checked at gate') < 0);

  ok('a complaint line is present', /class="claim"/.test(sheet));
  ok('it tells the customer what reference to quote',
     /class="claim"[\s\S]{0,260}PSI-/.test(sheet));
  ok('it carries the published phone, WhatsApp and email',
     /\+92 42 35762215/.test(sheet) && /\+92 300 5003041/.test(sheet)
       && /info@van\.com\.pk/.test(sheet));

  /* a failed load still prints, and still cannot read as a clearance */
  ok('a failed consignment still produces a report', failSheet.length > 500);
  ok('and is stamped FAILED', /<div class="b">FAILED<\/div>/.test(failSheet));
}

/* ---------------------------------------------------------------------------
 * "expected PKR x /pack — we have to solve this" — Tahir, 22 Sept 2026.
 *
 * SPEC-01 rule 6 puts what the pack was REQUIRED to carry on the inspection
 * sheet, so the document is evidence of a comparison and not a bare tick. That
 * stays. The rupee amount does not: the check is "does this pack carry the
 * price this PO authorises", and the answer to that is a rule, not a number.
 *
 * qcExpect() itself is untouched — renderPackInspect and renderDispatchQA both
 * need to show the inspector the figure to check against. Those are screens.
 * This is the printed sheet.
 * ------------------------------------------------------------------------- */
{
  const st5 = clone(state);
  const { box, read } = docBox(st5);

  /* the rule line carries no figure in any policy mode */
  const modes = [
    ['no price on this pack',   { printDecision: 'no' },                         { printPrice: 0 }],
    ['a price is required',     { printDecision: 'yes', printOnPack: true },     { printPrice: 1450 }],
    ['price set but not on PO', { printOnPack: true },                           { printPrice: 0 }],
    ['nothing recorded',        {},                                              { printPrice: 0 }],
  ];
  const o0 = (st5.orders || [])[0];
  modes.forEach(([label, oPatch, lPatch]) => {
    const o = JSON.parse(JSON.stringify(o0));
    delete o.printDecision; delete o.printOnPack;
    Object.assign(o, oPatch);
    const l = Object.assign({}, o.lines[0], lPatch);
    /* strip the markup first: a CSS colour like #b4231b is digits, not a price */
    const out = String(box.printInspectPriceRule(o, l)).replace(/<[^>]*>/g, '');
    ok('the price rule states ' + label + ' without a figure',
       !/\d{3,}|PKR|\bRs\b/.test(out), out);
  });

  /* and the whole printed sheet carries no price, with a price set on every
     line and a numeric reading recorded against every inspection */
  (st5.orders || []).forEach((o, i) => {
    (o.lines || []).forEach(l => { l.printPrice = 1450 + i; });
    o.printDecision = 'yes'; o.printOnPack = true;
  });
  (st5.inspections || []).forEach(x => {
    x.verify = [{ item: 'Price on the pack is correct', result: '1450' }];
  });
  const pos = [...new Set((st5.inspections || []).map(x => x.po))].filter(Boolean);
  let rendered = 0; const leaks = [];
  pos.forEach(po => {
    read();
    try { box.printInspect(po); } catch (e) { return; }
    const html = read(); if (!html) return;
    rendered++;
    const text = html.replace(/<[^>]*>/g, ' ');
    if (/PKR|\bRs\.?\s*\d|\/pack|\b14[5-9]\d\b/.test(text)) {
      leaks.push(po + ': ' + (text.match(/.{0,45}(PKR|Rs\.?\s*\d|\/pack|14[5-9]\d).{0,25}/) || [''])[0].trim());
    }
  });
  ok('the PO-level inspection sheet renders for these POs', rendered > 0, rendered + ' rendered');
  ok('and prints no price, with a price set on every line and a reading on every inspection',
     leaks.length === 0, leaks.length + ' leak(s): ' + leaks.slice(0, 3).join(' | '));

  /* structural: the rule function cannot emit the figure even in a mode this
     snapshot never produces, because it never reads it */
  const src = grab('printInspectPriceRule');
  ok('the price rule function never reads the price at all',
     !/\.price/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'references pol.price');

  /* the requirement itself is still on the sheet — this is SPEC-01 rule 6 */
  read(); box.printInspect(pos[0]); const one = read();
  ok('what the pack was required to carry is still stated', /Required on the pack/.test(one));
  ok('including the batch it was required to show', /batch:/.test(one));
}

report('Pre-shipment inspection report');
