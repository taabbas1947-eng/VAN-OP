/* O2S · public lab report check for van.com.pk — 3 October 2026
 *
 * A farmer types the batch number from his bag and gets that batch's approved lab report (COA). Nothing else.
 * Tahir's rulings, 3 Oct 2026:
 *   - The number searched is the one PRINTED ON THE BAG (packingLog.brandBatchNo). The internal production
 *     number and the internal lot numbers are never accepted and never shown.
 *   - Every batch in O2S can be checked, VAN's and clients'.
 *   - The report is O2S's own QC report, form QCL-FRM-12.03 "Quality Analysis Report" (o2s.html
 *     printCOA), with: Batch No. (the printed number), Mfg./Exp. date, the test details (date of test,
 *     analysis time, temperature, humidity, sample quantity, receiving date), issue date and revision,
 *     all 6 table columns including Remarks (FIT/UNFIT) and Overall, the disclaimer, and the 3
 *     signature boxes with ROLES AND DATES. The APPROVER'S NAME is added in the Approved By box when O2S
 *     holds a person's name (a role word such as "QCM", from a shared login, is not a name: the box then
 *     shows the role only). The analyst's and reviewer's names are never shown.
 *     Left out: item name, source, Q.C. No. (built from the customer's name), quantity, who received
 *     the sample, the analyst's and reviewer's names, and the "Deviation accepted by Plant Manager" line.
 *   - A report exists only when every production lot behind the number has an approved COA.
 *   - A number used in 2 financial years (July to June) answers with the newest year's batch.
 *   - Several lots behind 1 number: UNDER DISCUSSION. Both are built; REPORT_LAYOUT picks one:
 *       per-lot  1 QC report per lot, as O2S issues them
 *       summary  (default) 1 QC report: the first FIT lot's, in production order (the first lot if
 *                none is FIT), marked "Results of production lot i of n of this batch" (Tahir, 3 Oct)
 *
 * Read-only. Nothing here writes O2S data. Only the fields named above are copied out of a COA.
 *
 *   GET /api/public/batch/:batch             200 {batch, approved_on, report_url} · 404 empty
 *   GET /api/public/batch/:batch/report.pdf  200 PDF · 404 empty
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');

// Browsers may call these routes only from the website. PUBLIC_EXTRA_ORIGINS (comma-separated, empty on
// Render) adds a local test address, e.g. http://localhost:8099, for testing a copy of the site on a PC.
const ALLOWED_ORIGINS = ['https://van.com.pk', 'https://www.van.com.pk']
  .concat(String(process.env.PUBLIC_EXTRA_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
const RATE = { windowMs: 10 * 60 * 1000, max: 60 };   // 60 lookups per visitor per 10 minutes
const layoutOf = () => (process.env.REPORT_LAYOUT === 'per-lot' ? 'per-lot' : 'summary');

const norm = s => String(s || '').trim().toUpperCase().replace(/\s+/g, '');
const VALID = /^[A-Z0-9-]{3,20}$/;
const iso = s => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)) ? s.slice(0, 10) : null;
const str = v => (v == null ? '' : String(v).trim());
// O2S's financial year (o2s.html fyKey): July to June, named by its starting year.
const fyStart = ds => { const d = new Date(ds); if (isNaN(d)) return -1; return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; };
const live = p => !p.void && !p.reversed;
const approved = l => !!(l && l.coa && l.coa.status === 'approved');

/* ---- index of reportable batch numbers, rebuilt only when O2S's revision changes ---- */
let cache = { rev: null, index: null };
async function getIndex(store) {
  const rev = await store.getRev();
  if (cache.rev === rev && cache.index) return cache.index;
  const st = await store.getState();
  cache = { rev, index: buildIndex((st && st.data) || {}) };
  return cache.index;
}

function buildIndex(d) {
  const batches = new Map((d.batches || []).map(b => [b.id, b]));
  // o2s.html _isRoleName: a "name" that is only a role (signed on a shared login) is not a person's name.
  const roleNames = new Set(['coo', 'ceo', 'cfo', 'kam', 'qcm', 'aqcm', 'lab rep', 'qa inspector', 'plant manager', 'supply chain', 'production', 'administrator', 'admin']
    .concat((d.users || []).map(u => String(u.role || '').trim().toLowerCase()))
    .concat((((d.masters || {}).roles) || []).map(r => String((r && r.name) || '').trim().toLowerCase())).filter(Boolean));
  const personName = sig => { const nm = str(sig && sig.name); return nm && !roleNames.has(nm.toLowerCase()) ? nm : ''; };
  const groups = new Map();   // printed number -> financial year -> live packing rows
  (d.packingLog || []).forEach(p => {
    const n = norm(p.brandBatchNo); if (!n || !live(p)) return;
    const fy = fyStart(p.mfgDate || p.date);
    if (!groups.has(n)) groups.set(n, new Map());
    const byFy = groups.get(n); if (!byFy.has(fy)) byFy.set(fy, []); byFy.get(fy).push(p);
  });
  const index = new Map();
  groups.forEach((byFy, n) => {
    const rows = byFy.get(Math.max(...byFy.keys()));
    // Every lot of every production batch packed under this number, in production order.
    const lots = [...new Set(rows.map(p => p.baseBatchId))].map(id => batches.get(id)).filter(Boolean)
      .flatMap(b => b.lots || []).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    if (!lots.length || !lots.every(approved)) return;   // no approved report yet: answers as not found
    const dates = lots.map(l => iso(l.coa.approvedDate)).filter(Boolean).sort();
    index.set(n, { batch: n, approved_on: dates[dates.length - 1] || null, lots: lots.map(l => publicCoa(l.coa, personName)) });
  });
  return index;
}
// The ONLY fields of a COA that ever leave the server. A whitelist: anything not named here stays inside.
function publicCoa(c, personName) {
  const sigDate = s => (s && s.date ? str(s.date) : '');
  return {
    type: str(c.type), issueDate: str(c.issueDate), issueStatus: str(c.issueStatus), rev: +c.rev || 0,
    supersedesRev: c.supersedes && c.supersedes.rev != null ? +c.supersedes.rev : null,
    supersedesDate: c.supersedes && c.supersedes.approvedDate ? str(c.supersedes.approvedDate) : '',
    representative: !!c.repOf,
    mfgDate: str(c.mfgDate), expDate: str(c.expDate), dateOfTest: str(c.dateOfTest), analysisTime: str(c.analysisTime),
    temp: str(c.temp), humidity: str(c.humidity), sampleQty: str(c.sampleQty), receivingDate: str(c.receivingDate),
    overall: str(c.overall), approvedOn: iso(c.approvedDate),
    signed: { analysed: sigDate(c.analyst), reviewed: sigDate(c.reviewer), approved: sigDate(c.approver) || str(c.approvedDate),
              approvedBy: personName ? personName(c.approver) : '' },   // Tahir, 3 Oct: the approver's name only; '' when O2S holds just a role
    tests: (c.tests || []).filter(t => t && str(t.test)).map(t => ({ group: str(t.g), test: str(t.test), spec: str(t.spec),
      result: str(t.result), method: str(t.method), mu: str(t.mu), remark: str(t.remark) })),
  };
}

/* ---- the summary layout for several lots (Tahir, 3 Oct 2026): the report of the FIRST FIT lot, in
   production order, as O2S issued it; the first lot when no lot is FIT. A line on the report says which
   lot of how many it is. No ranges across lots. ---- */
function summaryCoa(b) {
  const i = b.lots.findIndex(l => /^\s*FIT\s*$/i.test(l.overall)), k = i >= 0 ? i : 0;
  return Object.assign({}, b.lots[k], { lotOf: [k + 1, b.lots.length] });
}
/* ---- the PDF: O2S's QC report, form QCL-FRM-12.03, drawn with pdfkit ---- */
const DISCLAIMER = ['This test result is based solely on the particular sample supplied by the client. VAN QC Lab doesn’t involve in any type of sampling activity.',
  'The results are reported with a confidence level of 95%; i.e. [K=2] and are pertaining to analyzed sample(s) only.',
  'Provided sample will be retained for 01-month period after reporting date of the result unless otherwise as agreed with the customer.',
  'The reproducibility of sample is only applicable on the same retained sample.',
  'The test report shall not be reproduced except in full, without written approval by the laboratory.',
  'The uncertainty of this parameter has been calculated by laboratory and will be reported as per client instructions.',
  'The result would be declared “OK” or “Not OK” as per desire/declaration of the client in accordance with the decision rule given below.',
  'Test Result(s) mentioned with * (Asterisk) is/are Accredited by ISO/IEC 17025:2017.'];   // as printed by o2s.html printCOA
const BLUE = '#0a4b8c', PNAC_GREEN = '#1a8a3c', GRID = '#999999';
// Fonts with letter outlines (Tahir, 3 Oct 2026: text drawn as shapes, so the report cannot be converted
// into editable Word text). Tinos = Times New Roman widths, Arimo = Arial/Helvetica widths; both SIL OFL.
const T = 'Serif', TB = 'Serif-Bold', TI = 'Serif-Italic', S = 'Sans', SB = 'Sans-Bold';
const FONT_FILES = { [T]: '@fontsource/tinos/files/tinos-latin-400-normal.woff', [TB]: '@fontsource/tinos/files/tinos-latin-700-normal.woff',
  [TI]: '@fontsource/tinos/files/tinos-latin-400-italic.woff', [S]: '@fontsource/arimo/files/arimo-latin-400-normal.woff',
  [SB]: '@fontsource/arimo/files/arimo-latin-700-normal.woff' };
let FONT_BUFFERS = null;
const fontBuffers = () => FONT_BUFFERS || (FONT_BUFFERS = Object.fromEntries(Object.entries(FONT_FILES).map(([k, f]) => [k, fs.readFileSync(require.resolve(f))])));
// Replaces pdfkit's own text writer for this document: the line is laid out exactly as pdfkit laid it out
// (same font, size, kerning and alignment), but each letter is drawn as its outline, so the PDF holds no text.
function drawTextAsShapes(doc) {
  const glyphCache = new Map();
  doc._fragment = function (text, x, y, options) {
    text = String(text).replace(/\n/g, ''); if (!text) return;
    const align = options.align || 'left';
    if (options.width) {
      if (align === 'right') x += options.lineWidth - this.widthOfString(text.replace(/\s+$/, ''), options);
      else if (align === 'center') x += options.lineWidth / 2 - options.textWidth / 2;
    }
    const size = this._fontSize, fk = this._font.font, baseline = y + this._font.ascender / 1000 * size;
    if (options.underline) {
      const lw = size < 10 ? 0.5 : Math.floor(size / 10), ly = y + this.currentLineHeight() - lw;
      this.save(); this.strokeColor(...(this._fillColor || [])); this.lineWidth(lw).moveTo(x, ly).lineTo(x + options.textWidth, ly).stroke(); this.restore();
    }
    const run = fk.layout(text), k = size / fk.unitsPerEm; let pen = x;
    run.glyphs.forEach((g, i) => {
      const p = run.positions[i], key = this._font.name + ':' + g.id;
      if (!glyphCache.has(key)) glyphCache.set(key, g.path.toSVG());
      const d = glyphCache.get(key);
      if (d) { this.save(); this.translate(pen + p.xOffset * k, baseline - p.yOffset * k).scale(k, -k); this.path(d).fill(); this.restore(); }
      pen += p.xAdvance * k;
    });
  };
}
const ascii = s => String(s || '').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/°/g, '°').replace(/[^\x20-\x7E·°]/g, '');   // the built-in fonts print ASCII, the middle dot and the degree sign
const longDate = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi' });

let LOGO = null;   // the vector logo O2S prints on the QC report (apps/o2s/qc-report-logo.svg)
function logo() {
  if (LOGO) return LOGO;
  const svg = fs.readFileSync(path.join(__dirname, 'qc-report-logo.svg'), 'utf8');
  const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1].split(/\s+/).map(Number);
  const rgb = v => { const m = v && v.match(/rgb\(([\d.]+)%,\s*([\d.]+)%,\s*([\d.]+)%\)/); return m ? [m[1], m[2], m[3]].map(x => Math.round(x * 2.55)) : null; };
  const paths = (svg.match(/<path[^>]*>/g) || []).map(p => { const a = k => (p.match(new RegExp(' ' + k + '="([^"]*)"')) || [])[1];
    const tr = a('transform'); return { d: a('d'), fill: rgb(a('fill')), stroke: rgb(a('stroke')), sw: +a('stroke-width') || 0,
      m: tr ? tr.match(/matrix\(([^)]+)\)/)[1].split(/[\s,]+/).map(Number) : null }; });
  return (LOGO = { vb, paths });
}
function drawLogo(doc, x, y, w) {
  const { vb, paths } = logo(); const s = w / vb[2];
  doc.save(); doc.translate(x, y).scale(s).translate(-vb[0], -vb[1]);
  paths.forEach(p => { doc.save(); if (p.m) doc.transform(...p.m); doc.path(p.d);
    if (p.fill) doc.fillColor(p.fill).fill(); else if (p.stroke) doc.lineWidth(p.sw).strokeColor(p.stroke).stroke(); doc.restore(); });
  doc.restore();
  return vb[3] * s;
}

function writeReport(res, b, layout) {
  const stamp = `VAN Lab · Batch ${b.batch} · downloaded ${longDate(new Date())} · van.com.pk · LAB 336`;
  // Protection (Tahir, 3 Oct 2026): AES-256, opens and prints freely; copying, editing, comments, page
  // extraction and text extraction (what converters use) refused. The owner password is random per
  // download and never kept, so nobody can lift the restrictions the normal way. Readers honour these
  // flags; they are not absolute against special tools, which is why every page also carries the
  // watermark and the download stamp.
  const doc = new PDFDocument({ size: 'A4', margins: { top: 28, bottom: 40, left: 28, right: 28 }, bufferPages: true,
    pdfVersion: '1.7ext3', ownerPassword: crypto.randomBytes(24).toString('hex'),
    permissions: { printing: 'highResolution', modifying: false, copying: false, annotating: false, fillingForms: false,
                   contentAccessibility: false, documentAssembly: false },
    info: { Title: `Quality Analysis Report ${b.batch}`, Author: 'Vital Agri Nutrients Quality Control Laboratory', Subject: 'QCL-FRM-12.03' } });
  res.status(200).set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="VAN-${b.batch}-quality-analysis-report.pdf"`, 'Cache-Control': 'no-store' });
  doc.pipe(res);
  Object.entries(fontBuffers()).forEach(([name, buf]) => doc.registerFont(name, buf));
  drawTextAsShapes(doc);
  // Watermark, drawn first on every page so it sits behind the report.
  const watermark = () => { const cx = doc.page.width / 2, cy = doc.page.height / 2;
    doc.save(); doc.rotate(-38, { origin: [cx, cy] }).fillColor('#8a94a3').fillOpacity(0.16);
    doc.font(SB).fontSize(46).text(ascii(`VAN LAB · ${b.batch}`), cx - 300, cy - 40, { width: 600, align: 'center', lineBreak: false });
    doc.font(S).fontSize(20).text('Verified copy from van.com.pk', cx - 300, cy + 18, { width: 600, align: 'center', lineBreak: false });
    doc.restore(); doc.fillOpacity(1); doc.x = doc.page.margins.left; doc.y = doc.page.margins.top; };
  watermark(); doc.on('pageAdded', watermark);
  const coas = layout === 'per-lot' ? b.lots.map((c, i) => ({ c, label: b.lots.length > 1 ? `lot ${i + 1} of ${b.lots.length}` : '' }))
    : [{ c: b.lots.length === 1 ? b.lots[0] : summaryCoa(b), label: '' }];
  coas.forEach((x, i) => { if (i) doc.addPage(); drawCoa(doc, b.batch, x.c, x.label); });
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const keep = doc.page.margins.bottom; doc.page.margins.bottom = 0;   // the stamp sits in the margin; without this pdfkit opens a new page
    doc.font(T).fontSize(7.5).fillColor('#333').text(ascii(stamp) + (range.count > 1 ? `  ·  page ${i + 1} of ${range.count}` : ''),
      doc.page.margins.left, doc.page.height - 26, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right, align: 'center', lineBreak: false });
    doc.page.margins.bottom = keep;
  }
  doc.end();
}

function drawCoa(doc, batchNo, c, lotLabel) {
  const X = doc.page.margins.left, W = doc.page.width - X - doc.page.margins.right, BOTTOM = () => doc.page.height - doc.page.margins.bottom;
  let y = doc.page.margins.top, segTop = y;
  const hline = (yy, w) => doc.moveTo(X, yy).lineTo(X + W, yy).lineWidth(w || 1).strokeColor('#111').stroke();
  const closeSheet = () => doc.rect(X, segTop, W, y - segTop).lineWidth(1.5).strokeColor('#111').stroke();
  const ensure = h => { if (y + h > BOTTOM()) { closeSheet(); doc.addPage(); y = segTop = doc.page.margins.top; return true; } return false; };
  const txt = (s, x, yy, w, o) => doc.text(ascii(s), x, yy, Object.assign({ width: w, lineBreak: true }, o || {}));

  // 1. Head: logo · title · document control · PNAC badge
  const wl = 108, wd = 102, wa = 68, wc = W - wl - wd - wa, hh = 62;
  const lv = logo().vb, lh = lv[3] * (wl - 14) / lv[2];   // the logo's height at this width
  drawLogo(doc, X + 7, y + (hh - lh) / 2, wl - 14);
  doc.fillColor(BLUE).font(TB).fontSize(12.5); txt('QUALITY ANALYSIS REPORT', X + wl, y + 12, wc, { align: 'center' });
  doc.fillColor('#111').font(TB).fontSize(8.5); txt('Vital Agri Nutrients Quality Control Laboratory', X + wl, y + 30, wc, { align: 'center' });
  doc.font(T).fontSize(8); txt('Lahore, Pakistan.', X + wl, y + 41, wc, { align: 'center' });
  doc.font(T).fontSize(7.5).fillColor('#111');
  [['DOC #:', 'QCL-FRM-12.03'], ['REV NO.:', '03'], ['Issue Date:', 'June 10, 2025']].forEach(([k, v], i) => {
    txt(k + ' ', X + wl + wc + 5, y + 12 + i * 12, wd - 8, { continued: true }); doc.font(TB).text(v, { underline: true }); doc.font(T); });
  const ax = X + wl + wc + wd;
  doc.ellipse(ax + wa / 2, y + 14, 25, 9).fillColor(PNAC_GREEN).fill();
  doc.fillColor('#ffffff').font(SB).fontSize(9); txt('PNAC', ax, y + 10, wa, { align: 'center' });
  doc.fillColor('#111').font(T).fontSize(5); txt('Pakistan National Accreditation Council', ax + 3, y + 25, wa - 6, { align: 'center' });
  doc.rect(ax + 10, y + 40, wa - 20, 16).lineWidth(0.75).strokeColor('#111').stroke();
  doc.font(TB).fontSize(6.5); txt('LAB 336', ax + 10, y + 41.5, wa - 20, { align: 'center' }); txt('17025', ax + 10, y + 48.5, wa - 20, { align: 'center' });
  [wl, wl + wc, wl + wc + wd].forEach(dx => doc.moveTo(X + dx, y).lineTo(X + dx, y + hh).lineWidth(1).strokeColor('#111').stroke());
  y += hh; hline(y, 1.5);

  // 2. Report type
  const box = (bx, by, on) => { doc.rect(bx, by, 7, 7).lineWidth(0.6).strokeColor('#111').stroke();
    if (on) doc.moveTo(bx + 1.3, by + 3.8).lineTo(bx + 3, by + 5.6).lineTo(bx + 5.8, by + 1.3).lineWidth(1).strokeColor('#111').stroke(); };
  const types = [['Raw Material', c.type === 'Raw Material'], ['Batch Analysis', c.type === 'Batch' || !c.type || /Batch/.test(c.type)], ['Outside Sample', c.type === 'Outside Sample']];
  doc.font(T).fontSize(8.5); const tw = types.reduce((s, [k]) => s + 12 + doc.widthOfString(k) + 22, 0); let tx = X + (W - tw) / 2;
  types.forEach(([k, on]) => { box(tx, y + 5, on); doc.fillColor('#111').text(k, tx + 11, y + 4.5, { lineBreak: false }); tx += 12 + doc.widthOfString(k) + 22; });
  y += 17; hline(y);

  // 3. Issue line (and the revision note a replacing report must carry)
  doc.font(TB).fontSize(8.5).fillColor('#111');
  const issue = [['Issue Date:', c.issueDate], ['Issue status:', c.issueStatus]].concat(c.rev != null ? [['Revision:', String(c.rev)]] : []);
  let ix = X + 8; issue.forEach(([k, v]) => { doc.font(TB).text(k, ix, y + 4, { lineBreak: false }); ix += doc.widthOfString(k) + 3;
    doc.font(T).text(ascii(v || '-'), ix, y + 4, { lineBreak: false }); ix += doc.widthOfString(ascii(v || '-')) + 18; });
  y += 15; hline(y);
  const banner = s => { doc.font(TB).fontSize(8.5); const h = doc.heightOfString(ascii(s), { width: W - 16 }) + 7; ensure(h);
    txt(s, X + 8, y + 3.5, W - 16); y += h; hline(y); };
  if (c.lotOf) banner(`Results of production lot ${c.lotOf[0]} of ${c.lotOf[1]} of this batch.`);
  if (c.supersedesRev != null) banner(`Revision ${c.rev} - supersedes Revision ${c.supersedesRev}${c.supersedesDate ? ' issued ' + c.supersedesDate : ''}`);

  // 4. Details (2 columns, values underlined as on the printed form)
  const left = [['Batch No.', batchNo + (lotLabel ? '  (' + lotLabel + ')' : '')], ['Mfg. Date:', c.mfgDate], ['Analysis Time:', c.analysisTime], ['Temperature °C:', c.temp]];
  const right = [['Exp. Date:', c.expDate], ['Receiving Date:', c.receivingDate], ['Sample Quantity:', c.sampleQty], ['Date of Test:', c.dateOfTest], ['Humidity %:', c.humidity]];
  const col = (items, cx, cw) => { let yy = y + 5; items.forEach(([k, v]) => { doc.font(T).fontSize(8.5).fillColor('#111');
    const kw = doc.widthOfString(k) + 4; doc.text(k, cx, yy, { lineBreak: false });
    const val = ascii(v || ''); const vh = doc.heightOfString(val || ' ', { width: cw - kw - 4 });
    doc.text(val || ' ', cx + kw, yy, { width: cw - kw - 4 }); doc.moveTo(cx + kw - 1, yy + vh + 0.5).lineTo(cx + cw - 6, yy + vh + 0.5).lineWidth(0.5).strokeColor('#888').stroke();
    yy += Math.max(12.5, vh + 3); }); return yy; };
  const yEnd = Math.max(col(left, X + 8, W / 2 - 8), col(right, X + W / 2 + 4, W / 2 - 8));
  y = yEnd + 4; hline(y, 1.5);
  if (c.representative) banner('Results from a representative lot of this batch, as recorded by the laboratory.');

  // 5. Test table
  const cols = [{ h: 'Test', w: 0.22 }, { h: 'Specs', w: 0.17 }, { h: 'Results', w: 0.17 }, { h: 'Methods', w: 0.19 }, { h: 'MU (%)', w: 0.1 }, { h: 'Remarks', w: 0.15 }].map(k => ({ h: k.h, w: k.w * W }));
  const row = (cells, opt) => { doc.font(opt && opt.bold ? TB : T).fontSize(8.5);
    const h = Math.max(...cells.map((s, i) => doc.heightOfString(ascii(s) || ' ', { width: (opt && opt.span ? W : cols[i].w) - 8 }))) + 5;
    if (ensure(h)) drawHead();
    if (opt && opt.fill) doc.rect(X, y, W, h).fillColor(opt.fill).fill();
    if (opt && opt.span) { doc.rect(X, y, W, h).lineWidth(0.6).strokeColor(GRID).stroke(); doc.fillColor('#111').font(TB); txt(cells[0], X + 4, y + 2.5, W - 8); }
    else { let x = X; cells.forEach((s, i) => { doc.rect(x, y, cols[i].w, h).lineWidth(0.6).strokeColor(GRID).stroke();
      doc.fillColor('#111'); txt(s, x + 4, y + 2.5, cols[i].w - 8, opt && opt.center ? { align: 'center' } : {}); x += cols[i].w; }); }
    y += h; };
  const drawHead = () => row(cols.map(k => k.h), { bold: true, fill: '#f0f0f0', center: true });
  drawHead();
  let lastG = null;
  c.tests.forEach(t => { if (t.group !== lastG) { lastG = t.group; row([(t.group || '').toUpperCase() + ' PARAMETER'], { span: true, fill: '#fafafa' }); }
    row([t.test, t.spec, t.result, t.method, t.mu, t.remark]); });

  // 6. Disclaimer, MU, decision rule
  doc.font(T).fontSize(6.8);
  const items = DISCLAIMER.map((s, i) => `${i + 1}. ${s}`).concat(['MU Stand for: Measurement of Uncertainty.',
    'Decision Rule: If the sum of the result and uncertainty is more than the specified/claimed/permissible limit, the sample will be declared as OK and vice versa.']);
  const dh = items.reduce((s, it) => s + doc.heightOfString(ascii(it), { width: W - 20 }) + 1, 0) + 20;
  ensure(dh); hline(y, 1.5);
  doc.font(TB).fontSize(8).fillColor('#111'); txt('Report Disclaimer', X, y + 4, W, { align: 'center' });
  let dy = y + 15; doc.font(T).fontSize(6.8);
  items.forEach((it, i) => { const bold = i >= DISCLAIMER.length; const k = bold ? it.split(':')[0] + ':' : '';
    if (bold) { doc.font(TB).text(k, X + 10, dy, { continued: true }); doc.font(T).text(ascii(it.slice(k.length)), { width: W - 20 }); }
    else txt(it, X + 10, dy, W - 20);
    dy = doc.y + 1; });
  y = dy + 4;

  // 7. Signatures: roles and dates; the approver's name only (Tahir, 3 Oct), when O2S holds one
  ensure(52); hline(y, 1.5);
  const sw = W / 3; [['Analysed By', 'Lab Rep', c.signed.analysed, ''], ['Reviewed By', 'AQCM', c.signed.reviewed, ''], ['Approved By', 'QCM', c.signed.approved, c.signed.approvedBy]]
    .forEach(([k, role, dt, nm], i) => { const sx = X + i * sw; if (i) doc.moveTo(sx, y).lineTo(sx, y + 50).lineWidth(1).strokeColor('#111').stroke();
      // Rows, the same in all 3 boxes so they line up: label · name (approver only, Tahir 3 Oct: below the label) · role · date
      doc.fillColor('#111').font(TB).fontSize(8.5); txt(k, sx, y + 6, sw, { align: 'center' });
      if (nm) { doc.font(TB).fontSize(9); txt(nm, sx + 4, y + 17, sw - 8, { align: 'center' }); }
      doc.font(T).fontSize(7.5); txt(role, sx, y + 29, sw, { align: 'center' }); txt('Date: ' + (dt || '-'), sx, y + 38, sw, { align: 'center' }); });
  y += 50;

  // 8. System note and end of report
  const note = 'This is a system-generated report. It is electronically prepared, reviewed and approved within the VAN QC system (Analyst -> AQCM -> QCM), access-controlled and audit-logged. It is valid without manual verification or a physical signature.';
  doc.font(TI).fontSize(7); const nh = doc.heightOfString(note, { width: W - 24 }) + 10;
  ensure(nh + 30); hline(y); doc.fillColor('#222'); txt(note, X + 12, y + 5, W - 24, { align: 'center' }); y += nh;
  hline(y, 0.5); doc.fillColor('#111').font(T).fontSize(8); txt('-------------------END OF REPORT-------------------', X, y + 5, W, { align: 'center' });
  const ov = ascii(c.overall || ''), ow1 = doc.font(T).widthOfString('Overall: '), ow2 = doc.font(TB).widthOfString(ov), ox = X + (W - ow1 - ow2) / 2;
  doc.font(T).text('Overall: ', ox, y + 16, { lineBreak: false }); doc.font(TB).text(ov, ox + ow1, y + 16, { lineBreak: false });
  y += 30; closeSheet();
}

/* ---- rate limit (per visitor, in memory) and CORS ---- */
const hits = new Map();
function limited(req) {
  // Render's proxy appends the real address as the LAST entry; earlier entries can be typed by the caller.
  const ip = String(req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress || '?';
  const now = Date.now(); const list = (hits.get(ip) || []).filter(t => t > now - RATE.windowMs);
  list.push(now); hits.set(ip, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => t > now - RATE.windowMs)) hits.delete(k);
  return list.length > RATE.max;
}
function headers(req, res) {
  const o = req.headers.origin; if (ALLOWED_ORIGINS.includes(o)) { res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin'); }
  res.set('Cache-Control', 'no-store'); res.set('X-Robots-Tag', 'noindex');
}

module.exports = function mountO2sPublicRoutes(app, { store }) {
  async function find(req, res) {
    headers(req, res);
    if (limited(req)) { res.status(429).end(); return null; }
    const n = norm(req.params.batch);
    if (!VALID.test(n)) { res.status(404).end(); return null; }
    try { const b = (await getIndex(store)).get(n); if (!b) { res.status(404).end(); return null; } return b; }
    catch (e) { console.error('public lab report lookup failed:', e && e.message); res.status(500).end(); return null; }
  }
  const base = req => process.env.PUBLIC_BASE_URL || ((req.headers['x-forwarded-proto'] || req.protocol) + '://' + req.get('host'));

  app.get('/api/public/batch/:batch', async (req, res) => {
    const b = await find(req, res); if (!b) return;
    res.json({ batch: b.batch, approved_on: b.approved_on, report_url: `${base(req)}/api/public/batch/${encodeURIComponent(b.batch)}/report.pdf` });
  });
  app.get('/api/public/batch/:batch/report.pdf', async (req, res) => {
    const b = await find(req, res); if (!b) return;
    writeReport(res, b, layoutOf());
  });
};
module.exports._buildIndex = buildIndex;   // for the tests only
module.exports._summaryCoa = summaryCoa;
module.exports._writeReport = writeReport;
module.exports._drawTextAsShapes = drawTextAsShapes;
module.exports._fontBuffers = fontBuffers;
