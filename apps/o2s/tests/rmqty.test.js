/* Raw-material quantity entry — the Supply Chain complaint, and the unit basis.
 *
 * 22 Sept 2026. Two things, both reported by the people using it:
 *
 *   "the system doesn't allow a large number — it says add 1 every time"
 *   The amount box rendered 26px wide (measured in Chromium): the spinner
 *   arrows and no text area, because the box carried inline `flex:1`
 *   (flex-basis 0) while the unit dropdown beside it kept `width:100%` from
 *   `.fld select,.fld input{width:100%}`. The dropdown claimed the whole row
 *   and the box collapsed to its min-content. With nothing to type into, the
 *   up-arrow was the only control, and it dropped focus on every click because
 *   `onchange` re-rendered the whole modal. 30,000 Kg was 30,000 clicks.
 *
 *   Worse on RM Check: clicking that 26px box and typing 22500 landed on the
 *   DOWN arrow and recorded -1, which rmMakeKg() clamped to 0 — a partial check
 *   silently becoming "nothing can be made" and raising a PR for the whole order.
 *
 *   "% of order" — of WHAT, on a top-up? Of the ordered quantity, always. Not
 *   of what is still pending, which is the number the person is looking at.
 *
 * Widths and focus are a browser's business and were measured there. What is
 * checked here is the arithmetic, and that the markup which produced those
 * widths is gone.
 */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const src = ['rmRcvKg', 'rmMakeKg'].map(grab).join('\n\n');
const box = { console, Date, state: null };
box.globalThis = box;
vm.createContext(box);
vm.runInContext(src, box);

function line(ordered, cleared) {
  box.state = { orders: [{ id: 'o1', po: 'PO1', lines: [
    { id: 'l1', brand: 'Max Boron', ordered: ordered, canMakeKg: cleared }] }] };
}
const rcv = (qty, unit) => { box.rmRcvForm = { oid: 'o1', lid: 'l1', qty: qty, unit: unit }; return box.rmRcvKg(); };
const mk  = (qty, unit) => { box.rmForm   = { oid: 'o1', lid: 'l1', canMake: qty, unit: unit }; return box.rmMakeKg(); };

/* ---- 1. the number the person types is the number that is recorded ---- */
line(30000, 0);
eq('30,000 Kg typed on a top-up is 30,000', rcv('30000', 'kg'), 30000);
eq('and is not capped at some smaller step', rcv('29999', 'kg'), 29999);
line(30000, 0);
eq('22,500 Kg on RM Check is 22,500', mk('22500', 'kg'), 22500);

/* ---- 2. the negative that the collapsed box used to produce ---- */
eq('a negative reading can never be stored as a negative', mk('-1', 'kg'), 0);
eq('…nor on a top-up', rcv('-1', 'kg'), 0);
eq('an empty box is nothing, not NaN', rcv('', 'kg'), 0);
eq('junk in the box is nothing', rcv('abc', 'kg'), 0);

/* ---- 3. "% of order" is a percentage of the ORDERED quantity ---- */
line(500, 0);
eq('50% of a 500 Kg order is 250', rcv('50', 'pct'), 250);
eq('100% is the whole order', rcv('100', 'pct'), 500);

/* the case the relabel is about: 300 already cleared, 200 outstanding */
line(500, 300);
eq('50% still means 50% of the ORDER (250), not of the 200 pending',
   rcv('50', 'pct'), 200);      // 250 computed, clamped to the 200 outstanding
ok('…which is why the option on the top-up dialog now names its basis',
   /% of \$\{fmt\(ord\)\} Kg ordered/.test(html));
ok('RM Check keeps the plain wording — nothing is cleared there yet',
   /rmForm\.unit==='pct'\?'selected':''\}>% of order</.test(html));

/* ---- 4. it can never clear more than was ordered ---- */
line(500, 300);
eq('a top-up larger than the outstanding quantity clamps to it', rcv('9999', 'kg'), 200);
eq('200% clamps to the outstanding quantity too', rcv('200', 'pct'), 200);
line(500, 500);
eq('nothing left to clear returns nothing', rcv('100', 'kg'), 0);
line(500, 0);
eq('RM Check cannot exceed the order either', mk('9999', 'kg'), 500);

/* ---- 5. the markup that collapsed the box is gone ---- */
ok('the amount box no longer carries the inline flex that collapsed it',
   !/<input type="number" value="\$\{rmRcvForm\.qty\}"[^>]*style="flex:1"/.test(html)
     && !/<input type="number" value="\$\{rmForm\.canMake\}"[^>]*style="flex:1"/.test(html));
ok('both quantity rows use the sized .qtynum / .qtyunit pair',
   (html.match(/class="qtynum"/g) || []).length === 2
     && (html.match(/class="qtyunit/g) || []).length === 2);
ok('the box is given a real width rather than a zero flex-basis',
   /\.fld \.qtyrow \.qtynum\{flex:1 1 auto;width:auto;min-width:120px/.test(html));
ok('and the unit box is sized so it cannot claim the whole row',
   /\.fld \.qtyrow \.qtyunit\{flex:0 0 132px/.test(html));

/* ---- 6. typing no longer re-renders the modal out from under the caret ---- */
ok('the amount box updates the preview, not the whole modal',
   /oninput="rmRcvForm\.qty=this\.value;rmRcvPreview\(\)"/.test(html)
     && /oninput="rmForm\.canMake=this\.value;rmMakePreview\(\)"/.test(html));
ok('and no longer re-renders on change',
   !/onchange="rmRcvForm\.qty=this\.value;renderRMReceive\(\)"/.test(html)
     && !/onchange="rmForm\.canMake=this\.value;renderRMModal\(\)"/.test(html));

report('RM quantity entry');
