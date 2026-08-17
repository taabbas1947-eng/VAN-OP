# PD audit — findings, patches and supporting documents

Everything produced by the Product Development audit of 16–17 August 2026.
Kept out of `pd/` on purpose: **`pd/` is code, this is the record.**

## The documents

| File | What it is |
|---|---|
| `VAN_PD_Audit_of_Faults.docx` | The audit. 25 pages, faults only, severity-ordered with stable IDs (A1, C4, F7 …). Part F covers where the software contradicts Specification v2 and Team Briefing v2; Part G covers how to run an NP 5-40-shaped project on it. **Start here.** |
| `VAN_PD_Fix_Pack.docx` | The first 13 fixes, each with before/after proof from a live test run. |
| `VAN_Briefing_Corrections.docx` | Eleven promises in Team Briefing v2 the software does not keep, with replacement wording. Read before the briefing goes out. |
| `VAN_Hosting_and_Mail_Setup.docx` | For the technical team. The Render free-tier SMTP block, the ephemeral-disk problem, and what to configure. Written to be forwarded without context. |
| `PD-AUDIT-2026-08-16.md` | The original markdown audit. Superseded by the Word version, kept for its file:line references. |

## The patches

Apply in this order. A `.patch` file is a set of instructions, not code —
committing it changes nothing. It only takes effect when you run `git apply`.

| Order | File | Fixes |
|---|---|---|
| 1 | `VAN_PD_fixpack.patch` | A1 A2 B1 B2 B5 C1 C2 C3 C5 C8 D10 D12 E9 |
| 2 | `VAN_PD_02_intake.patch` | D1 D2 D3 D4 D5 |
| 3 | `VAN_PD_03_queues.patch` | D6 D7 D9 |
| 4 | `VAN_PD_04_robots.patch` | B8b — robots.txt and a real 404 for unknown API paths |

```
git checkout -b some-branch
git apply --check docs/pd-audit/VAN_PD_fixpack.patch    # silent = it will apply
git apply docs/pd-audit/VAN_PD_fixpack.patch
```

All four were applied to a copy, booted against a real MariaDB, and driven
through a browser as each of the ten PD roles before being handed over.

## Status as of 17 August 2026

- Patches 1–3 are committed on branch `prelaunch-fixes`, **not merged into `main`**.
- Patch 4 is applied on `main` (commit `2a1e7a0`).
- A test merge of `prelaunch-fixes` into `main` was simulated in a scratch clone:
  clean, no conflicts, no duplication, and the result hashes identical to the
  tested builds.

## Still open — 18 code items

Not done: A3 A4 A5 A6 A7 B4 B6 B7 B9 B10 C4 C6 C7 D8 D11 D13 D14 F1,
plus the rest of D9 and D12. E1–E8 (the role model) and F2/F5–F11 (spec and
briefing gaps) are held deliberately until there is real usage to decide from.

## Three things no patch can do

1. Change every seeded password. Confirm `van@2026` is not live, especially on
   `admin` — the PD migration auto-grants that account the `coo` role.
2. Confirm `SESSION_SECRET` is set to a fixed value, or every deploy silently
   signs everybody out.
3. Confirm the Render instance is Starter with a disk attached, and that
   `PD_LIBRARY_DIR` points inside it — otherwise Library uploads are deleted on
   every deploy while the database still lists them.
