/* SAAD IS THE DISPATCH AUTHORITY — 23 September 2026.

   Tahir: "Plant Manager is no more a cover. Saad becomes the authority to approve
   dispatch, or wherever dispatch has an approval point."

   There are exactly three approval points on the truck pipeline, and all three
   were bare hardRole(['Plant Manager']) checks rather than rights:

     approveDC       approve the Delivery Challan
     rejectDC        reject it, voiding the DC and returning the material
     approveRelease  release the loaded truck through the gate

   They stay hardRole - deliberately. rights.test.js draws the line this file sits
   on: doing your own job follows the access matrix; SIGNING OFF SOMEBODY ELSE'S
   work never does, because a screen grant given for an ordinary reason must not
   buy the right to approve. What changes is whose name is in the check.

   WHAT THIS COSTS, said plainly rather than discovered later. Separation rule 4
   in the live code reads "The person who loads does not release", naming
   shipment.load + shipment.release. Saad now holds shipment.load AND approves the
   release. In practice Shoaib and Zain load and Saad approves, which is the shape
   the rule wants; but nothing in the app stops Saad loading a truck himself and
   then releasing it. The rule cannot fire either way - shipment.release is one of
   the six codes that were never added to RIGHTS - so this is a note for the COO,
   not a control. It is pinned here so it is not mistaken for an oversight.

   Run: node dispatchauthority.test.js */
const H = require('./harness.js');

let pass = 0, fail = 0; const fails = [];
function ok(n, c, x) { if (c) pass++; else { fail++; fails.push(n + (x ? '  [' + x + ']' : '')); } }
function eq(n, g, w) { ok(n, g === w, 'got ' + JSON.stringify(g) + ' want ' + JSON.stringify(w)); }

const POINTS = ['approveDC', 'rejectDC', 'approveRelease'];

/* ================= 1. THE THREE APPROVAL POINTS ================= */
POINTS.forEach(fn => {
  const src = H.grab(fn);
  ok(fn + " asks hardRole(['Supply Chain'])", /hardRole\(\['Supply Chain'\]\)/.test(src), src.slice(0, 120));
  ok(fn + ' no longer asks the Plant Manager', !/hardRole\(\['Plant Manager'\]\)/.test(src), src.slice(0, 120));
  /* A sign-off must never follow the access matrix - a screen grant given for an
     ordinary reason would otherwise buy the authority to approve. */
  ok(fn + ' does NOT follow the access matrix', !/canEdit\(/.test(src) && !/accessLevel\(/.test(src));
  ok(fn + ' still lets the COO act', /hardRole\(/.test(src));
  /* and the refusal has to name the right person, or it sends people to someone
     who can no longer help */
  ok(fn + ' names Supply Chain in its refusal', /Supply Chain/.test(src), (src.match(/toast\('[^']{0,70}/) || [''])[0]);
  ok(fn + ' does not name the Plant Manager in its refusal', !/toast\('Plant Manager/.test(src));
});

/* ================= 2. THE GRANT TABLE ================= */
{
  const flat = H.html.replace(/\s+/g, ' ');
  ok('dispatch is granted to the three who do it, and no longer to the Plant Manager',
     /var DISPATCH_GRANT=\{'Supply Chain':true,'Warehouse':true,'Supply Chain Officer':true\}/.test(flat));
  /* "This is again a burden on Plant Manager, Saad should do, no one else - we
     will decide who is to cover later." So procurement is one name, and the only
     fallback is the COO until Tahir names a cover. */
  ok('procurement is Saad alone - no cover named yet',
     /var PROCUREMENT_GRANT=\{'Supply Chain':true\}/.test(flat));
  ok('...and the source says there is no cover, rather than leaving it to be found',
     /THERE IS NO COVER/.test(H.html));
}

/* ================= 3. THE ESCALATION PATH ================= */
/* A dispatch item that goes quiet must now nudge Saad, not the Plant Manager.
   Release and Approve DC still escalate to the COO, because those are Saad's own
   approvals - an escalation has to go ABOVE the person sitting on it. */
{
  const esc = H.grab('acEscalation');
  [['Ship', 'Supply Chain'], ['Load', 'Supply Chain'], ['Gate Pass', 'Supply Chain'],
   ['Confirm delivery', 'Supply Chain'], ['Release', 'COO'], ['Approve DC', 'COO']].forEach(([k, who]) => {
    const m = new RegExp("'" + k + "':\\[\\d+,'" + who + "'\\]").test(esc);
    ok("a stale '" + k + "' escalates to " + who, m, (esc.match(new RegExp("'" + k + "':\\[[^\\]]*\\]")) || [''])[0]);
  });
  ok('no dispatch step escalates to the Plant Manager any more',
     !/'(Ship|Load|Gate Pass)':\[\d+,'Plant Manager'\]/.test(esc));
  /* Quality still does - this ruling was about dispatch only. */
  ok('Quality still escalates to the Plant Manager', /'Pack QC':\[\d+,'Plant Manager'\]/.test(esc));
}

/* ================= 4. THE SEPARATION NOTE ================= */
{
  const sep = H.grabTopVar('SEPARATION', '[');
  ok('rule 4 still says the person who loads does not release',
     /the person who loads does not release/.test(sep));
  ok("...and shipment.release still isn't a real code, so it cannot fire",
     H.grabTopVar('RIGHTS', '[').indexOf("code:'shipment.release'") < 0);
  ok('the tension is written down in the source, not left to be found',
     /Saad now\s+holds shipment\.load AND approves the release/.test(H.html));
}

console.log('\nSaad is the dispatch authority: ' + pass + ' passed, ' + fail + ' failed');
fails.forEach(f => console.log('  FAIL  ' + f));
process.exit(fail ? 1 : 0);
