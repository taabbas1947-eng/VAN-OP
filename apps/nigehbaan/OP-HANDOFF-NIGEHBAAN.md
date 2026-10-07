# OP-HANDOFF-NIGEHBAAN · session log (append-only, CLAUDE.md §4.1 rules)

## 7 Oct 2026 — App folder and build plan (MODULE: NIGEHBAAN) — NOT PUSHED

Tahir: move the demo into apps/, then plan the tables, how it fits the single
platform login, the feature plan and how its roles are made, so he can give the
plan to the collaborator.

- Made `apps/nigehbaan/`. Moved `Nigehbaan-demo.html` (to `nigehbaan-demo.html`)
  and the staff note `نگہبان Nigehbaan.docx` (to `docs/`) from `VAN Platform\`.
- Both are kept out of git by `apps/nigehbaan/.gitignore`: the VAN-OP repository
  is public (new S-07 in `docs/SECURITY-REGISTER.md`), the demo's seed holds the
  real obligation and licence register, and the note lists VAN's lapses.
- Wrote `docs/NIGEHBAAN-PLAN.md`: what carries over from the demo, the login and
  contacts model (rulings of 26 to 27 Sep), the platform changes P1 to P8, a
  role proposal (admin, lead, owner, staff; committee as a seat), about 33
  `ngb_` tables, steps N0 to N8, and decisions D1 to D8.
- Roles and the access matrix are the collaborator's call; §4 is a proposal.
- Not touched: `server.js`, `launcher.html`, `CLAUDE.md` module map,
  `docs/RESTRUCTURE-PLAN.md` §8.1 (still shows the demo at `VAN Platform\`).
  Those are PLATFORM edits for their own session.

Next: the collaborator rules on D2 to D5 and D8; Tahir on D1, D6, D7. Then N1
(PLATFORM) and N2.
