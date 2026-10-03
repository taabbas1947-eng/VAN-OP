/* The pre-shipment inspection goes live — 23 September 2026.
 *
 * Measured on live production data on 22 Sept: 215 of 215 shipments carried
 * `qa:{pass:true,closed:true}` and NOT ONE carried a real inspection. Both
 * dispatch paths wrote that stub at creation, so:
 *
 *   - the Action Center raises the QA task only when `qa === null` — never;
 *   - `approveRelease` refuses unless `qa && qa.pass` — the stub satisfied it,
 *     so the gate added on 21 Aug had never blocked a truck;
 *   - the check that justified that gate ("135 shipments, all 135 carrying a
 *     passing inspection") was reading the stubs dispatch had just written.
 *
 * On the same data, 80 of 108 trucks left before the material on them had been
 * inspected at all.
 *
 * What these checks hold: the cut-over date, that a shipment from it is born
 * genuinely pending, that one from before it is NOT dragged back into pending,
 * and that every gate keyed off `qa` therefore becomes real.
 */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, html } = H;

const src = ['qaRequiredOn', 'dispatchGroups', 'shipStageOf', 'shipClientFor']
  .map(n => { try { return grab(n); } catch (e) { return ''; } }).join('\n\n');
const box = { console, Date, state: {}, TODAY: new Date('2026-09-22'),
              fmt: String, shipClientFor: () => '' };
box.globalThis = box;
vm.createContext(box);
vm.runInContext("var QA_GO_LIVE='2026-09-23';\n" + src, box);

/* ---- the cut-over itself ---- */
eq('the cut-over is 23 September 2026', (/var QA_GO_LIVE='([^']+)'/.exec(html) || [])[1], '2026-09-23');
eq('22 Sept is before it',  box.qaRequiredOn('2026-09-22'), false);
eq('23 Sept is on it',      box.qaRequiredOn('2026-09-23'), true);
eq('24 Sept is after it',   box.qaRequiredOn('2026-09-24'), true);
eq('and July is well before it', box.qaRequiredOn('2026-07-15'), false);

/* ---- what dispatch now writes ---- */
ok('both dispatch paths decide qa by the cut-over, not unconditionally',
   (html.match(/qa:\(qaRequiredOn\(d\)\?null:\{pass:true,closed:true\}\)/g) || []).length === 2);
ok('neither path writes an unconditional passing stub any more',
   !/qa:\{pass:true,closed:true\},by:state\.role/.test(html));

/* ---- a shipment born on or after the cut-over is genuinely pending ---- */
const mk = (dispatch, qa) => ({ id:'SH1', dispId:'DSP1', po:'PO1', client:'C', brand:'X',
  kg:100, batches:[], dispatch, qa, stage:'planned', delivered:false, dcStatus:'approved' });

box.state = { shipments:[ mk('2026-09-23', null) ] };
let g = box.dispatchGroups()[0];
eq('a 23 Sept shipment is pending inspection', g.qa, 'pending');

box.state = { shipments:[ mk('2026-09-22', {pass:true,closed:true}) ] };
g = box.dispatchGroups()[0];
eq('a 22 Sept shipment keeps its old status — nothing on the road is dragged back',
   g.qa, 'pass');

box.state = { shipments:[ mk('2026-09-25', {pass:true, by:'Ahtsham Ali', date:'2026-09-25',
  checklist:[{item:'Packaging intact & correct', result:'pass'}]}) ] };
eq('once really inspected it passes', box.dispatchGroups()[0].qa, 'pass');

box.state = { shipments:[ mk('2026-09-25', {pass:false, fail:true, checklist:[{item:'x',result:'fail'}]}) ] };
eq('a failed inspection reads as failed', box.dispatchGroups()[0].qa, 'fail');

/* ---- and every gate keyed off qa therefore becomes real ---- */
ok('release refuses a truck whose inspection has not passed',
   /_un=rows\.filter\(function\(s\)\{ return !\(s\.qa && s\.qa\.pass\); \}\)/.test(html));
ok('delivery refuses while it is pending',
   (html.match(/qa==='pending'/g) || []).length >= 3);
ok('the DC prints its QC PASSED stamp only on a passed shipment',
   /\(g\.qa==='pass'\)\?'<div class="stamprow">/.test(html));
ok('the customer report offers no button while it is pending',
   /if\(g\.qa==='pending'\) return '';/.test(html));
ok('the QA task is raised for a pending shipment',
   /qa==='pending'\)\.forEach\(g=>items\.push\(\{role:'QA Inspector'/.test(html));

report('Pre-shipment inspection gate');
