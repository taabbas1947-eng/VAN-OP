/* 25g — New order redesigned: 4 sections, one card per product, every field
   and every check kept. Run: node entrydesign.test.js */
const H = require('./harness.js'); const { ok, report, grab } = H;
const { html } = H; const sc = html.slice(html.indexOf('function screenEntry(){'), html.indexOf('function updatePacks(')), rl = html.slice(html.indexOf('function renderEntryLines(){'), html.indexOf('/* live order summary (display only)'));
ok('4 numbered sections: Customer, Terms and dates, Delivery, Products', ['<b>Customer</b>', '<b>Terms and dates</b>', '<b>Delivery</b>', '<b>Products</b>'].every(t => sc.indexOf(t) > -1));
['e_chan', 'e_client', 'e_vsub', 'e_potype', 'e_kam', 'e_pri', 'e_source', 'e_terms', 'e_erpso', 'e_po', 'e_po_msg', 'e_recv', 'e_prom', 'e_focal', 'e_focalphone', 'e_instructions', 'e_lines', 'e_total', 'e_summary', 'e_submit', 'e_submit_note', 'e_steps', 'e_pricehelp']
  .forEach(id => ok('every field kept: #' + id, sc.indexOf('id="' + id + '"') > -1));
ok('the FED override is still there for COO / CFO', /entryFEDover=this\.value/.test(sc));
ok('the print-on-pack question is still asked', /Which price goes on the pack\?/.test(sc) && /setPrintOn\(/.test(sc));
ok('Submit sits with the summary and still calls submitPO', /<div class="summary">[\s\S]*id="e_submit"[\s\S]*onclick="submitPO\(\)"/.test(sc));
ok('products are cards, not table rows', /<div class="nl">/.test(rl) && !/<tr>/.test(rl));
['pks_', 'pk_', 'ikg_', 'ipk_', 'ipp_', 'lpc_', 'cm_', 'cmh_', 'pp_'].forEach(id => ok('every line field kept: ' + id, rl.indexOf('id="' + id + '${i}"') > -1));
ok('each product speaks its own unit', /Quantity \(\$\{u\}\)/.test(rl) && /Invoice price, PKR per \$\{u\}/.test(rl));
ok('an FOC order shows no price inputs', /entryFOC\?'<div class="muted"[^']*FOC sample: no price/.test(rl));
ok('the phone layout collapses to one column', /\.po2 \.formgrid\{grid-template-columns:minmax\(0,1fr\)!important\}/.test(sc));
process.exitCode = report('New order redesign (25g)') ? 1 : 0;
