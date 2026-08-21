# PD rebuild — what may be reused, and how drift gets caught

_Written 18 August 2026. Tahir ruled: **build on the existing app rather than delete
`pd/` and start fresh** — on condition that reuse does not quietly pull the rebuild
back toward the structure it is meant to replace._

**This file exists because that risk is real and specific.** It is a rule file, not
advice. If code and this document disagree, this document wins until Tahir signs a
change.

---

## 1. The failure mode being guarded against

`pd-lib.js` says it in its own header: the port was *"intentionally faithful to that
source rather than 'improved'."* Faithfulness was the right call for a port. It is
the wrong call for the rebuild, and it does not creep back in as a decision — it
creeps back as **vocabulary**.

Open `pd.html` (1,923 lines) or `pd-routes.js` (1,751 lines) to "see what's good",
and what carries over is not just the code. It is *hypothesis, route, gate, dev
record, G1–G6, ten roles, twenty surfaces.* Each one looks individually reasonable
on the screen in front of you. Twenty individually reasonable surfaces is exactly
how you arrive at a system nobody puts anything into.

**So the safe form of reuse is: lift named components into a new core. Never extend
the old spine, and never read it for orientation.**

---

## 2. The whitelist — this is the complete list

Nothing outside this table may be carried into the rebuild. Additions require
Tahir's explicit sign-off, one item at a time, recorded here.

| # | What | Where | Why it survives |
|---|---|---|---|
| 1 | Candidate arithmetic engine | `pd/pd-lib.js:188–232` — `exworks = (rm + conversion)/(1 − loss)`; `cost_per_kg_p = exworks/(10p)` | Independently re-derived and correct to the paisa. A pure function with no dependency on the gate model. |
| 2 | Library file storage + auth-gated serve | `pd/pd-routes.js:1291` (`LIBRARY_DIR`, `PD_LIBRARY_DIR`), serve at `:1435–1440` | Files outside the web root, looked up by DB id, `basename`-guarded, auth-checked, `nosniff` + restrictive CSP. Four upload guards. 30 assertions. |
| 3 | Drop box + similar-idea check | `pd/pd-routes.js:1658–1661` (`GET /api/pd/similar`), drop box endpoints in the same block | The public door with honeypot and per-IP rate limit, and the "have we seen this before?" search. The Combination Bank's duplicate checker **extends this — it does not build a second one.** |
| 4 | `pd_materials` and the line-row shape | `pd/migrations/001_pd_foundation.sql:242` and `:331` | Already material_id + inclusion_pct, which is exactly what the Combination Bank needs. **There must never be a second material register.** |
| 5 | Platform plumbing | `server.js:279–314` (`pdAuth`, `pdSurface`, `pdAuditLogger`), mount at `:547` | Not PD domain code at all. Dependency-injected mount, keeps PD out of `server.js`. |
| 6 | Route-order knowledge | `CLAUDE.md` §1 | `/pd` must register **before** O2S's catch-all or `/pd` silently serves O2S. Knowledge, not code, and expensive to rediscover. |

**Everything else in `pd/` is opened only in order to delete it.**

For clarity about what that means: the gate machinery — `pd_gate_decisions`,
`pd_product_gates`, `pd_route_screens`, `pd_dev_records` and the G1–G6 flow — is
**not** on this list and is not preserved by default. See `PENDING-DECISIONS.md` #1.

---

## 3. The vocabulary ban

None of these may appear in new code — not in a table, column, function, route,
variable or button label:

`hypothesis` · `route` (as an object) · `gate` · `G1`–`G6` · `dev_record` ·
`screened → designed → sampled → tested → evaluated` as a stage chain

Names come from `MODEL.md`: **Problem · Question · Bet · Run · Claim · Challenge ·
Observation · Request · Constraint.** If a situation seems to need a name outside
that set, `MODEL.md` §3 already answers it: a seeming tenth object is almost
certainly one of the nine in a new coat, and a genuine tenth is a signal the model
is wrong — **escalate to Tahir, do not add a box.**

---

## 4. The reading rule

- Read `RULES.md`, `MODEL.md` and `How we develop products now.docx` for intent.
- Open old PD files **only at a line named in §2**.
- **Do not read `pd.html` or `pd-routes.js` end to end for orientation.** That is
  the drift, and it does not feel like drift while it is happening.

---

## 5. The drift metrics — the tripwire

The point of these numbers is that they settle the question without an argument.
Bias is hard to see and easy to deny; a screen count is neither.

The audit of 16 August 2026 measured the system being replaced. Those are the
baselines. Measure the same things at every milestone.

| Measure | Old system (16 Aug 2026) | Target | Rule |
|---|---|---|---|
| Screens a person uses | 7 (10 on the path My Work steers you down) | **2** (`MODEL.md` §5) | 3rd screen needs Tahir's sign-off |
| Human actions, idea → launched | 16 (22 on that path) | materially fewer | If it climbs, the rebuild has drifted |
| Form fields across that journey | ~95 (~140) | materially fewer | Same |
| Menu items shown to any one role | 19–21 | single figures | Same |
| Objects in the model | — | **9** | A 10th needs sign-off (`MODEL.md` §3) |
| Tables | 24 | fewer | Every new table is a decision, not a detail |
| People who must act | 6 | fewer | Same |

**If any of these rises between milestones, stop and show Tahir before continuing.**
Not "flag it in a summary" — stop.

---

## 6. Two things declared up front

1. **Claude wrote both the audit and `MODEL.md`.** So Claude is anchored toward
   believing the new model is right and the old one is heavy — the same direction as
   Tahir's own instinct, which is precisely when a shared bias is least likely to be
   caught by either party. The §5 metrics are the antidote, because they do not care
   who is right.
2. **"Build on it" and "start fresh" are now nearly the same act.** With no data in
   PD, the only real difference is that the folder, the mount and the live `/pd`
   route survive instead of breaking. **The core is still rebuilt.** If anyone later
   says "we built on the existing app", that is true of the plumbing and false of
   the spine. Nobody should expect the gates to still be there.

---

## 7. Out of scope, permanently, for this rebuild

Security, authentication, access control and infrastructure hardening. Per
`CLAUDE.md` §2A these belong to another department: findings get one dated line in
`docs/security-register/SECURITY-REGISTER.md` and nothing more. They never block a
release, never open a session, and never shape this design. Confirmed by Tahir,
18 August 2026.

---

## 8. Sign-off log — additions to the whitelist

_Empty. Any component lifted beyond the six in §2 is recorded here with the date and
Tahir's decision, or it should not be in the code._

| Date | Component | Why | Approved by |
|---|---|---|---|
| — | — | — | — |
