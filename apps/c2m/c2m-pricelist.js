/* ============================================================================
 * C2M price list documents (ruling 14 Oct 2026): 1 builder for every audience;
 * the creator picks the fields; a formal VAN document with logo and footer.
 * Cost and margin can never be printed: they are not in any field list below.
 * PDF made with pdfkit (already a platform dependency).
 * ==========================================================================*/
'use strict';
const path = require('path');
const fs = require('fs');

const AUDIENCES = {
  wl: 'White label client (monthly)', dist: 'Distributor and channel partner', dealer: 'Dealer, Sindh',
  farmer_pb: 'Farmer, Punjab', farmer_sn: 'Farmer, Sindh', farmer_snc: 'Farmer, Sindh credit', web: 'Website',
};
const FIELDS = {
  wl: [['product', 'Product', 1], ['spec', 'Specification', 1], ['pack', 'Pack size', 1], ['cur', 'Current price, Rs per kg or L', 1], ['prev', 'Previous price', 1], ['chg', '% change', 1], ['reason', 'Reason for change', 1], ['eff', 'Effective date', 1]],
  dist: [['product', 'Product', 1], ['spec', 'Specification', 1], ['pack', 'Pack size', 1], ['cur', 'Price ex FED, Rs per pack', 1], ['fed', 'Price with FED', 1], ['prev', 'Previous price', 0], ['chg', '% change', 0], ['reason', 'Reason for change', 0], ['mrp', 'Benchmark MRP', 1], ['terms', 'Payment terms', 1]],
  dealer: [['product', 'Product', 1], ['spec', 'Specification', 1], ['pack', 'Pack size', 1], ['cur', 'Net price ex taxes', 1], ['disc', 'Additional discount', 1], ['netfed', 'Net price with taxes', 1], ['frp', 'FRP', 1], ['mrp', 'MRP', 1]],
  farmer: [['product', 'Product', 1], ['spec', 'Specification', 1], ['cur', 'Sale price, Rs', 1]],
};
const fieldsFor = a => FIELDS[a.startsWith('farmer') || a === 'web' ? 'farmer' : a];
const rs = v => v == null || isNaN(v) ? '' : 'Rs ' + Math.round(v).toLocaleString('en-US');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const fmtD = s => { if (!s) return ''; const p = String(s).slice(0, 10).split('-'); return `${+p[2]} ${MON[+p[1] - 1]} ${p[0]}`; };

/** Rows for a document. wlRows come from approved client prices; list rows from c2m_list_price. */
function rows(aud, data, reasons = {}) {
  if (aud === 'wl') return data.wl.map(r => {
    const ch = r.prev ? (r.cur - r.prev) / r.prev * 100 : null; // null = a new price, no previous
    const k = 'p' + r.packId;
    return { product: r.brand, spec: r.spec || '', pack: r.pack, cur: r.cur.toFixed(2), prev: r.prev != null ? r.prev.toFixed(2) : '', chg: ch == null ? 'new' : (ch > 0 ? '+' : '') + ch.toFixed(1) + '%',
      reason: reasons[k] != null ? reasons[k] : (r.reason || (ch == null ? 'New price' : Math.abs(ch) > 0.01 ? 'Raw material cost change' : 'No change')), eff: fmtD(data.eff), _k: k };
  });
  if (aud === 'dist') return data.list.map((d, i) => {
    const ch = d.prev ? (d.now - d.prev) / d.prev * 100 : null; const k = 'd' + i; const noPrice = d.now == null; // null = no previous price: "new", never "0.0%" (defect 12)
    return { product: d.p, spec: d.d, pack: d.pack, cur: rs(d.now), fed: rs(d.fed), prev: rs(d.prev), chg: noPrice ? '' : ch == null ? 'new' : (ch > 0 ? '+' : '') + ch.toFixed(1) + '%',
      reason: reasons[k] != null ? reasons[k] : (noPrice ? '' : ch == null ? 'New price' : Math.abs(ch) > 0.01 ? 'Price revised' : 'No change'), mrp: rs(d.mrp), terms: d.terms === 'TBD' ? 'As agreed' : d.terms, _k: k };
  });
  if (aud === 'dealer') return data.list.map(d => ({ product: d.p, spec: d.d, pack: d.pack, cur: rs(d.net), disc: d.disc ? (d.disc * 100).toFixed(1) + '%' : '', netfed: rs(d.netfed), frp: rs(d.frp), mrp: rs(d.mrp) }));
  const col = aud === 'farmer_sn' ? 'sn' : aud === 'farmer_snc' ? 'snc' : 'pb';
  return data.list.map(f => ({ product: f.p, spec: f.d, cur: f[col] != null ? rs(f[col]) : '' }));
}

function title(aud, data) {
  if (aud === 'wl') { const p = String(data.eff).split('-'); return { t: 'Price List', to: data.addressee, sub: `Monthly price list for ${MONL[+p[1] - 1]} ${p[0]}` }; }
  if (aud === 'dist') return { t: 'Price List for Distribution Partners', to: 'Distribution partners', sub: 'Prices per pack' };
  if (aud === 'dealer') return { t: 'Dealer Price List, Sindh', to: 'Sindh dealers', sub: 'Cash sales policy' };
  if (aud === 'web') return { t: 'Product Prices', to: 'van.com.pk', sub: 'Retail prices, Punjab' };
  return { t: 'Farmer Price List', to: { farmer_pb: 'Punjab', farmer_sn: 'Sindh', farmer_snc: 'Sindh, credit' }[aud], sub: 'Retail prices' };
}

function notes(aud, data) {
  const n = [];
  if (aud === 'wl') { n.push('Prices are ex-factory and exclude FED and sales tax.'); if (data.rule === 'time') n.push('POs received before the effective date are supplied at the price on the PO.'); n.push('Prices apply to the packing arrangement agreed for each product.'); }
  if (aud === 'dist') n.push('Price with FED includes FED at 5%. Benchmark MRP is for guidance.');
  if (aud === 'dealer') n.push('Payment by demand draft, pay order or bank deposit only. No returns.');
  if (aud.startsWith('farmer') || aud === 'web') n.push('Prices include taxes and may change; check the latest list.');
  if (data.note) n.push(data.note);
  return n;
}

const FOOTER = 'Vital Agri Nutrients (Private) Limited · Head office: 605 Al-Hafeez Heights, Gulberg III, Lahore 54660 · Plant: 49-Km Multan Road, Phool Nagar Bypass, Lahore · +92\u00a042\u00a035762215 · www.van.com.pk';
const LOGO = path.join(__dirname, 'assets', 'van-logo.png');

/** Write the PDF to a response stream. picked: array of field keys in order. */
function pdf(res, aud, data, picked, reasons) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', layout: picked.length > 6 ? 'landscape' : 'portrait', margin: 36, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${String(data.ref).replace(/[^A-Za-z0-9_-]+/g, '-')}.pdf"`);
  doc.pipe(res);
  const W = doc.page.width - 72, NAVY = '#14327e', INK = '#14233a', MUTED = '#4a5a70';
  if (fs.existsSync(LOGO)) doc.image(LOGO, 36, 30, { width: 70 });
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13).text('Vital Agri Nutrients (Private) Limited', 116, 40);
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('Lahore · www.van.com.pk', 116, 58);
  doc.fontSize(9).text(`Ref: ${data.ref}`, 36, 40, { width: W, align: 'right' }).text(`Date: ${fmtD(data.date)}`, 36, 53, { width: W, align: 'right' });
  doc.moveTo(36, 88).lineTo(36 + W, 88).lineWidth(2).strokeColor(NAVY).stroke();
  const t = title(aud, data);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(16).text(t.t, 36, 100);
  doc.fillColor(INK).font('Helvetica').fontSize(10).text(`For: ${t.to} · ${t.sub}`).text(`Effective from ${fmtD(data.eff)}${data.till ? ' · valid till ' + fmtD(data.till) : ''}`);
  const F = fieldsFor(aud).filter(f => picked.includes(f[0]));
  const R = rows(aud, data, reasons);
  const cols = [['sr', 'Sr']].concat(F.map(f => [f[0], f[1]]));
  const widths = cols.map(([k]) => k === 'sr' ? 0.5 : (k === 'product' || k === 'spec' || k === 'reason') ? 2 : 1);
  const tw = widths.reduce((a, b) => a + b, 0); const cw = widths.map(w => w / tw * W);
  let y = doc.y + 10;
  const numeric = k => ['cur', 'prev', 'fed', 'mrp', 'netfed', 'frp', 'chg', 'disc'].includes(k);
  // The heading band is as tall as its longest heading, so wrapped headings stay on the navy band (handover review)
  const hh = Math.max(18, ...cols.map(([, l], i) => doc.font('Helvetica-Bold').fontSize(8).heightOfString(l, { width: cw[i] - 6 }) + 10));
  function header() {
    doc.rect(36, y, W, hh).fill(NAVY); let x = 36;
    cols.forEach(([, l], i) => { doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8).text(l, x + 3, y + 5, { width: cw[i] - 6, align: numeric(cols[i][0]) ? 'right' : 'left' }); x += cw[i]; });
    y += hh;
  }
  header();
  R.forEach((r, ri) => {
    const vals = cols.map(([k]) => k === 'sr' ? String(ri + 1) : String(r[k] == null ? '' : r[k]));
    const h = Math.max(...vals.map((v, i) => doc.font('Helvetica').fontSize(8).heightOfString(v, { width: cw[i] - 6 }))) + 8;
    if (y + h > doc.page.height - 70) { doc.addPage(); y = 40; header(); }
    if (ri % 2) doc.rect(36, y, W, h).fill('#f4f6fa');
    let x = 36; vals.forEach((v, i) => { doc.fillColor(INK).font('Helvetica').fontSize(8).text(v, x + 3, y + 4, { width: cw[i] - 6, align: numeric(cols[i][0]) ? 'right' : 'left' }); x += cw[i]; });
    y += h;
  });
  doc.y = y + 10; doc.x = 36;
  // Notes and signature stay together and above the footer rule (page height - 50): move them to a new page if needed
  const N = notes(aud, data);
  const need = N.reduce((h, n) => h + doc.font('Helvetica').fontSize(8).heightOfString('• ' + n, { width: W }), 0) + 50;
  if (doc.y + need > doc.page.height - 60) { doc.addPage(); doc.y = 40; }
  N.forEach(n => doc.fillColor(MUTED).font('Helvetica').fontSize(8).text('• ' + n, 36, doc.y, { width: W }));
  doc.moveDown(2); doc.fillColor(INK).fontSize(9).text('Yawar Hussain', 36, doc.y, { width: W, align: 'right' }).text('Chief Financial Officer', { width: W, align: 'right' });
  // Footer and page number on every page, drawn inside the page so no blank page is added (handover review)
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i); const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    const fy = doc.page.height - 50;
    doc.moveTo(36, fy).lineTo(36 + W, fy).lineWidth(1.5).strokeColor('#e5262a').stroke();
    doc.fillColor(MUTED).font('Helvetica').fontSize(7).text(FOOTER, 36, fy + 6, { width: W, align: 'center', lineBreak: true });
    doc.text(`${data.ref} · page ${i - range.start + 1} of ${range.count}`, 36, doc.page.height - 24, { width: W, align: 'right' });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
}

module.exports = { AUDIENCES, FIELDS, fieldsFor, rows, title, notes, pdf, FOOTER, fmtD };
