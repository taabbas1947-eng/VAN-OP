# O2S System Documentation — draft format (read this first)

You are drafting part of the in-app System Documentation for O2S (VAN's order-to-shipment app).
App: /home/claude/repo/apps/o2s/o2s.html (one file, ~2.6 MB; use grep and read around matches; never read it whole).
Tests: /home/claude/repo/apps/o2s/tests/*.test.js. Server routes: /home/claude/src/server.js (O2S routes: /api/state, /api/rev, /api/users), /home/claude/src/apps/o2s/public-routes.js.
History and decisions: /home/claude/src/apps/o2s/OP-HANDOFF-O2S.md (6,800 lines, from June 2026), /home/claude/src/apps/o2s/docs/*.md (specs, SOP, fault register, open items, access), /home/claude/src/docs/*.md (platform, security register), /home/claude/src/CLAUDE.md (repo rules), /home/claude/src/OP-HANDOFF.md.
Real data shape (July snapshot, field names only matter): /home/claude/repo/data/state.json. Live list names and counts (15 Oct 2026): rawStock:o orders:72 shipments:286 productionLog:258 packingLog:332 rmRequests:0 rmMovements:0 audit:1329 actionLog:3470 masters:o batches:126 packedStock:o warehouses:3 dealers:7 seq:n shiftEntries:363 dataFixEnabled:b prs:0 tipsDismissed:o inspections:250 shipSerial:n period:s dashLens:o customers:35 acDefer:o corrections:30 taken:o samples:1 poMoves:2; orders[].lines[]:240; batches[].lots[]:233. New in 15g: orders[].lines[].waitMarks[]. New in 16a (being built tonight): readSigns[] (one row per read-and-sign: id, brief, user, name, role, typed, at, build, parts, wrong).

TRUTH RULES (hard):
- Write only what the code, the tests or these files show. Cite the source for every item in "src" (function name in o2s.html, file name + heading, or handoff entry date).
- If you cannot prove something, still write the item but set "status":"not confirmed" and put the open question in "ask" (one plain multiple-choice style question for Tahir). Never guess an owner, a date, a number or a rule.
- Owner = the role (or named person if the files name one) responsible for the item. Unknown → "owner":"not confirmed".
- Plain English as used in Pakistan, short sentences, numbers as digits, no em dashes. Names used on the floor: Tahir (COO), Fahim (Plant Manager), Majid (Production Manager), Saad (Supply Chain), Zain (Supply Chain Officer), Shoaib (Warehouse), Ali Raza and Jawad (Production), Asif (QA Inspector) — use names only where the files use them.
- Rule numbers: Guide rules are R-001..R-035 (list in /home/claude/sysdoc/RULES.txt). Formulas/limits: F-### (you create, starting F-001 in your own range given below). Decisions: D-### (range given below). Link items to rule numbers in "rules":[...].

OUTPUT: one JSON file per tab you own, at /home/claude/sysdoc/<tabkey>.json, shaped:
{ "tab":"<tabkey>", "title":"...", "ver":"2026-10-16a", "date":"2026-10-16", "owner":"<role owning this tab or not confirmed>",
  "intro":"1-3 sentences: what this tab holds and how to read it",
  "items":[ { "id":"PF-01", "title":"...", "owner":"...", "rules":["R-013"], "status":"confirmed"|"not confirmed", "src":["fn actionItems","OP-HANDOFF-O2S.md 2026-10-15 (10)"], "ask":"(only if not confirmed)",
              "blocks":[ ...see block types... ] } ] }
Block types (use only these):
 {"p":"text"}  {"list":["a","b"]}  {"table":{"head":["..."],"rows":[["..",".."]]}}
 {"lanes":{"roles":["KAM","Supply Chain",...],"steps":[{"role":"KAM","text":"Raise the PO","rule":"R-010","kind":"start|task|decision|end|sendback"}, ...]}}   (a swimlane flow: steps in order, each in one role's lane; decisions say their outcomes in text like "Cleared? yes: next; no: back to Lab")
 {"states":{"name":"Truck stage","rows":[["from","event / who","to"]]}}
 {"note":"text"}   (a caution or not-confirmed remark)
Keep each item focused. Validate your JSON with: node -e "JSON.parse(require('fs').readFileSync(process.argv[1]))" <file>.
Do not edit any app, test or source file. Write only inside /home/claude/sysdoc/.
