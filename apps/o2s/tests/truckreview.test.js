/* WHO MAY REVIEW A TRUCK (13 Oct 2026, build 2026-10-13b).
   Saad (Supply Chain) and Shoaib (Warehouse) review; Zain (Supply Chain Officer) never does;
   whoever loaded the truck or issued its gate pass cannot review it.
   Run: node truckreview.test.js */
const H = require('./harness.js');
const { ok, eq, report, grab, html } = H;

function run(role, user, rows, fn, arg) {
  const toasts = [], logs = [];
  const state = { role, currentUser: { name: user, username: user }, audit: [] };
  const src = ['hardRole', '_uRole', 'truckReadyForReview', 'truckSentBack', 'truckFixers', 'truckMadeByMe', 'reviewTruck', 'sendBackTruck'].map(grab).join('\n') +
    '\nreturn {reviewTruck:reviewTruck,sendBackTruck:sendBackTruck};';
  const m = new Function('state', 'toast', 'logAction', 'save', 'render', 'shipRowsOf', 'TRUCK_REVIEW_ROLES', 'closeModal', 'rpEmpty', 'TS_STEP',
    src)(state, t => toasts.push(t), l => logs.push(l), () => {}, () => {}, () => rows, ['Supply Chain', 'Warehouse'], () => {}, () => '', { review: { back: true }, release: { back: true } });
  try { if (fn === 'sendBackTruck') m[fn]('D1', 'review', arg); else m[fn]('D1'); } catch (e) { toasts.push('ERR ' + e.message); }
  return { toasts, logs, rows };
}
const mkRows = (loadedBy, gpBy) => [{ dispId: 'D1', dc: 'DC-1', stage: 'loading', gatePass: 'GP-1', qa: { pass: true }, loadedByUser: loadedBy, gatePassByUser: gpBy }];
const reviewed = r => !!(r.rows[0].scReview);

/* Saad made it: Shoaib reviews; Saad cannot */
{ let r = run('Warehouse', 'shoaib', mkRows('saad', 'saad'), 'reviewTruck'); ok('Saad made the truck: Shoaib (Warehouse) reviews it', reviewed(r)); eq('...and it is recorded as Shoaib', r.rows[0].scReview.user, 'shoaib');
  r = run('Supply Chain', 'saad', mkRows('saad', 'saad'), 'reviewTruck'); ok('Saad cannot review a truck he made', !reviewed(r) && /loaded, passed out/.test(r.toasts.join())); }
/* Shoaib made it: Saad reviews; Shoaib cannot */
{ let r = run('Supply Chain', 'saad', mkRows('shoaib', 'shoaib'), 'reviewTruck'); ok('Shoaib made the truck: Saad reviews it', reviewed(r));
  r = run('Warehouse', 'shoaib', mkRows('shoaib', 'shoaib'), 'reviewTruck'); ok('Shoaib cannot review a truck he made', !reviewed(r)); }
/* Zain made it, or not: Zain never reviews */
{ let r = run('Supply Chain Officer', 'zain', mkRows('shoaib', 'shoaib'), 'reviewTruck'); ok('Zain (Supply Chain Officer) cannot review, even on a truck he did not make', !reviewed(r) && /reviews the truck/.test(r.toasts.join()));
  r = run('Supply Chain', 'saad', mkRows('zain', 'zain'), 'reviewTruck'); ok('Zain made the truck: Saad can review', reviewed(r));
  r = run('Warehouse', 'shoaib', mkRows('zain', 'zain'), 'reviewTruck'); ok('Zain made the truck: Shoaib can review', reviewed(r)); }
/* split work: loaded by one, gate pass by the other */
{ let r = run('Supply Chain', 'saad', mkRows('shoaib', 'saad'), 'reviewTruck'); ok('Saad issued the gate pass, Shoaib loaded: neither may review', !reviewed(r));
  r = run('Warehouse', 'shoaib', mkRows('shoaib', 'saad'), 'reviewTruck'); ok('...Shoaib cannot either', !reviewed(r)); }
/* other roles */
['KAM', 'Production', 'QA Inspector', 'Plant Manager'].forEach(role => { const r = run(role, 'x', mkRows('saad', 'saad'), 'reviewTruck'); ok(role + ' cannot review a truck', !reviewed(r)); });
{ const r = run('COO', 'tahir', mkRows('saad', 'saad'), 'reviewTruck'); ok('the COO is unchanged: he may review', reviewed(r)); }
/* already reviewed stays refused */
{ const rows = mkRows('saad', 'saad'); rows[0].scReview = { by: 'Saad' }; const r = run('Warehouse', 'shoaib', rows, 'reviewTruck'); ok('an already reviewed truck is not reviewed twice', /Already reviewed/.test(r.toasts.join())); }
/* send back from the review follows the same rule */
{ let r = run('Warehouse', 'shoaib', mkRows('saad', 'saad'), 'sendBackTruck', 'wrong vehicle'); ok('Shoaib may send back a truck Saad made', !!r.rows[0].sentBack);
  r = run('Warehouse', 'shoaib', mkRows('shoaib', 'shoaib'), 'sendBackTruck', 'wrong vehicle'); ok('Shoaib may not send back a truck he made', !r.rows[0].sentBack);
  r = run('Supply Chain Officer', 'zain', mkRows('saad', 'saad'), 'sendBackTruck', 'wrong vehicle'); ok('Zain may not send back from the review', !r.rows[0].sentBack); }
/* the Today job */
const ai = grab('actionItems');
ok('the Review truck job is also addressed to the review roles', /alsoRoles:TRUCK_REVIEW_ROLES,disp:g,notWho:/.test(ai));
{ const tv = grab('tdVisible'); const f = new Function('mayRole', 'RIGHTS_LIVE', 'TD_RIGHT', tv + '\nreturn tdVisible;')(() => false, {}, {});
  const it = { label: 'Review truck', role: 'Supply Chain', alsoRoles: ['Supply Chain', 'Warehouse'] };
  ok('Today shows the job to Supply Chain and Warehouse', f(it, 'Supply Chain') && f(it, 'Warehouse'));
  ok('...and not to Supply Chain Officer (Zain)', !f(it, 'Supply Chain Officer'));
  ok('...nor to a Warehouse job that has no alsoRoles', !f({ label: 'Load', role: 'Supply Chain' }, 'Warehouse')); }
ok('the notWho filter still hides the job from whoever made the truck', /x\.notWho&&_me&&x\.notWho\.indexOf\(_me\)>-1&&role!=='COO'/.test(grab('tdItems')));
ok('My job lists Review truck for the Warehouse role', /'Warehouse':\['Review truck','Issue sample','Sample gate pass'\]/.test(html));
ok('The Guide names Saad or Shoaib and says never Zain', /Saad \(Supply Chain\) or Shoaib \(Warehouse\) reviews it, never the person who loaded the truck or issued its gate pass and never Zain/.test(html));
ok('the truck release job no longer names Saad (the sample one still does)', /not reviewed by Saad or Shoaib in '\+TRUCK_REVIEW_HOURS/.test(html));
ok('the 13b changelog entry exists (BUILD_ID itself is pinned by buildid.test.js)', /ver:'2026-10-13b'/.test(html));
ok('the 3 sample rules are untouched (Saad only, Review sample role)', /'Supply Chain':\['Review truck','Review sample'\]/.test(html) && /<b>Saad reviews<\/b> it \(after 2 hours/.test(html));
/* the truck card's Review button */
const card = grab('shipCard') || '';
ok('the truck card offers Review to the review roles, not only Supply Chain', /\(!_rv&&TRUCK_REVIEW_ROLES\.indexOf\(state\.role\)>-1&&!truckMadeByMe\(g\.rows\)\)/.test(html) && !/\(!_rv&&state\.role==='Supply Chain'\)/.test(html));
{ const mk2 = (user, rows) => new Function('state', '_uRole_unused', grab('_uRole') + '\n' + grab('truckFixers') + '\n' + grab('truckMadeByMe') + '\nreturn truckMadeByMe;')({ role: 'Warehouse', currentUser: { name: user, username: user } });
  ok('truckMadeByMe: true for the loader and for the gate pass issuer', mk2('shoaib')(mkRows('shoaib', 'x')) && mk2('saad')(mkRows('x', 'saad')));
  ok('truckMadeByMe: false for someone who did neither, or no username', !mk2('saad')(mkRows('shoaib', 'shoaib')) && !mk2('')(mkRows('', '')));
  const fx = mkRows('shoaib', 'shoaib'); fx[0].sentBack = { by: 'Fahim', fixedAt: '2026-10-15T08:00:00Z', fixedByUser: 'saad' };
  ok('15f: truckMadeByMe is true for whoever fixed the sent-back truck', mk2('saad')(fx));
  const fh = mkRows('shoaib', 'shoaib'); fh[0].sentBackHistory = [{ fixedAt: '2026-10-14T08:00:00Z', fixedByUser: 'zain' }];
  ok('15f: ...also for an earlier fixer', mk2('zain')(fh));
  const rv = run('Supply Chain', 'saad', fx, 'reviewTruck'); ok('15f: the fixer is refused inside Review itself', /fixed this truck/.test(rv.toasts.join(' ')) && !reviewed(rv)); }
report();
