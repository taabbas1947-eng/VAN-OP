/* WHO SIGNS A TRUCK OUT — 24 September 2026 (25e). Replaces the 23i file
   ("Saad is the dispatch authority"), whose ruling Tahir changed:
   loading and the gate pass are the warehouse (Shoaib, Zain assisting); Saad
   reviews; Fahim (Plant Manager) gives the final DC approval and releases the
   truck. If Saad has not reviewed within 2 hours, Fahim may approve without it
   and the DC says so. Delivery: whoever dispatched the truck confirms; after 1
   day Saad; after 1 more the Plant Manager.
   The bug it closes: 23i moved approveDC/approveRelease to Supply Chain, but
   Today kept sending 'Approve DC' and 'Release' to the Plant Manager, who was
   refused when he tapped. DC 120 and 121 sat from 23 Sep.
   Run: node dispatchauthority.test.js */
const H = require('./harness.js'); const vm = require('vm'); const { ok, eq, report, grab, html } = H;
ok('approveRelease: Plant Manager (and COO)', grab('approveRelease').indexOf("hardRole(['Plant Manager'])") > -1);
ok('approveDC: Plant Manager (and COO)', grab('approveDC').indexOf("hardRole(['Plant Manager'])") > -1);
ok('rejectDC: Saad or the Plant Manager', grab('rejectDC').indexOf("hardRole(['Supply Chain','Plant Manager'])") > -1);
ok('reviewTruck: Supply Chain (Saad)', grab('reviewTruck').indexOf("hardRole(['Supply Chain'])") > -1);
ok('release waits for the review, unless 2 hours have passed', /!_r0\[0\]\.scReview&&!truckReviewLapsed\(_r0\[0\]\)/.test(grab('approveRelease')));
ok('an approval without the review is recorded on the DC', /s\.noScReview=true/.test(grab('approveRelease')) && /approved without Supply Chain review/.test(grab('printDC')) && /reviewed by /.test(grab('printDC')));
ok('the loader or gate-pass issuer cannot review his own truck', /You loaded or passed this truck out/.test(grab('reviewTruck')));
ok('loading and gate pass record who did them', /s\.loadedByUser=/.test(grab('startLoading')) && /s\.gatePassAt=_at; s\.gatePassBy=/.test(grab('issueGatePass')));
const ai = grab('actionItems');
ok("Today: Load and Gate Pass go to the Warehouse", /role:'Warehouse',disp:g,what:'Start loading/.test(ai) && /role:'Warehouse',disp:g,what:'Issue Gate Pass/.test(ai));
ok("Today: Saad gets 'Review truck'", /role:'Supply Chain',disp:g,what:'Review truck/.test(ai));
ok("Today: the Plant Manager gets the release, which is the one he can do", /role:'Plant Manager',disp:g,what:'Approve DC and release truck/.test(ai));
ok("Today: no separate Approve DC job for a truck in the loading flow", /g\.dcStatus==='pending' && st!=='loading' && st!=='truck_planned'/.test(ai));
ok('SIGNOFF_ROLES names the new holders', /'shipment\.release':\['Plant Manager'\],'dc\.approve':\['Plant Manager'\],'shipment\.review':\['Supply Chain'\]/.test(html));
/* the 2-hour clock and the delivery ladder, run */
const sb = { console, TRUCK_REVIEW_HOURS: 2, usersList: [{ username: 'shoaib', name: 'Muhammad Shoaib', role: 'Warehouse' }], evToday: () => '2026-09-26', state: {} };
vm.createContext(sb); vm.runInContext(['truckReviewSince', 'truckReviewLapsed', 'truckDispatcher', '_calDays', 'deliveryJobs'].map(grab).join('\n'), sb);
const now = Date.now();
ok('1 hour after the gate pass: not lapsed', !sb.truckReviewLapsed({ gatePassAt: new Date(now - 3600e3).toISOString() }));
ok('3 hours after: lapsed', sb.truckReviewLapsed({ gatePassAt: new Date(now - 3 * 3600e3).toISOString() }));
ok('the clock starts at the later of gate pass and inspection', !sb.truckReviewLapsed({ gatePassAt: new Date(now - 5 * 3600e3).toISOString(), qa: { recordedAt: new Date(now - 1800e3).toISOString() } }));
const g = d => ({ dispId: 'D1', dc: '118', po: 'P', approvedDate: d, rows: [{ gatePassByUser: 'zain', gatePassBy: 'Zain Ghaffar', gatePassByRole: 'Supply Chain Officer' }] });
eq('day of release and next day: only the dispatcher', sb.deliveryJobs(g('2026-09-25')).map(x => x.role + ':' + (x.who || '')).join(','), 'Supply Chain Officer:zain');
eq('day 2: Saad too', sb.deliveryJobs(g('2026-09-24')).map(x => x.role).join(','), 'Supply Chain Officer,Supply Chain');
eq('day 3: the Plant Manager too', sb.deliveryJobs(g('2026-09-23')).map(x => x.role).join(','), 'Supply Chain Officer,Supply Chain,Plant Manager');
eq('an old truck with no gate-pass record falls back to who planned it', sb.truckDispatcher({ by: 'Muhammad Shoaib' }).user, 'shoaib');
process.exitCode = report('Who signs a truck out (25e)') ? 1 : 0;
