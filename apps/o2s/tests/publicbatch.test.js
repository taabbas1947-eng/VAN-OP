/* THE PUBLIC LAB REPORT CHECK — 3 October 2026. apps/o2s/public-routes.js, Tahir's rulings of that day:
   the farmer types the number printed on the bag and gets that batch's approved QC report, in O2S's own
   QCL-FRM-12.03 design; every batch in O2S; a report only when every lot is approved; the newest
   financial year answers. On the report: Mfg./Exp. date, test details, issue date and revision, all 6
   table columns incl. FIT/UNFIT and Overall, signature ROLES AND DATES, and the APPROVER'S NAME when O2S
   holds one. Never: item name, source, Q.C. No., quantity, who received the sample, the analyst's and
   reviewer's names, the deviation note, the internal numbers.
   Made-up records only, so it runs anywhere. Run: node publicbatch.test.js */
const path = require('path'), fs = require('fs'), os = require('os');
const R = require(path.join(__dirname, '..', 'public-routes.js'));
let pass = 0, fail = 0;
const ok = (c, what) => { if (c) pass++; else { fail++; console.log('  FAIL  ' + what); } };
const eq = (a, b, what) => ok(JSON.stringify(a) === JSON.stringify(b), what + '  (got ' + JSON.stringify(a) + ', wanted ' + JSON.stringify(b) + ')');

const coa = (status, tests, extra) => Object.assign({ status, type: 'Batch', issueDate: '2026-09-20', issueStatus: '1', rev: 0, approvedDate: '2026-09-20',
  item: 'Secret Product', source: 'Secret Source Co', batchNo: 'HG26001-L1', quantity: '9999', qcNo: 'SC0007', sampledBy: 'Sampler Person',
  mfgDate: 'Sep-2026', expDate: 'Sep-2028', dateOfTest: '2026-09-19', analysisTime: '2 hours', temp: '25', humidity: '40', sampleQty: '250 g', receivingDate: '2026-09-18',
  overall: 'FIT', remarks: 'internal note', analyst: { name: 'Analyst Person', date: '2026-09-19' }, reviewer: { name: 'Reviewer Person', date: '2026-09-19' },
  approver: { name: 'Approver Person', date: '2026-09-20' }, recordedBy: 'Recorder Person', tests }, extra || {});
const T = (test, spec, result, remark) => ({ g: 'Chemical', test, spec, method: 'Kjeldahl', mu: '0.2', result, remark });
const lot = (id, date, c) => ({ id, lotNo: 'HG' + id, qty: 1000, incharge: 'Shift Incharge', date, coa: c });
const pk = (id, brand, num, batchId, extra) => Object.assign({ id, brand, brandBatchNo: num, baseBatchId: batchId, baseBatchNo: 'HG' + batchId,
  kg: 1000, po: 'PO-SECRET', lid: 'L1', mfgDate: '2026-09-10', date: '2026-09-12', printPrice: 4321, by: 'Packer Person' }, extra || {});

const data = {
  masters: { products: [{ brand: 'Vital Urea', owner: 'VAN' }, { brand: 'Client Brand', owner: 'Maxim', wl: true }] },
  orders: [{ id: 'O1', po: 'PO-SECRET', client: 'Secret Customer', lines: [{ id: 'L1', pack: 50 }] }],
  batches: [
    { id: 'B1', batchNo: 'HG26001', lots: [lot('B1-L2', '2026-09-11', coa('approved', [T('N *', '>=32%', '32.9%', 'FIT')], { approvedDate: '2026-09-22', mfgDate: 'Oct-2026' })),
                                           lot('B1-L1', '2026-09-10', coa('approved', [T('N *', '>=32%', '32.4%', 'FIT')]))] },
    { id: 'B2', batchNo: 'HG26002', lots: [lot('B2-L1', '2026-09-10', coa('reviewed', [T('N *', '>=32%', '33%', 'FIT')]))] },
    { id: 'B3', batchNo: 'HG26003', lots: [lot('B3-L1', '2026-09-10', coa('approved', [T('K2O *', '>=30%', '29.1%', 'UNFIT')], { overall: 'UNFIT', deviation: true, deviationNote: 'accepted by PM', deviationBy: 'Plant Manager Person' }))] },
    { id: 'B4', batchNo: 'HG26004', lots: [lot('B4-L1', '2026-09-10', coa('approved', [T('N *', '>=20%', '20.5%', 'FIT')], { approver: { name: 'QCM', user: 'qcm', date: '2026-09-20' } }))] },
    { id: 'B5', batchNo: 'HG25009', lots: [lot('B5-L1', '2025-08-01', coa('approved', [T('N *', '>=32%', '31%', 'FIT')], { approvedDate: '2025-08-05' }))] },
    { id: 'B6', batchNo: 'HG26006', lots: [lot('B6-L1', '2026-09-10', coa('approved', [T('N *', '>=32%', '32%', 'FIT')])), lot('B6-L2', '2026-09-11', null)] },
    { id: 'B7', batchNo: 'HG26007', lots: [lot('B7-L1', '2026-09-10', coa('approved', [T('N *', '>=32%', '32%', 'FIT')])), lot('B7-L2', '2026-09-11', coa('approved', [T('N *', '>=32%', '31.5%', 'UNFIT')], { overall: 'UNFIT' }))] },
    { id: 'B8', batchNo: 'HG26008', lots: [lot('B8-L1', '2026-09-10', coa('approved', [T('N *', '>=32%', '31.2%', 'UNFIT')], { overall: 'UNFIT' })), lot('B8-L2', '2026-09-11', coa('approved', [T('N *', '>=32%', '32.6%', 'FIT')])), lot('B8-L3', '2026-09-12', coa('approved', [T('N *', '>=32%', '32.8%', 'FIT')]))] },
    { id: 'B9', batchNo: 'HG26009', lots: [lot('B9-L1', '2026-09-10', coa('approved', [T('N *', '>=32%', '31.1%', 'UNFIT')], { overall: 'UNFIT' })), lot('B9-L2', '2026-09-11', coa('approved', [T('N *', '>=32%', '31.4%', 'UNFIT')], { overall: 'UNFIT' }))] } ],
  packingLog: [
    pk('P1', 'Vital Urea', 'vu 26101', 'B1'),                                   // 2 lots, both approved
    pk('P2', 'Vital Urea', 'VU26102', 'B2'),                                    // lab report not approved yet
    pk('P3', 'Vital Urea', 'VU26103', 'B3'),                                    // accepted deviation
    pk('P4', 'Client Brand', 'MAXB26001', 'B4'),                                // client brand
    pk('P5', 'Vital Urea', 'VU26104', 'B1', { void: true }),                    // void only: nothing
    pk('P6', 'Vital Urea', 'VU26105', 'B5', { mfgDate: '2025-08-01' }),         // FY 2025-26, older
    pk('P7', 'Vital Urea', 'VU26105', 'B4', { mfgDate: '2026-08-01' }),         // FY 2026-27, newest: answers
    pk('P8', 'Vital Urea', 'VU26106', 'B6'),                                    // 1 lot approved, 1 lot not tested
    pk('P9', 'Vital Urea', 'VU26107', 'B7'),                                    // lot 1 FIT, lot 2 UNFIT
    pk('P10', 'Vital Urea', 'VU26108', 'B8'),                                   // lot 1 UNFIT, lots 2 and 3 FIT
    pk('P11', 'Vital Urea', 'VU26109', 'B9') ],                                 // no FIT lot
  inspections: [] };

const idx = R._buildIndex(data);
console.log('Public lab report check');
// 1. What the farmer types, and which batches have a report
ok(!!idx.get('VU26101'), 'the printed number answers, stored as "vu 26101" and typed as VU26101');
ok(!idx.get('HG26001'), 'the internal production number is never accepted');
ok(!idx.get('VU26102'), 'a lab report not yet approved: no report');
ok(!idx.get('VU26106'), '1 lot approved and 1 not tested: no report until every lot is approved');
ok(!!idx.get('MAXB26001'), 'a client-brand batch has its report (every batch in O2S)');
ok(!idx.get('VU26104'), 'a number with only void packing: no report');
eq(idx.get('VU26105').approved_on, '2026-09-20', 'a number reused across financial years answers with the newest year');
// 2. What a report carries: the fields Tahir chose, nothing else
eq(Object.keys(idx.get('VU26101')).sort(), ['approved_on', 'batch', 'lots'], 'a batch carries only its number, approval date and lots');
eq(Object.keys(idx.get('VU26101').lots[0]).sort(), ['analysisTime', 'approvedOn', 'dateOfTest', 'expDate', 'humidity', 'issueDate', 'issueStatus', 'mfgDate',
  'overall', 'receivingDate', 'representative', 'rev', 'sampleQty', 'signed', 'supersedesDate', 'supersedesRev', 'temp', 'tests', 'type'], 'a lot carries only the chosen report fields');
eq(Object.keys(idx.get('VU26101').lots[0].tests[0]).sort(), ['group', 'method', 'mu', 'remark', 'result', 'spec', 'test'], 'a test carries the 6 report columns and its group');
eq(idx.get('VU26101').lots[0].signed, { analysed: '2026-09-19', reviewed: '2026-09-19', approved: '2026-09-20', approvedBy: 'Approver Person' }, 'signatures: dates, and the approver\'s name');
eq(idx.get('MAXB26001').lots[0].signed.approvedBy, '', 'an approver recorded only as a role ("QCM", a shared login): no name, the box shows the role');
eq(idx.get('VU26101').lots.map(l => l.approvedOn), ['2026-09-20', '2026-09-22'], 'lots in production order, each with its own approval date');
// 3. Deviation: the lab's own FIT/UNFIT stays, the Plant Manager's acceptance does not
eq(idx.get('VU26103').lots[0].tests[0].remark, 'UNFIT', 'an out-of-spec test shows UNFIT, as the lab recorded it');
eq(idx.get('VU26103').lots[0].overall, 'UNFIT', 'and Overall shows UNFIT');
eq(idx.get('VU26103').lots[0].tests[0].result, '29.1%', 'the real result, not altered');
// 4. The summary of several lots (Tahir, 3 Oct): the first FIT lot's own report, no ranges
const s1 = R._summaryCoa(idx.get('VU26101'));
eq(s1.lotOf, [1, 2], 'all lots FIT: the summary is lot 1 of 2');
eq(s1.tests[0].result, '32.4%', 'its own result, not a range');
eq(s1.signed.approvedBy, 'Approver Person', 'with its own approver');
const s7 = R._summaryCoa(idx.get('VU26107'));
eq(s7.lotOf, [1, 2], 'lot 1 FIT, lot 2 UNFIT: lot 1');
const s8 = R._summaryCoa(idx.get('VU26108'));
eq(s8.lotOf, [2, 3], 'lot 1 UNFIT, lots 2 and 3 FIT: lot 2, the first FIT lot');
eq([s8.overall, s8.tests[0].result], ['FIT', '32.6%'], 'and lot 2 own Overall and result');
const s9 = R._summaryCoa(idx.get('VU26109'));
eq(s9.lotOf, [1, 2], 'no FIT lot: the first lot');
eq(s9.overall, 'UNFIT', 'shown as UNFIT, as the lab recorded it');
// 5. Nothing private in anything that leaves
const everything = JSON.stringify([...idx.values()]) + JSON.stringify([s1, s7, s8, s9]);
['PO-SECRET', 'Secret Customer', 'Secret Product', 'Secret Source', 'SC0007', '9999', 'Vital Urea', 'Client Brand', 'Maxim', 'HG26', 'HG25',
 'Analyst Person', 'Reviewer Person', 'Sampler Person', 'Recorder Person', 'Plant Manager Person', 'Packer Person',
 'Shift Incharge', '4321', 'internal note', 'accepted by PM', 'deviation', '"50"']
  .forEach(s => ok(!everything.includes(s), 'nothing that leaves contains "' + s + '"'));
// 6. The PDF builds in both layouts
(async () => {
  for (const layout of ['summary', 'per-lot']) {
    const f = path.join(os.tmpdir(), `publicbatch-${layout}.pdf`);
    await new Promise(res => { const s = fs.createWriteStream(f); s.status = () => s; s.set = () => s; s.on('finish', res); R._writeReport(s, idx.get('VU26107'), layout); });
    const pdf = fs.readFileSync(f, 'latin1');
    ok(pdf.startsWith('%PDF-') && pdf.length > 3000, layout + ': a PDF is produced');
    ok(/\/Encrypt\s+\d+ 0 R/.test(pdf) && /\/V 5/.test(pdf) && /\/CFM \/AESV3/.test(pdf) && /\/R [56]\b/.test(pdf), layout + ': encrypted with AES-256 (V5, AESV3)');    const P = +((pdf.match(/\/P (-?\d+)/) || [])[1]);
    ok((P & 4) && (P & 2048), layout + ': printing allowed (high resolution)');
    ok(!(P & 16) && !(P & 512), layout + ': copying and text extraction refused');
    ok(!(P & 8) && !(P & 32) && !(P & 1024), layout + ': editing, comments and page extraction refused');
    eq((pdf.match(/\/Type \/Page[^s]/g) || []).length, layout === 'per-lot' ? 2 : 1, layout + ': ' + (layout === 'per-lot' ? '1 page per lot' : '1 page for the batch'));
    fs.unlinkSync(f);
  }
  // 7. Text drawn as shapes (Tahir, 3 Oct): the PDF holds no text a converter could turn into Word.
  //    Checked on an UNENCRYPTED, uncompressed page so the content can be read: no text operators at all.
  const PDFDocument = require('pdfkit'); const chunks = [];
  const d = new PDFDocument({ compress: false }); d.on('data', c => chunks.push(c));
  Object.entries(R._fontBuffers()).forEach(([n, b]) => d.registerFont(n, b)); R._drawTextAsShapes(d);
  d.font('Serif-Bold').fontSize(12).text('QUALITY ANALYSIS REPORT · EX-HG26027 · 41.12%', 50, 50, { width: 400, align: 'center', underline: true });
  await new Promise(res => { d.on('end', res); d.end(); });
  const raw = Buffer.concat(chunks).toString('latin1');
  ok(!/\bT[jJ]\b/.test(raw) && !/\bBT\b/.test(raw), 'shape text: no text operators (BT/Tj/TJ) in the page');
  ok((raw.match(/\bf\b/g) || []).length > 30, 'shape text: the letters are drawn as filled shapes');
  ok(!raw.includes('QUALITY') && !raw.includes('41.12'), 'shape text: the words themselves are nowhere in the file');
  console.log(`${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
})();
