# PD audit — findings and supporting documents

Everything produced by the Product Development audit of 16–17 August 2026.
Kept out of `pd/` on purpose: **`pd/` is code, this is the record.**

> **The patch workflow this folder used to describe is void.** See
> `_to_delete/README-pd-audit-SUPERSEDED-2026-08-18.md` for the original text and
> why it was withdrawn. In short: `CLAUDE.md` §3.1 now forbids `.patch` files
> outright — Claude writes finished files straight into `E:\VAN-OP` and Tahir
> commits what GitHub Desktop shows. The four `.patch` files the old README told
> you to `git apply` no longer exist in this repo.

## The documents

| File | What it is |
|---|---|
| `VAN_PD_Audit_of_Faults.docx` | The audit. 25 pages, faults only, severity-ordered with stable IDs (A1, C4, F7 …). Part F covers where the software contradicts Specification v2 and Team Briefing v2; Part G covers how to run an NP 5-40-shaped project on it. **Start here.** |
| `VAN_PD_Fix_Pack.docx` | The first 13 fixes, each with before/after proof from a live test run. **The findings stand; ignore its patch-application instructions.** |
| `VAN_Briefing_Corrections.docx` | Eleven promises in Team Briefing v2 the software does not keep, with replacement wording. Read before the briefing goes out. |
| `VAN_Hosting_and_Mail_Setup.docx` | For the technical team. The Render free-tier SMTP block, the ephemeral-disk problem, and what to configure. Written to be forwarded without context. |
| `VAN_PD_Handoff_2026-08-16.docx` | The 16 August handoff. Partly superseded by `CLAUDE.md` §3 and `OP-HANDOFF.md`; its patch references are void. |
| `PD-AUDIT-2026-08-16.md` | The original markdown audit. Superseded by the Word version, kept for its file:line references. |

## Fix status — as of 18 August 2026

The old README said patches 1–3 were "committed on branch `prelaunch-fixes`, not
merged into `main`". **`CLAUDE.md` §3 now records that `prelaunch-fixes` @ `6134503`
is redundant — its changes are inside `main` — and the branch is safe to delete.**
Trust `CLAUDE.md`; it was verified more recently.

## Still open — 18 code items

A3 A4 A5 A6 A7 B4 B6 B7 B9 B10 C4 C6 C7 D8 D11 D13 D14 F1, plus the rest of D9 and
D12. E1–E8 (the role model) and F2/F5–F11 (spec and briefing gaps) are held
deliberately until there is real usage to decide from.

## Three things no fix can do

1. Change every seeded password. Confirm `van@2026` is not live, especially on
   `admin` — the PD migration auto-grants that account the `coo` role.
2. Confirm `SESSION_SECRET` is set to a fixed value, or every deploy silently signs
   everybody out.
3. Confirm the Render instance is Starter with a disk attached, and that
   `PD_LIBRARY_DIR` points inside it — otherwise Library uploads are deleted on
   every deploy while the database still lists them.

_(Per `CLAUDE.md` §2A these are the other department's to action, not Tahir's, and
they do not gate a release. They are recorded, not escalated.)_
