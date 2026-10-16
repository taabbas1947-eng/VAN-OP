# O2S System documentation: the source

This folder is the source of the System documentation shown in O2S
(Guide → System documentation, and the Back Office desk).

- 1 JSON file per part: flows, dataflows, logic, schema, api, decisions,
  formulas, dictionary, access, tests. The Guide and the Change log parts are
  drawn live from the app (guideRules, CHANGELOG), so they have no file here.
- SCHEMA.md: the item format (id, title, owner, rules, status, src, ask,
  blocks) and the truth rules. RULES.txt: the Guide rule numbers R-001 onward.
- build_sysdoc.py: rebuilds `SYSDOC_DATA` inside `../../o2s.html` from these
  files, and stops with an error if security text, or text that breaks a
  whole-file test, gets in. Run it with `python3 build_sysdoc.py`, then run the
  O2S tests (`tests/audit16a.test.js` fails the build on a gap).

Rule (CLAUDE.md §2, Tahir 15 Oct 2026): every change updates its part here in
the same change, then the build script, then the tests. Never edit
`SYSDOC_DATA` in o2s.html by hand.

Security findings never go here: the app page can be opened before sign-in.
They stay in docs/SECURITY-REGISTER.md.
