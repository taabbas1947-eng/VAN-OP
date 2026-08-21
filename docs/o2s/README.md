# O2S — development notes, faults and specs

**Module: O2S (Order to Ship) only.** Nothing in this folder describes, changes
or applies to PD. If a change here would touch `pd/` or `/api/pd/*`, it is out
of scope and must be split into a separately declared PD session
(`CLAUDE.md` §0.2).

---

## What this folder is

O2S went live with real orders, real batches and a real team. These documents
exist because the five problems Tahir raised on **2026-08-21** are not five bugs
— they are five consequences of the app having been built screen-by-screen
rather than to one model. Fixing them one at a time, on a live system, is how
you get a sixth problem. So the sequence is: **write down what is actually
wrong, agree the standard, then change the code.**

Every finding in here was verified by reading `o2s/o2s.html` — the whole app is
that one 8,054-line file. Line numbers refer to the version last modified
**2026-08-16** (`o2s.html`, 1,205,471 bytes). They will drift as soon as anyone
edits the file; treat them as *where to look*, not as an address.

---

## The documents

| File | What it is | Read it when |
|---|---|---|
| [`FAULT-REGISTER.md`](FAULT-REGISTER.md) | The five problems, each with the code that proves it, severity, and what it costs the business | First. Everything else refers back to it |
| [`UI-FIELD-AUDIT.md`](UI-FIELD-AUDIT.md) | Every field in the app measured — why text is hidden, with the actual pixel arithmetic | Before touching any form or modal |
| [`SPEC-01-PRICE-VISIBILITY.md`](SPEC-01-PRICE-VISIBILITY.md) | Making the print price visible everywhere it matters | Fault 1 |
| [`SPEC-02-PO-DOSSIER.md`](SPEC-02-PO-DOSSIER.md) | One page per PO line holding every record and every trail | Fault 3 |
| [`SPEC-03-EDIT-STANDARD.md`](SPEC-03-EDIT-STANDARD.md) | The single correction path that must apply to every record type | Fault 4 |
| [`SPEC-04-REALTIME-DISCIPLINE.md`](SPEC-04-REALTIME-DISCIPLINE.md) | Actual date vs recorded date, entry-lag visibility, and the N-day lock with Plant Manager override | Fault 5 |

---

## The original intent — the test every change must pass

These are Tahir's words for why O2S was built, restated as acceptance tests. A
change that does not move one of these forward is not a priority.

1. **We can see where an order is, who is holding it, and since when.**
2. **A batch number can trace everything, even years later.**
3. **Production shows when they produced, where it is stuck, and who produced it.**
4. **Pre-shipment inspection guarantees nothing leaves the factory unless it
   meets quality, packing, price-as-per-PO, batch number, manufacturing and
   expiry.**
5. **The shipment stage makes documents and approvals automatic.**

Measured against those five, the honest position today is:

| Intent | Status | Why |
|---|---|---|
| 1 · Where is the order, who holds it, since when | **Partly** | Owner and escalation exist in the Action Center; "since when" is unreliable because event dates are stamped at keying time, not at event time (Fault 5) |
| 2 · Batch traces everything, years later | **Partly** | `rpTrace` traces base batch ⇄ brand batch by quantity. It does not reach the COA, the inspection, the DC or the customer from one place (Fault 3) |
| 3 · Production: when, where stuck, who | **Mostly** | Lots carry shift and incharge; the stuck/blocked view works. Weakened by Fault 5 |
| 4 · Nothing leaves unless it meets quality, packing, **price as per PO**, batch, mfg, expiry | **No** | The 8-point QA checklist has no price line, and the PO's print price is not shown to the inspector at all (Faults 1 and 5) |
| 5 · Shipment documents and approvals automatic | **Yes** | DC, Gate Pass, serial generation, Plant Manager approval and truck release all work. This is the strongest part of the system |

---

## Working rules for anyone picking this up

- **One file.** The entire O2S front end is `o2s/o2s.html`. There is no build
  step, no bundler, no framework. Edits are direct.
- **State is one JSON blob.** All O2S data lives in a single `app_state` row
  (see `docs/ARCHITECTURE.md` §6). There is no schema to migrate — which means
  there is also nothing stopping a bad write. Adding a field is free; removing
  or renaming one is not.
- **Never push.** Build, verify, then say "ready to push (not pushed)". Tahir
  pushes from GitHub Desktop (`CLAUDE.md` §2).
- **Take a Data Fix snapshot before any change that writes to existing records.**
- **Close every session** by appending to `OP-HANDOFF.md` (`CLAUDE.md` §4).

---

*Created 2026-08-21. Owner: Tahir. Module: O2S.*
