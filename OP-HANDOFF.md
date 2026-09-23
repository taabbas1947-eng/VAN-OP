# VAN Systems — OP Handoff · index

**This file is an index. Do not append session entries here.**

The handoff log was one 400 KB file that every module appended to. On
23 September 2026 the same entry was lost three times in one day: a session read
the file, worked for a while, then wrote back a whole-file rebuild from its now
stale copy, silently deleting everything another session had appended in
between. It was split per module the same day.

| Module | File | What belongs in it |
|---|---|---|
| **O2S** | `OP-HANDOFF-O2S.md` | Order-to-Ship — `o2s/` |
| **PD** | `OP-HANDOFF-PD.md` | Product Development — `pd/` |
| **Shared** | `OP-HANDOFF-SHARED.md` | Genuinely cross-module or platform work only |

`OP-HANDOFF-ARCHIVE-2026-09-23.md` is the original file, byte for byte, kept so
the split is reversible. Nothing in it was edited, reworded or dropped; every one
of its 74 entries and 12 preamble notes landed in exactly one of the three files
above, in its original order. The archive can be deleted once Tahir is satisfied.

---

## The rule

**One file per module.** Write to your module's file and no other. The repo
already says never edit two modules in one change; one shared log contradicted
that, so it is gone.

**Never rewrite a handoff file from a copy you have been holding.** That single
mistake caused every loss on 23 September. A whole-file write built on a stale
read deletes whatever arrived in the meantime, and neither session notices.

Before every write:

1. **Re-read the file from disk immediately before writing.** Not a copy read
   earlier in the session, however few minutes ago.
2. **Append only.** New entries go at the end. Never regenerate the file.
3. **Assert your new text begins with the exact bytes you just read.** If it
   does not, stop and re-read — something changed under you.
4. **Read it back afterwards** and confirm the previous last heading and your
   new heading are both present.

A correction to an old entry is a single exact string replacement on freshly
read content, with the target asserted to occur exactly once. **Never delete an
entry.** Corrections are appended and cross-referenced.

If you find an entry missing that you wrote earlier in the session, do not
simply re-append it: re-read the file first and splice your entry back in
without disturbing anything written since, or you will do to someone else
exactly what was done to you.

---

## What each entry should say

Module worked in · files changed · pushed or not pushed · what is next.
That file, not Claude's memory, is the continuity between sessions.
