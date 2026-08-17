# pd/reviews — Product Development reviews and audits

**PD only.** Nothing about O2S or the platform belongs in this folder.
O2S and platform reviews stay in the repo-root `reviews/` folder, per the
module map in `CLAUDE.md` (PD owns everything under `pd/`).

| File | What it is |
|---|---|
| `VAN_PD_Audit_of_Faults.docx` | Full audit of the PD module — faults only, severity-ordered, with fault IDs (A1, C4, F7 …). Includes Part F (where the software contradicts the signed Specification v2 and Team Briefing v2) and Part G (how to run an NP 5-40-shaped project on this system). |
| `VAN_PD_Fix_Pack.docx` | The 17 pre-launch fixes, each with before/after proof from a live test run. |
| `VAN_PD_fixpack.patch` | The actual code for those fixes. **Not applied.** 116 lines added, 22 removed, across `server.js`, `launcher.html`, `pd/pd.html`, `pd/pd-routes.js`. Apply with `git apply` on a branch. |
| `VAN_Briefing_Corrections.docx` | Eleven promises in Team Briefing v2 that the software does not keep, with suggested replacement wording. Read before the briefing goes out. |
| `PD-AUDIT-2026-08-16.md` | The original markdown audit. Superseded by the Word version above — kept for the file:line references. |

All four were produced 16 August 2026 against `main @ a67ad0a`, working tree clean.
The audit was done by reading the source and then booting the application against a
real MariaDB and driving it through a browser as each of the ten PD roles.

## Three things no patch can do — check these before anyone signs in

1. Change every seeded password. Confirm `van@2026` is not live on any account,
   especially `admin` (which the PD migration auto-grants the `coo` PD role).
2. Confirm `SESSION_SECRET` is set in Render. If it is not, every deploy silently
   signs everybody out.
3. Confirm `PD_LIBRARY_DIR` points at a persistent disk, or switch off document
   upload. Otherwise uploaded files are wiped on every deploy while the database
   still lists them.
