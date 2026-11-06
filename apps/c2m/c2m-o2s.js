/* ============================================================================
 * C2M <- O2S, read only. Reads O2S's single data row (app_state, id 1) and copies
 * PO lines and trucks out into C2M's own tables (c2m_o2s_po_line, c2m_o2s_truck).
 * Never writes to app_state. Ruling 15 Oct 2026: read app_state directly.
 * Mapping rules: docs/02-data-flows.md and docs/10-data-dictionary.md.
 * ==========================================================================*/
'use strict';
const lib = require('./c2m-lib');
const pc = require('./c2m-pricecheck');

/** Customer name as C2M knows it: O2S writes dealers as "CODE | Name". */
function o2sCustomerName(client) {
  const s = String(client || '');
  return s.includes('|') ? s.split('|').slice(1).join('|').trim() : s.trim();
}

/** O2S's entry time (ISO, UTC) as Pakistan time 'YYYY-MM-DD HH:MM:SS', or null when O2S has none (older orders). */
function enteredPk(iso) { if (!iso) return null; const d = new Date(iso); return isNaN(d.getTime()) ? null : lib.pkNow(d); }

/** O2S channel to the segment its customer records use (as O2S's _chanToSeg). */
const CH_SEG = { 'White Label': 'White-label', Dealer: 'Dealer', Distributor: 'Distributor', Vgreen: 'VGreen', Cobo: 'COBO', Farmer: 'Direct Farmer' };
/** The region of an order's customer, as O2S keeps it on the customer record (migration 009, D-146), or null.
 *  O2S matches a dealer by the code written into the order ("DLR-PB-JHN-001 | Name"), every other customer by segment and name;
 *  a dealer with no region on his record takes it from his code when the code carries one (older dealer codes do). */
function orderRegion(o, customers) {
  const client = String(o.client || ''), cs = Array.isArray(customers) ? customers : [];
  if (o.channel === 'Dealer') { const code = client.split('|')[0].trim(); const c = cs.find(x => x && x.code === code); return pc.regionOf(c && c.region) || pc.regionFromCode(code); }
  const seg = CH_SEG[o.channel]; if (!seg) return null;
  const c = cs.find(x => x && x.segment === seg && !x.isParent && x.name === client); return pc.regionOf(c && c.region);
}

/** O2S's base for each brand, as O2S itself reads it (its product master: base, or the brand when no base, and any
 *  "also packed from" bases; applyProductsV1 in o2s.html reads masters.products only). Map: base in lower case -> Set of brands in lower case.
 *  Month end uses it to find the C2M products a stock batch can belong to (fix 4b, 6 Nov 2026: push 4 matched
 *  O2S base names against C2M's production lines, so stock kg was named "base not known"). */
function baseBrandsOf(d) {
  const nm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); const out = new Map();
  const put = (b, br) => { const k = nm(b); if (!k || !br) return; if (!out.has(k)) out.set(k, new Set()); out.get(k).add(br); };
  const list = (d && d.masters && Array.isArray(d.masters.products)) ? d.masters.products : []; /* O2S reads only this list; custom products were merged into it (review 4b, finding 3) */
  for (const p of list) { if (!p || !p.brand) continue; const br = nm(p.brand); put(p.base || p.brand, br); if (p.catBase) put(p.catBase, br); for (const a of (Array.isArray(p.alsoBases) ? p.alsoBases : [])) put(a, br); }
  return out;
}
const BB = { at: 0, map: null };
/** The same map, read from O2S's data row and kept for 10 minutes (read only). null when it cannot be read and none was
 *  read before: Month end then says so and the month cannot be locked (review 4b, finding 1). */
async function o2sBaseBrands(q) {
  if (BB.map && Date.now() - BB.at < 10 * 60 * 1000) return BB.map;
  try { const [[row]] = await q('SELECT data FROM app_state WHERE id=1'); const d = row && row.data ? JSON.parse(row.data) : null;
    if (!d || !d.masters || !Array.isArray(d.masters.products)) throw new Error('O2S data has no product master');
    BB.map = baseBrandsOf(d); BB.at = Date.now(); }
  catch (e) { console.error('[c2m] O2S product master not read for Month end: ' + (e.code || e.message)); return BB.map || null; }
  return BB.map;
}

/** Pull O2S now. Returns {syncId, poLines, trucks, issues}. */
async function pullO2S(q, byUser) {
  const [[row]] = await q('SELECT data FROM app_state WHERE id=1');
  if (!row) throw new Error('O2S data not found (app_state row 1 is missing).');
  const d = JSON.parse(row.data);
  BB.map = baseBrandsOf(d); BB.at = Date.now(); /* fix 4b */
  const now = lib.pkNow();
  const [ins] = await q('INSERT INTO c2m_sync_run (started_at, by_user) VALUES (?, ?)', [now, byUser]);
  const syncId = ins.insertId;
  const [[fr]] = await q("SELECT v FROM c2m_setting WHERE k='fed_pct'"); const fed = lib.fedPct(fr && fr.v); // D-72
  const issues = [];
  const lineById = new Map();
  // When each PO came in (migration 008, D-145): the time of O2S's "Created PO <po>" line in its action log, the earliest one
  // (printDecisionAt moves when a print decision is corrected, so it is only the fallback; review 4 Nov). Until 008 is run the column is not written.
  let hasEntered = false; try { const [cols] = await q("SHOW COLUMNS FROM c2m_o2s_po_line LIKE 'entered_at'"); hasEntered = cols.length > 0; } catch (e) { hasEntered = false; console.error('[c2m] entered_at check failed, PO entry times not written: ' + (e.code || e.message)); }
  // The customer's region on each PO line (migration 009, D-146), for the VAN brand PO price check; until 009 is run it is not written.
  let hasRegion = false; try { const [cols] = await q("SHOW COLUMNS FROM c2m_o2s_po_line LIKE 'region'"); hasRegion = cols.length > 0; } catch (e) { hasRegion = false; console.error('[c2m] region check failed, PO regions not written: ' + (e.code || e.message)); }
  const createdAt = new Map();
  for (const e of d.actionLog || []) { const m = e && /^Created PO (\S+) /.exec(String(e.what || '')); if (m && e.t && (!createdAt.has(m[1]) || String(e.t) < createdAt.get(m[1]))) createdAt.set(m[1], String(e.t)); }
  let nl = 0, nt = 0;
  // No delete-first: rows are upserted with this sync's id, then rows from older pulls are removed.
  // A failure part-way leaves the previous pull's data in place (audit finding 16).
  for (const o of d.orders || []) {
    const region = hasRegion ? orderRegion(o, d.customers) : null;
    for (const l of o.lines || []) {
      const price = lib.netPoPrice(l.invoicePrice, o.fedMode, o.foc, fed);
      if (!o.foc && price > 0 && price < 10) issues.push(`PO ${o.po}: ${l.brand} priced Rs ${l.invoicePrice} (below Rs 10, not a real price)`);
      if (!o.foc && !(price > 0)) issues.push(`PO ${o.po}: ${l.brand} has no price on a PO that is not FOC (C2M treats it as FOC: out of sales until the price is entered in O2S)`);
      const sc = l.shortClose || {};
      const closed = !!sc.approvedAt && !sc.reopenedAt;   // O2S keeps the approval on a close the COO has reopened; that line is open again (29 Oct 2026)
      const ordered = Number(l.ordered) || 0, disp = Number(l.dispatched) || 0;
      const openKg = closed || /old pos/i.test(String(o.po)) ? 0 : Math.max(ordered - disp, 0);
      await q(`INSERT INTO c2m_o2s_po_line (line_id, po, received, customer_name, channel, brand, pack, ordered_kg, dispatched_kg, open_kg, net_price, fed_mode, payment_terms, short_closed, sync_id${hasEntered ? ', entered_at' : ''}${hasRegion ? ', region' : ''})
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?${hasEntered ? ',?' : ''}${hasRegion ? ',?' : ''})
               ON DUPLICATE KEY UPDATE po=VALUES(po), received=VALUES(received), customer_name=VALUES(customer_name), channel=VALUES(channel), brand=VALUES(brand), pack=VALUES(pack),
               ordered_kg=VALUES(ordered_kg), dispatched_kg=VALUES(dispatched_kg), open_kg=VALUES(open_kg), net_price=VALUES(net_price), fed_mode=VALUES(fed_mode),
               payment_terms=VALUES(payment_terms), short_closed=VALUES(short_closed), sync_id=VALUES(sync_id)${hasEntered ? ', entered_at=VALUES(entered_at)' : ''}${hasRegion ? ', region=VALUES(region)' : ''}`,
        [l.id, o.po, (o.received || '').slice(0, 10) || null, o2sCustomerName(o.client), o.channel || '', l.brand || '', Number(l.pack) || 0,
         ordered, disp, openKg, lib.round(price, 4), o.fedMode || null, o.paymentTerms || null, closed ? 1 : 0, syncId].concat(hasEntered ? [enteredPk(createdAt.get(String(o.po)) || o.printDecisionAt)] : [], hasRegion ? [region] : []));
      lineById.set(l.id, true); nl++;
    }
  }
  for (const s of d.shipments || []) {
    if (s.voided || !lineById.has(s.lid)) continue;
    /* A truck counts as out only once its gate pass is approved (approvedDate). A truck still
       loading has a dispatch date but no approvedDate: it is not a sale yet, and O2S still counts
       its kg as open on the PO (ruling 14; cost review 18 Oct 2026, D-60). */
    const dt = String(s.approvedDate || '').slice(0, 10);
    if (!dt) continue;
    await q('INSERT INTO c2m_o2s_truck (id, line_id, po, dc, truck_date, kg, sync_id) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE line_id=VALUES(line_id), po=VALUES(po), dc=VALUES(dc), truck_date=VALUES(truck_date), kg=VALUES(kg), sync_id=VALUES(sync_id)',
      [s.id, s.lid, s.po, s.dc || null, dt, Number(s.kg) || 0, syncId]);
    nt++;
  }
  /* O2S production, for Month end (migration 012, R10, R43, D-154): kg made each day with its base, and the PO and brand when
     O2S records them. Until 012 is run nothing is written. Old entries O2S keeps without an id get one from their own fields. */
  let np = 0; let hasProd = false; try { const [t] = await q("SHOW TABLES LIKE 'c2m_o2s_production'"); hasProd = t.length > 0; } catch (e) { hasProd = false; }
  if (hasProd) {
    const seen = new Map(); const from = (() => { const t = new Date(now.slice(0, 10) + 'T00:00:00Z'); t.setUTCMonth(t.getUTCMonth() - 8); return t.toISOString().slice(0, 8) + '01'; })(); /* the months Month end shows, and 1 more */
    const rows = [];
    for (const r of d.productionLog || []) { const kg = Number(r && r.kg) || 0; const day = String((r && r.date) || '').slice(0, 10); if (!(kg > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < from) continue;
      if (r.opening || /opening|reconcile/i.test(String(r.incharge || '') + String(r.by || ''))) continue; /* O2S's own rule: an opening or reconcile entry is not kg made (review 4, finding 2) */
      let id = r.id ? String(r.id) : `old:${day}:${String(r.base || '').slice(0, 30)}:${kg}`; const n = (seen.get(id) || 0) + 1; seen.set(id, n); if (n > 1) id = `${id}:${n}`;
      rows.push([id.slice(0, 60), day, String(r.base || '').slice(0, 120), r.brand ? String(r.brand).slice(0, 120) : null, r.po ? String(r.po).slice(0, 60) : null, kg, syncId]); }
    for (let i = 0; i < rows.length; i += 300) { const B = rows.slice(i, i + 300); /* 300 rows a statement (review 4, finding 6) */
      await q(`INSERT INTO c2m_o2s_production (id, made_on, base, brand, po, kg, sync_id) VALUES ${B.map(() => '(?,?,?,?,?,?,?)').join(',')} ON DUPLICATE KEY UPDATE made_on=VALUES(made_on), base=VALUES(base), brand=VALUES(brand), po=VALUES(po), kg=VALUES(kg), sync_id=VALUES(sync_id)`, B.flat()); np += B.length; }
    await q('DELETE FROM c2m_o2s_production WHERE sync_id<>?', [syncId]);
  }
  await q('DELETE FROM c2m_o2s_truck WHERE sync_id<>?', [syncId]);
  await q('DELETE FROM c2m_o2s_po_line WHERE sync_id<>?', [syncId]);
  // Customers on PO lines that C2M does not know yet
  const [unknown] = await q(`SELECT DISTINCT p.customer_name FROM c2m_o2s_po_line p WHERE NOT EXISTS
     (SELECT 1 FROM c2m_customer c WHERE CONCAT('|', c.o2s_names, '|') LIKE CONCAT('%|', p.customer_name, '|%'))`);
  unknown.forEach(u => issues.push(`Customer not matched in C2M: ${u.customer_name}`));
  const fin = lib.pkNow();
  await q('UPDATE c2m_sync_run SET finished_at=?, po_lines=?, trucks=?, issues_json=? WHERE id=?', [fin, nl, nt, JSON.stringify(issues), syncId]);
  await q("UPDATE c2m_source SET last_pull_at=?, last_pull_note=?, status='Read' WHERE system_name='O2S' AND what LIKE 'Customers%'",
    [fin, `${nl} PO lines, ${nt} truck lines, ${issues.length} issues`]);
  return { syncId, poLines: nl, trucks: nt, production: np, issues };
}

module.exports = { pullO2S, o2sCustomerName, enteredPk, orderRegion, baseBrandsOf, o2sBaseBrands };
