/* THE FRESH-EYES AUDIT — 24 September 2026, evening (build 24q).

   Tahir, after presenting O2S to the team: "start with fresh eyes for the audit
   and a few observations, and if anything is missing from the system, we will
   build it." The audit rendered every screen for all 20 live accounts on the
   live data (read-only: saves and non-GET requests blocked in the audit tab)
   and every screen for all 15 roles offline at desktop and phone width. No
   screen threw, none printed undefined/NaN/null, none overflowed on a phone.
   What it did find, and what this build changes:

   1. Today's footer spoke to a developer, not to a Lab Rep: "Live O2S. What you
      press here is saved exactly as before - the button is the same action, it
      just no longer hides behind a tab." It is gone.
   2. An empty Today shows "what is open in the plant right now". It counted
      jobs the Plant Manager had put on hold until 15 Oct, so it said 32
      production runs while the Production team's own list said 29. On-hold
      jobs are now left out of those counts and named on one line of their own.
   3. Nobody holds the KAM role (20 logins, 0 KAM), yet the print-on-pack job
      for an order that has no answer was addressed to KAM, so it sat with
      nobody until it escalated. Tahir: route it, do not nominate a KAM - to
      Finance (Muhammad Ismail had already answered 12 of the 61 on live data).
      The escalation to the COO is unchanged.
   4. "60,000 Kg/L to make" named no unit. Tahir: Liquid is L, every other form
      is Kg. unitOf(brand) reads the product's form; a product it cannot find
      keeps Kg/L rather than guess. Mixed totals across products stay Kg/L.
   5. ahmer is the system administrator, not a stray second COO. Tahir: keep
      the COO rights, show the title "System Administrator".

   Run: node freshaudit.test.js */
const H = require('./harness.js');
const vm = require('vm');
const { ok, eq, report, grab, grabTopVar, html } = H;

function has(name) { try { grab(name); return true; } catch (e) { return false; } }

/* 1. the developer footer */
const st = grab('screenToday');
ok('Today no longer carries the developer footer', !/Live O2S\. What you press here/.test(st));
ok('Today still shows the plant pulse on an empty list', /tdPlantPulse\(\)/.test(st));

/* 2. the pulse leaves out jobs on hold */
{
  const src = grab('tdPlantPulse') + '\n' + grab('tdGroups') + '\n' + grab('_tdEsc');
  const box = { console, TODAY: new Date('2026-09-24'), TD_LABEL: { 'Ship': { title: 'Ready to ship' } } };
  box.actionItems = () => [
    { label: 'Open Production', l: { brand: 'Enrich' }, o: { id: 'A' } },
    { label: 'Open Production', l: { brand: 'Max Sulfur' }, o: { id: 'B' }, hold: 1 },
    { label: 'Open Production', l: { brand: 'Cal-Mag V' }, o: { id: 'C' }, hold: 1 },
    { label: 'Ship', o: { id: 'D' } },
  ];
  box.acDeferActive = it => it.hold ? { until: '2026-10-15', reason: 'Scheduled later', by: 'Plant Manager' } : null;
  vm.createContext(box);
  let out = '';
  try { vm.runInContext(src, box); out = box.tdPlantPulse(); } catch (e) { out = 'THREW ' + e.message; }
  ok('the pulse counts 1 production run, not the 2 on hold', /Production runs<\/span><i[^>]*><\/i><b>1<\/b>/.test(out), out.slice(0, 300));
  ok('the pulse names the jobs on hold on a line of their own', /2 jobs are on hold/.test(out), out.slice(-300));
  ok('the pulse still counts the ready-to-ship job', /Ready to ship<\/span><i[^>]*><\/i><b>1<\/b>/.test(out));
  ok('no price on the pulse', !/price/i.test(grab('tdPlantPulse')));
}

/* 3. print-on-pack goes to Finance */
{
  const ai = grab('actionItems');
  ok('the print-on-pack job is addressed to Finance', /items\.push\(\{role:'Finance',[^\n]*\n\s*what:'Answer print-on-pack/.test(ai));
  ok('no job in actionItems is addressed to KAM any more', !/role:'KAM'/.test(ai));
  ok('its escalation to the COO is unchanged', /'Print price':\[3,'COO'\]/.test(html));
}

/* 4. the unit */
ok('unitOf exists', has('unitOf'));
if (has('unitOf')) {
  const box = { console };
  box.customProducts = () => [
    { brand: 'Tervalis', form: 'Pellet' }, { brand: 'Humi Cash', form: 'Crystal' },
    { brand: 'VL-NPK', form: 'Liquid' }, { brand: 'V-Mg Essential', form: 'Powder' }, { brand: 'No Form' },
  ];
  vm.createContext(box); vm.runInContext(grab('unitOf'), box);
  eq('a Liquid product reads L', box.unitOf('VL-NPK'), 'L');
  eq('a Powder product reads Kg', box.unitOf('V-Mg Essential'), 'Kg');
  eq('a Pellet product reads Kg', box.unitOf('Tervalis'), 'Kg');
  eq('matching ignores case and spaces', box.unitOf('  humi cash '), 'Kg');
  eq('an unknown product keeps Kg/L rather than guess', box.unitOf('Nothing Like It'), 'Kg/L');
  eq('a product with no form keeps Kg/L', box.unitOf('No Form'), 'Kg/L');
  eq('no brand keeps Kg/L', box.unitOf(''), 'Kg/L');
  box.customProducts = () => { throw new Error('boom'); };
  eq('a failure keeps Kg/L', box.unitOf('VL-NPK'), 'Kg/L');
}
ok('a production run on Today names its unit', /unitOf\(one\.l\.brand\)\+' to make/.test(grab('tdCardHTML')) && !/Kg\/L to make/.test(grab('tdCardHTML')));
ok('a line on the order sheet names its unit', /unitOf\(l\.brand\)\+' ordered/.test(grab('openOrderSheet')));

/* 5. ahmer */
{
  const ut = grabTopVar('USER_TITLE', '{');
  ok("ahmer's title is System Administrator", /'ahmer':'System Administrator'/.test(ut), ut);
  ok('the two earlier per-person titles are kept', /'aliraza':'Production Associate'/.test(ut) && /'mali':'Chief Commercial Officer'/.test(ut));
}

/* it ships */
ok('BUILD_ID is 2026-09-24q or later', /BUILD_ID\s*=\s*'2026-09-(24[q-z]|2[5-9][a-z]|30[a-z])'/.test(html));
ok('the changelog tells people', /ver:'2026-09-24q'[\s\S]{0,900}(Finance|litre|L for)/.test(html));



/* 6. What's changed - newest first, and not a wall.
   Offline, a first login opened "46 updates since your last visit" starting with
   4 September. Every one of the 20 people logged in for the first time on
   24 September, and every new phone starts from nothing, so that is what each
   of them met first. Newest first; the 5 newest; one line for the rest. */
{
  const src = grab('renderWhatsNewHtml');
  const box = { console, _av: v => String(v) }; vm.createContext(box); vm.runInContext(src, box);
  const E = []; for (let i = 1; i <= 12; i++) E.push({ ver: 'v' + i, date: '2026-09-' + String(i).padStart(2, '0'), title: 'Title ' + i, items: ['item ' + i] });
  const out = box.renderWhatsNewHtml(E);
  ok('the newest update comes first', out.indexOf('Title 12') > -1 && out.indexOf('Title 12') < out.indexOf('Title 11'), out.slice(0, 200));
  ok('only the 5 newest are listed', /Title 8</.test(out) && !/Title 7</.test(out));
  ok('the rest are counted on one line', /7 earlier updates/.test(out));
  ok('the header still counts every update', /12 updates since your last visit/.test(out));
  const one = box.renderWhatsNewHtml([E[0]]);
  ok('a single update has no "earlier" line', !/earlier update/.test(one) && /Title 1</.test(one));
}
process.exitCode = report('The fresh-eyes audit (24q)') ? 1 : 0;
