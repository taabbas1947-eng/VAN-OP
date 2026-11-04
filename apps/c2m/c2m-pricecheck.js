/* ============================================================================
 * C2M · VAN brand PO price check (Tahir, rulings of 4 Nov 2026, D-146).
 * Each VAN brand PO line is compared with the price list in force on the PO's date, and marked.
 * It never blocks a PO, never changes a price and never touches Margin: Margin keeps counting every
 * PO at the price O2S entered. Pure code (no database), so every rule can be tested alone.
 *
 * Which list (rulings 4 Nov 2026):
 *   Distributor            -> distributor list
 *   Dealer, Punjab         -> distributor list
 *   Dealer, Sindh          -> dealer list (net price: NSV less the additional discount)
 *   COBO                   -> farmer list, Sindh cash column (always)
 *   VGreen                 -> farmer list, Punjab column
 *   Farmer (FRM)           -> farmer list by the PO's region: Punjab column; Sindh cash or Sindh credit by the PO's
 *                             payment terms (Advance or COD is cash; 15 to 60 days is credit). Compare and mark only.
 *   A client's own pack    -> checked against its cost only, never against a list
 *   Product not on its list-> marked "not on its list"
 *   "Same price"           -> within 1% of the list price, above or below
 *   POs dated before the first list (11 Oct 2026) get no check.
 * Ruled 4 Nov 2026 (after the first build): a dealer or farmer outside Punjab and Sindh is checked as Punjab; a Sindh farmer
 * PO with no payment terms against Sindh cash; a PO with FED None is taken as entered (no FED charged).
 * Marked "not checked": a dealer or farmer whose region C2M cannot read.
 * Docs: docs/09-formulas-and-rules.md (F-32), docs/06-decisions.md (D-146).
 * ==========================================================================*/
'use strict';
const lib = require('./c2m-lib');

const TOL_PCT = 1;                  // within 1% counts as the list price (Tahir, 4 Nov 2026)
const FIRST_LIST = '2026-10-11';    // the first VAN brand lists in C2M were issued on 11 Oct 2026; POs before get no check
const COL_LABEL = { now: 'Distributor list', net: 'Dealer list, Sindh', pb: 'Farmer list, Punjab', sn: 'Farmer list, Sindh cash', snc: 'Farmer list, Sindh credit' };
const STATE_LABEL = { at: 'At list price', above: 'Above list', below: 'Below list', off: 'Not on its list', cost: 'Cost only, no list', none: 'Not checked' };

/** Region as a word: 'Punjab', 'Sindh', another region as written, or null when none is known. Codes PB and SN are read too. */
function regionOf(r) {
  const s = String(r == null ? '' : r).trim(); if (!s) return null;
  if (/^(pb|punjab)$/i.test(s)) return 'Punjab';
  if (/^(sn|sindh)$/i.test(s)) return 'Sindh';
  return s;
}
/** Region from an O2S dealer code written into the order (DLR-PB-JHN-001 | Name): the second part, when it is a region code. */
const CODE_REGION = { PB: 'Punjab', SN: 'Sindh', KP: 'KPK', BL: 'Balochistan', AJ: 'AJK', GB: 'Gilgit-Baltistan', IS: 'ICT' };
/* Only the old form (region, city, number: DLR-PB-JHN-001); new codes (DLR-GHF-26-003) carry no region (review 4 Nov, finding 7). */
function regionFromCode(code) { const m = /^DLR-([A-Z]{2})-[A-Z]{3}-\d+$/i.exec(String(code || '').trim()); return m ? CODE_REGION[m[1].toUpperCase()] || null : null; }
/** Payment terms: true for cash (Advance, COD), false for credit (a number of days), null when none is entered. */
function isCash(terms) {
  const t = String(terms == null ? '' : terms).trim(); if (!t) return null;
  if (/^(advance|cod|cash)/i.test(t)) return true;
  if (/\d+\s*days?/i.test(t) || /credit/i.test(t)) return false;
  return null;
}

/** The list and column a VAN brand PO line is compared with, or { none } with the reason it is not compared. channel: O2S words. */
function listFor(channel, region, terms) {
  const ch = String(channel || '').trim().toLowerCase(), reg = regionOf(region);
  if (ch === 'distributor') return { list: 'dist', col: 'now' };
  if (ch === 'dealer') {
    if (reg === 'Punjab') return { list: 'dist', col: 'now' };
    if (reg === 'Sindh') return { list: 'dealer', col: 'net' };
    return reg ? { list: 'dist', col: 'now' } : { none: 'The dealer\'s region is not known' }; // outside Punjab and Sindh: as Punjab (Tahir, 4 Nov 2026)
  }
  if (ch === 'cobo') return { list: 'farmer', col: 'sn' };
  if (ch === 'vgreen') return { list: 'farmer', col: 'pb' };
  if (ch === 'farmer') {
    if (reg === 'Punjab') return { list: 'farmer', col: 'pb' };
    if (reg === 'Sindh') return { list: 'farmer', col: isCash(terms) === false ? 'snc' : 'sn' }; // no payment terms: Sindh cash (Tahir, 4 Nov 2026)
    return reg ? { list: 'farmer', col: 'pb' } : { none: 'The farmer\'s region is not known' }; // outside Punjab and Sindh: as Punjab (Tahir, 4 Nov 2026)
  }
  return { none: `No list is ruled for the channel ${channel || '(none)'}` };
}

const day10 = v => (v == null ? '' : String(v).slice(0, 10));
const leftDay = d => (d && d.left ? day10(d.left.ts || d.left.at) : '');

/**
 * The rows of 1 list as they stood on a date. now: rows on the list today [{ id, d }]; old: rows taken off it
 * (list_name '<list>_old') [{ id, d }]; revs: applied revisions of this list [{ valid_from, items }] (items as stored).
 * A revision dated after the date is undone with its "from" values (newest first); a row it added is left out.
 * A row taken off after the date is put back; a duplicate dropped at the carry-over (left.dup) never is.
 */
function rowsOnDate(list, now, old, revs, date, enteredAt) {
  const D = day10(date); const rows = new Map(); const back = new Set(); // back: rows put back from the taken-off list
  for (const r of now || []) rows.set(Number(r.id), { ...r.d });
  for (const r of old || []) { const d = r.d || {}; if (d.left && !d.left.dup && leftDay(d) > D) { rows.set(Number(r.id), { ...d }); back.add(Number(r.id)); } }
  /* A revision dated after the PO date is undone. One dated on the PO date is undone too when it does not count for the PO by its time
     (D-145, as for client prices: approved that day after the PO was entered, or with no entry time); review 4 Nov, finding 4. */
  const undo = r => { const v = day10(r.valid_from); if (v > D) return true; if (v < D || enteredAt === undefined) return false; return !lib.priceCountsForPo({ decided_at: r.decided_at }, D, enteredAt); };
  const later = (revs || []).filter(undo).sort((a, b) => day10(b.valid_from).localeCompare(day10(a.valid_from)) || Number(b.id || 0) - Number(a.id || 0));
  for (const r of later) {
    const items = Array.isArray(r.items) ? r.items : (() => { try { return JSON.parse(r.items_json || '[]'); } catch (_) { return []; } })();
    for (const it of items) {
      if (it.id == null && it.added) { for (const [id, d] of rows) if (!back.has(id) && Number(d.packId) === Number(it.packId)) rows.delete(id); continue; } // a row put back from the taken-off list stays (review 4 Nov, finding 1)
      const d = rows.get(Number(it.id)); if (!d) continue;
      for (const [f, v] of Object.entries(it.from || {})) { if (v == null) delete d[f]; else d[f] = v; }
    }
  }
  const out = [...rows.values()];
  if (list === 'dealer') out.forEach(d => { if (d.nsv != null) d.net = lib.round(Number(d.nsv) * (1 - Number(d.disc || 0)), 2); });
  return out;
}

/** The row of a list for a pack: linked by its pack id, else named by the pack (name, size and unit) under any of its names. */
function rowFor(list, rows, pack, names, size, soldPer) {
  const byId = rows.filter(d => d.packId != null && Number(d.packId) === Number(pack));
  if (byId.length) return byId[0];
  return rows.find(d => d.packId == null && !d.noPack && (names || []).some(n => n && lib.listRowIs(list, d, n, size, soldPer))) || null;
}

/** The PO's price per pack on the list's own basis: ex FED for the distributor and dealer lists; for the farmer list (which includes FED)
 *  the full price the buyer pays: with FED added when the PO charges FED (Inclusive or Exclusive), as entered when it charges none
 *  (fed_mode None or empty; review 4 Nov, finding 3). */
function poPackPrice(netPerKg, size, col, fedPct, fedMode) {
  const ex = Number(netPerKg) * Number(size);
  const charged = /^(inclusive|exclusive)$/i.test(String(fedMode || ''));
  return ['pb', 'sn', 'snc'].includes(col) && charged ? ex * (1 + lib.fedPct(fedPct) / 100) : ex;
}

/**
 * Check 1 PO line. l: { po, received, enteredAt, channel, region, terms, fedMode, net, size, packId, own } where own is true when the pack
 * is a client's own product (not a VAN brand product) on a VAN brand PO, and packId is null when C2M cannot place it.
 * ctx: { fedPct, listsOn(list, date, enteredAt) -> rows, packNames(packId) -> names, soldPer(packId) }.
 * Returns { state, why, list, col, colLabel, listPrice, poPrice, diffPct }.
 */
function check(l, ctx) {
  const D = day10(l.received);
  if (!D || D < FIRST_LIST) return { state: 'none', why: 'PO dated before the first price list (11 Oct 2026)' };
  if (l.packId == null) return { state: 'none', why: 'C2M cannot place this product on a pack' };
  if (l.own) return { state: 'cost', why: 'A client\'s own pack: checked against its cost on Margin, never against a price list' };
  const pick = listFor(l.channel, l.region, l.terms);
  if (pick.none) return { state: 'none', why: pick.none };
  const rows = ctx.listsOn(pick.list, D, l.enteredAt);
  const row = rowFor(pick.list, rows, l.packId, ctx.packNames(l.packId), l.size, ctx.soldPer(l.packId));
  const base = { list: pick.list, col: pick.col, colLabel: COL_LABEL[pick.col] };
  const lp = row && row[pick.col] != null && Number(row[pick.col]) > 0 ? Number(row[pick.col]) : null;
  if (lp == null) return { ...base, state: 'off', why: row ? `On the list with no price in its ${COL_LABEL[pick.col].replace(/^.*?, /, '')} column` : `Not on the ${COL_LABEL[pick.col].toLowerCase()}` };
  const po = poPackPrice(l.net, l.size, pick.col, ctx.fedPct, l.fedMode);
  const diffPct = (po - lp) / lp * 100;
  const state = Math.abs(diffPct) <= TOL_PCT + 1e-9 ? 'at' : diffPct > 0 ? 'above' : 'below';
  return { ...base, state, why: '', listPrice: lp, poPrice: lib.round(po, 2), diffPct: lib.round(diffPct, 1) };
}

module.exports = { TOL_PCT, FIRST_LIST, COL_LABEL, STATE_LABEL, regionOf, regionFromCode, isCash, listFor, rowsOnDate, rowFor, poPackPrice, check };
