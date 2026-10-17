/* ============================================================================
 * C2M <- O2S, read only. Reads O2S's single data row (app_state, id 1) and copies
 * PO lines and trucks out into C2M's own tables (c2m_o2s_po_line, c2m_o2s_truck).
 * Never writes to app_state. Ruling 15 Oct 2026: read app_state directly.
 * Mapping rules: docs/02-data-flow.md and docs/10-data-dictionary.md.
 * ==========================================================================*/
'use strict';
const lib = require('./c2m-lib');

/** Customer name as C2M knows it: O2S writes dealers as "CODE | Name". */
function o2sCustomerName(client) {
  const s = String(client || '');
  return s.includes('|') ? s.split('|').slice(1).join('|').trim() : s.trim();
}

/** Pull O2S now. Returns {syncId, poLines, trucks, issues}. */
async function pullO2S(q, byUser) {
  const [[row]] = await q('SELECT data FROM app_state WHERE id=1');
  if (!row) throw new Error('O2S data not found (app_state row 1 is missing).');
  const d = JSON.parse(row.data);
  const now = lib.pkNow();
  const [ins] = await q('INSERT INTO c2m_sync_run (started_at, by_user) VALUES (?, ?)', [now, byUser]);
  const syncId = ins.insertId;
  const issues = [];
  const lineById = new Map();
  let nl = 0, nt = 0;
  // No delete-first: rows are upserted with this sync's id, then rows from older pulls are removed.
  // A failure part-way leaves the previous pull's data in place (audit finding 16).
  for (const o of d.orders || []) {
    for (const l of o.lines || []) {
      const price = lib.netPoPrice(l.invoicePrice, o.fedMode, o.foc);
      if (!o.foc && price > 0 && price < 10) issues.push(`PO ${o.po}: ${l.brand} priced Rs ${l.invoicePrice} (below Rs 10, not a real price)`);
      const sc = l.shortClose || {};
      const closed = !!sc.approvedAt;
      const ordered = Number(l.ordered) || 0, disp = Number(l.dispatched) || 0;
      const openKg = closed || /old pos/i.test(String(o.po)) ? 0 : Math.max(ordered - disp, 0);
      await q(`INSERT INTO c2m_o2s_po_line (line_id, po, received, customer_name, channel, brand, pack, ordered_kg, dispatched_kg, open_kg, net_price, fed_mode, payment_terms, short_closed, sync_id)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON DUPLICATE KEY UPDATE po=VALUES(po), received=VALUES(received), customer_name=VALUES(customer_name), channel=VALUES(channel), brand=VALUES(brand), pack=VALUES(pack),
               ordered_kg=VALUES(ordered_kg), dispatched_kg=VALUES(dispatched_kg), open_kg=VALUES(open_kg), net_price=VALUES(net_price), fed_mode=VALUES(fed_mode),
               payment_terms=VALUES(payment_terms), short_closed=VALUES(short_closed), sync_id=VALUES(sync_id)`,
        [l.id, o.po, (o.received || '').slice(0, 10) || null, o2sCustomerName(o.client), o.channel || '', l.brand || '', Number(l.pack) || 0,
         ordered, disp, openKg, lib.round(price, 4), o.fedMode || null, o.paymentTerms || null, closed ? 1 : 0, syncId]);
      lineById.set(l.id, true); nl++;
    }
  }
  for (const s of d.shipments || []) {
    if (s.voided || !lineById.has(s.lid)) continue;
    const dt = String(s.approvedDate || s.dispatch || '').slice(0, 10);
    if (!dt) continue;
    await q('INSERT INTO c2m_o2s_truck (id, line_id, po, dc, truck_date, kg, sync_id) VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE line_id=VALUES(line_id), po=VALUES(po), dc=VALUES(dc), truck_date=VALUES(truck_date), kg=VALUES(kg), sync_id=VALUES(sync_id)',
      [s.id, s.lid, s.po, s.dc || null, dt, Number(s.kg) || 0, syncId]);
    nt++;
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
  return { syncId, poLines: nl, trucks: nt, issues };
}

module.exports = { pullO2S, o2sCustomerName };
