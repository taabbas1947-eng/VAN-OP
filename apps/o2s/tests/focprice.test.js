/* FOC samples and the price-on-pack question — 23 September 2026.
 *
 * Tahir's ruling: an FOC sample NEVER carries a printed price.
 *
 * What was wrong before this change:
 *
 *   The panel asked "Which price goes on the pack?" with a red asterisk, an
 *   amber border and "not answered", and the summary showed a warning badge —
 *   on every PO, FOC or not, because it rendered on `entryClient` alone.
 *   But the readiness check short-circuited:
 *
 *       ['Price-on-pack answered', entryFOC || entryPrintMode()!==null, ...]
 *
 *   so Submit was never blocked by it on an FOC order. Required-looking and
 *   not required. That teaches whoever raises FOC samples that a red asterisk
 *   can be ignored, and they then ignore it on a commercial PO where it decides
 *   what the QA inspector is told — which is Fault 11 returning.
 *
 *   It also wrote two contradictory fields onto every FOC order:
 *       printOnPack:  (entryPrintMode()!=='no')  ->  null !== 'no'  ->  TRUE
 *       printDecision:(entryPrintMode()||'no')   ->  'no'
 *   printPolicyOL() checks printDecision first, so the printed document was
 *   already correct — but the record disagreed with itself.
 *
 * The fix is a DERIVED answer, not a stored one. entryPrintEffective() returns
 * 'no' whenever the PO is FOC, and the human's own answer otherwise. Nothing is
 * written into entryPrintOn on the user's behalf, so there is no way to leave a
 * silent 'no' behind on a PO that stops being FOC — which was the one trap
 * worth designing against.
 */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const src = ['entryPrintMode', 'entryPrintEffective']
  .map(n => { try { return grab(n); } catch (e) { return ''; } }).join('\n\n');

const box = { console };
box.globalThis = box;
vm.createContext(box);
vm.runInContext('var entryPrintOn=null, entryFOC=false;\n' + src, box);

const set = (on, foc) => vm.runInContext(
  'entryPrintOn=' + JSON.stringify(on) + '; entryFOC=' + JSON.stringify(foc) + ';', box);

/* ---- the helper exists at all ---- */
ok('entryPrintEffective() exists', typeof box.entryPrintEffective === 'function');

/* ---- a commercial PO is untouched: the human's answer passes straight through ---- */
set(null, false);   eq('commercial, unanswered -> still unanswered', box.entryPrintEffective(), null);
set('list', false); eq('commercial, list price -> list',             box.entryPrintEffective(), 'list');
set('yes', false);  eq('commercial, price set on this PO -> yes',    box.entryPrintEffective(), 'yes');
set('no', false);   eq('commercial, no price on the bag -> no',      box.entryPrintEffective(), 'no');

/* ---- an FOC PO answers itself, whatever is or is not stored ---- */
set(null, true);    eq('FOC, unanswered -> no',  box.entryPrintEffective(), 'no');
set('list', true);  eq('FOC overrides list',     box.entryPrintEffective(), 'no');
set('yes', true);   eq('FOC overrides yes',      box.entryPrintEffective(), 'no');
set('no', true);    eq('FOC agrees with no',     box.entryPrintEffective(), 'no');

/* ---- THE TRAP: switching off FOC must not leave a silent 'no' behind ----
   A silent 'no' on a commercial PO is a wrong instruction in front of the
   inspector with nobody having answered anything. Because the answer is
   derived and never written, the human's own state is exactly as they left it. */
set(null, true);
eq('FOC reads as no',                              box.entryPrintEffective(), 'no');
vm.runInContext('entryFOC=false;', box);
eq('back to commercial -> unanswered again',       box.entryPrintEffective(), null);
eq('and nothing was written into entryPrintOn',    box.entryPrintOn, null);

set('list', true);
vm.runInContext('entryFOC=false;', box);
eq("a human's answer survives a trip through FOC", box.entryPrintEffective(), 'list');

/* ---- the readiness check now reads the effective answer, not a short-circuit ---- */
ok('the price-on-pack check no longer short-circuits on entryFOC',
   !/\['Price-on-pack answered',\s*entryFOC\s*\|\|/.test(html));
ok('the price-on-pack check asks entryPrintEffective()',
   /\['Price-on-pack answered',\s*entryPrintEffective\(\)!==null/.test(html));

/* ---- the order no longer records two contradictory answers ---- */
ok('printOnPack is derived from the effective answer',
   /printOnPack:\(entryPrintEffective\(\)!=='no'\)/.test(html));
ok('printDecision is derived from the effective answer',
   /printDecision:\(entryPrintEffective\(\)\|\|'no'\)/.test(html));
ok('neither field is still derived from the raw entryPrintMode()',
   !/printOnPack:\(entryPrintMode\(\)!=='no'\)/.test(html) &&
   !/printDecision:\(entryPrintMode\(\)\|\|'no'\)/.test(html));

/* ---- the panel states the decision on FOC instead of asking for it ---- */
ok('the panel branches on entryFOC', /entryFOC\s*\?/.test(html.slice(html.indexOf('Which price goes on the pack? <span'))) ||
   /FOC sample[^<]*no price on the bag/i.test(html));
ok('the FOC wording says the sample carries no price',
   /no price on the bag/i.test(html));

/* ---- nothing OUTSIDE setPrintOn() silently sets the answer ----
   setPrintOn is the one place a literal answer may be assigned: that is the
   human pressing a button. Anywhere else would be the system answering for
   them, which is the whole thing this change exists to prevent. So the check
   removes setPrintOn's own body from the haystack first, rather than counting
   assignments blindly and passing for the wrong reason. */
const outsideSetPrintOn = html.replace(grab('setPrintOn'), '');
ok("entryPrintOn is never assigned an answer outside setPrintOn()",
   (outsideSetPrintOn.match(/entryPrintOn\s*=\s*'(?:yes|no|list)'/g) || []).length === 0);
ok("setPrintOn() is still the place that does assign it",
   /entryPrintOn='yes'/.test(grab('setPrintOn')));

/* ---- the other three price checks still skip on FOC, which is correct:
        a free sample has no invoice price to set or reconcile ---- */
ok('invoice-price check still skips on FOC',
   /\['Invoice price set on every line[^\]]*entryFOC \|\|/.test(html));
ok('per-Kg/per-pack reconcile still skips on FOC',
   /\['Per-Kg and per-pack price reconcile',\s*entryFOC\s*\|\|/.test(html));

report();
