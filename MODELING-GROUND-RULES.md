# VAN-OP — Modeling Ground Rules (PERMANENT)

_Set by Tahir, 2026-06-17. These are standing rules for every change in this repo. Claude must honour them in every session. They override convenience or speed._

## 0. SYSTEM CHARTER (Tahir, 2026-07-28 — what this system IS and IS NOT)
- **This system does NOT manage cost.** No product costing, no raw-material cost tracking, no cost attribution, no margin/financial analysis — do not build, extend, or surface cost features. Existing cost fields in code are dormant legacy; they are removal candidates, never a foundation.
- **Purpose:** track every task **from order to shipment**; ensure each process step is handled **timely and carefully**; track **quality and production**; and build **clean, trustworthy data for future learning and modelling**.
- **The batch ID is the CORE key.** Every feature must preserve batch-id traceability across production → lots/COA → packing → shipment → logistics → supply chain. Nothing may break, blur, or duplicate a batch id (see the 2026-07-28 duplicate-id incident).
- Sales-side order data (invoice price on POs, sales targets/budget) is order information, not costing — it stays in scope.

## 1. We are MODELING, not pushing
- Build and verify changes locally only. **Never push.** Tahir pushes via GitHub Desktop. Claude cannot push and must not assume anything is live.
- After building, leave changes "ready to push (not pushed)" and say so.

## 2. Do not touch live/master data without explicit approval
- **Ask Tahir before ANY master-data change** (recipes, raw materials, products/brands, clients, channels, production groups, lead-time values, reference lists, prices, access matrix, users, etc.).
- If a requested feature would require a master-data change, STOP and ask first — describe exactly what master field/structure would change and why.
- Code-only changes (logic, display, computed views) are fine without a data change, but must follow rules 3–5.

## 3. No noise, no false signals
- New features must NOT create false alerts, false overdue/delay flags, or spurious entries in **My Actions / Actions Center**.
- Do NOT add to the audit log, action log, or any notification/count that the team reacts to, unless Tahir explicitly asks.
- Counts the team relies on (open, overdue, at-risk, pending) must only change when the underlying real data changes — never as a side effect of a display feature.

## 4. Read-only by default
- New computed features (scores, rankings, badges, roll-ups, dashboards) must be **pure compute + display**: they read state, never write it.
- No new stored fields on orders/lines/shipments/etc. unless approved as a deliberate data-model change (which is a rule-2 conversation).

## 5. Data-change safety (only when approved)
- Snapshot the DB first (app's "Download data snapshot"). Keep the snapshot as the restore point.
- Any data migration must be idempotent and guarded (one-time flag), and must never delete real work (packing/production/shipments). Verify against the real snapshot in isolation before it can run.

## 6. Integrity
- Don't invent recipe ratios, rates, or lead times — flag anything unverified as a placeholder and make it editable. (Costs are out of scope entirely — rule 0.)
- Verify edits against the real snapshot/logic in the sandbox; confirm host-file integrity (the bash mount can be stale — trust the file tools).

---
_Reference: see also `OP-HANDOFF.md` for current state and pending-push items._
