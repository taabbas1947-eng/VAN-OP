# O2S — UI field audit

**Fault 2 in the [fault register](FAULT-REGISTER.md).** Tahir asked that every
field be checked, so every field is listed here. 167 labelled controls across
40 forms and modals in `o2s/o2s.html`.

This document has three parts: the arithmetic that explains *why* fields are
too small, the rules that fix it, and the complete field inventory.

---

## Part 1 — Why the fields are too small

Not opinion. This is measured from the stylesheet.

### The modal is 580px wide on every desktop, forever

```css
.modal{background:#fff;border-radius:16px;width:580px;max-width:95vw;max-height:90vh;overflow:auto}
```

The only override is `@media(max-width:820px){ .modal{width:96vw} }` — which
makes it *narrower*, for phones. **Between 820px and any width at all, the modal
is 580px.** A 2560px monitor gets 580px. Almost all data entry in O2S happens in
these modals.

### That gives a 3-column field 170px, and 21 characters

| Step | Calculation | Result |
|---|---|---|
| Modal width | `.modal{width:580px}` | 580px |
| Body padding | `.modal .mb{padding:18px 22px}` — 22px each side | −44px → **536px** |
| Grid gaps | `.formgrid{gap:13px}`, 2 gaps across 3 columns | −26px → 510px |
| Column width | 510 ÷ 3 | **170px** |
| Input padding | `padding:9px 12px` — 12px each side | −24px |
| Border | 1px each side | −2px |
| **Visible text width** | | **144px** |
| At `font-size:13px`, mixed-case sans (~6.8px average glyph) | 144 ÷ 6.8 | **≈ 21 characters** |

Twenty-one characters. `Bilty / reference`, `Carrier / transporter`,
`Driver contact`, `Destination`, `Remarks`, `SO # (sales order)` — every one of
these is a field where a real value is longer than the window it is typed into,
and the text scrolls out of sight with no wrap and no way to see it back except
by arrowing through it.

The dispatch modal (`renderDispatchModal`, L6085) puts **eleven** fields into
that grid. Ten of them are free text.

### There is no `<textarea>` anywhere in the application

Verified: `grep -c "<textarea" o2s.html` → **0**.

Every free-text field is `<input type="text">` — or, in two cases
(`paintUsers` L7682–7683, `renderEditUser` L7711–7712), `<input>` with no `type`
at all, which browsers treat as text.

That includes all of these, which are the fields the business actually depends
on for explanation:

| Field | Where | Type today |
|---|---|---|
| Delay reason note | PO Tracker | single-line |
| Correction reason / note | Data Fix (×2) | single-line |
| Shift note | Production shift log | single-line |
| Batch close variance note | Production | single-line |
| QA lot inspection remarks | Pre-shipment QA | single-line |
| Dispatch QA remarks | Pre-shipment QA | single-line |
| Pack inspection remarks | Pre-shipment QA | single-line |
| Shipment remarks | Shipments (×4 modals) | single-line |
| Delivery reference / note | Shipments | single-line |

### `text-overflow: ellipsis` is applied to `<select>`

```css
.fld select{text-overflow:ellipsis}
```

In Chrome this truncates the **selected value** shown in the closed dropdown,
not just the option list. At 170px, a product like
`V-GERMINATOR PRO — 5 Kg Pouch` displays as `V-GERMINATOR PRO —…`. The operator
picks a product and then cannot read which one they picked.

This is precisely Tahir's phrase *"it doesn't even show what we're adding"*.

### Labels are uppercase, letter-spaced, and allowed to wrap

```css
.fld label{font-size:10.5px;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;font-weight:700}
```

Uppercase plus 0.4px letter-spacing makes a label roughly 25–30% wider than the
same words in sentence case. There is no `white-space` rule, so labels wrap.
`INVOICE PRICE (PKR/KG·L)` takes two or three lines in a 170px column while the
label beside it takes one — and because `.fld` is a flex column inside a grid
row, the taller label pushes its input down out of line with its neighbour.
That is the "fields look broken / never adjust" symptom.

### The PO Entry line table clips by design

```css
.fixedtbl{table-layout:fixed}
.fixedtbl td,.fixedtbl th{overflow:hidden;text-overflow:ellipsis}
.fixedtbl input,.fixedtbl select{width:100%;padding:7px 8px}
```

Column widths declared at L2546:

| Column | Declared | Usable after padding + border | Verdict |
|---|---|---|---|
| Brand | (remainder) | varies | Squeezed when the nav is expanded |
| Form | 84px | 66px | Tight |
| Pack | 66px | 48px | A select showing "25 Kg" barely fits; longer values clip |
| Qty | 80px | 62px | OK for 5 digits |
| Packs | 72px | 54px | Read-only, OK |
| Invoice price (per-Kg + per-pack) | 172px | two inputs share 154px | Both clip |
| **Committed** | **118px** | **100px** | **`type="date"` needs ~120–130px in Chrome for `dd/mm/yyyy` + the picker icon — this clips** |
| **Note** | **130px** | **112px ≈ 16 characters** | **Unusable** |

### `prompt()` is used for real business input — 10 times

`prompt()` cannot be sized, cannot be styled, shows roughly 30 characters, and
cannot take a second line. It is currently how the system collects:

- the correction note before re-inspecting a QA-held lot (`clearQaHold` L4503)
- the correction note before re-submitting a failed lot (`lotQACorrect` L4504)
- the reason a COA is rejected back to the analyst (`coaReject` L4473)
- the deviation note justifying acceptance of an UNFIT lot (`coaDeviation` L4474)

That last one is a Plant Manager signing off on out-of-specification material.
It is captured in a browser prompt box.

### `maxlength` is never set — 0 occurrences

Nothing tells the user how much they may type, and nothing prevents a
500-character remark being typed into a field that shows 21 characters of it.

---

## Part 2 — The rules that fix it

These are the standards. Apply them to every field, not case by case — applying
them case by case is how the app got here.

### R1 · Modals size to their content, not to 580px

```css
.modal{width:min(96vw, var(--modal-w, 580px)); max-width:96vw}
```

with a per-modal width class:

| Class | Width | Use for |
|---|---|---|
| `.modal.m-sm` | 460px | Confirmations, one or two fields |
| *(default)* | 580px | Simple forms, up to 4 fields |
| `.modal.m-md` | 760px | 5–8 fields, or any modal with a table |
| `.modal.m-lg` | 1000px | Dispatch, multi-PO shipment, QA inspection, pack |

Nothing else changes. Existing modals keep 580px until they are individually
promoted, so this is safe to land first.

### R2 · Grid columns have a floor, and the grid reflows

```css
.formgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:13px}
```

`auto-fit` + `minmax` means a field is **never narrower than 220px** (≈ 32
characters visible) and the grid drops to fewer columns rather than crushing
them. The hard-coded `grid-template-columns:repeat(3,minmax(0,1fr))` inline
styles at L5455, L6084 and L6320 must be removed — `minmax(0,1fr)` is what
permits the crush.

### R3 · Free text that can exceed one line is a `<textarea>`

Any field whose label contains **remark, note, reason, comment, description,
observation, instruction, or address** becomes:

```html
<textarea rows="3" style="resize:vertical;min-height:64px"></textarea>
```

`resize:vertical` lets the user grow it. `rows="3"` shows about 90 characters
without scrolling. It must span the full grid width (`grid-column:1/-1`).

### R4 · A `<select>` never truncates its selected value

Delete `text-overflow:ellipsis` from `.fld select`. If the value is genuinely
long, the field spans two columns. A dropdown the operator cannot read is worse
than a wide one.

### R5 · Labels do not wrap into their neighbour's row

```css
.fld label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fld{align-self:start}
```

and where a label is too long for one line, shorten the label and move the
detail into a `title` tooltip or a `.hint` line under the input. Long
parenthetical labels like
`4 · Brand batch # (on pack — reuse the same # to merge several base batches)`
become `4 · Brand batch #` with the explanation as hint text.

### R6 · Date inputs get a 150px floor

```css
input[type=date]{min-width:150px}
```

Chrome, Edge and Firefox each render the date widget differently; 150px clears
all three. This alone fixes the Committed column in PO Entry, which must also
be widened from 118px to 150px.

### R7 · No `prompt()` for anything that is stored

All 10 `prompt()` calls become proper modals with a `<textarea>`, a visible
character count, and a Cancel that actually cancels. The deviation note in
particular is a quality record and must be captured like one.

### R8 · `maxlength` on every text field, with a live counter over 60 characters

Pick the limit from the field's purpose (a DC number is not 500 characters).
Show `N / max` under any field where max is above 60, so the person knows
whether their sentence fits.

### R9 · Nothing that a person must read is `overflow:hidden` without a fallback

`.fixedtbl` may keep ellipsis for display columns, but any cell holding an
**input** must not clip it. Add `title` attributes so the full value is
available on hover in every truncated table cell.

---

## Part 3 — Complete field inventory

167 labelled controls. Types: 62 text, 53 select, 27 number, 23 date, 2
password, **0 textarea**.

Marked **`⚠`** where a rule above changes the field.

### Data Fix — `dfReasonField` L2296, `dfFormHtml` L2314

| Line | Label | Type | Action |
|---|---|---|---|
| 2296 | Reason / note (required) | text | ⚠ R3 → textarea, full width |
| 2314 | Base product | select | ⚠ R4 |
| 2315 | Quantity produced (Kg/L) | number | — |
| 2318 | Date (actual) | date | ⚠ R6 |
| 2319 | Shift | select | — |
| 2320 | Incharge | select | — |
| 2328 | Quantity packed (Kg/L) | number | — |
| 2330 | Date (actual) | date | ⚠ R6 |
| 2337 | Quantity (Kg/L) | number | — |
| 2340 | Dispatch date | date | ⚠ R6 |
| 2341 | Delivered date | date | ⚠ R6 |
| 2348 | Pick a PO to correct | select | ⚠ R4 — PO + client will truncate |
| 2351 | Customer | text | ⚠ R2 |
| 2352 | Channel | select | — |
| 2353 | Priority | select | — |
| 2354 | PO received | date | ⚠ R6 |
| 2355 | Promised | date | ⚠ R6 |
| 2358–2362 | Ordered · Produced · Packed · Dispatched · Delivered · Invoice price | number ×6 | ⚠ R2 — 6-column grid, unreadable labels |
| 2363 | Reason / note (required) | text | ⚠ R3 |
| 2370 | PO # | text | — |
| 2371 | Customer | text | ⚠ R2 |
| 2372 | Channel | select | — |
| 2375 | Priority | select | — |
| 2376 | PO received (actual) | date | ⚠ R6 |
| 2377 | Promised delivery | date | ⚠ R6 |
| 2380 | Product / brand | text | ⚠ R2 |
| 2381 | Ordered (Kg/L) | number | — |

> **Also missing entirely:** this screen corrects `invoicePrice` but **not**
> `printPrice`. See [SPEC-01](SPEC-01-PRICE-VISIBILITY.md).

### New PO Entry — `screenEntry` L2531

| Line | Label | Type | Action |
|---|---|---|---|
| 2531 | Destination Partner | text | ⚠ R2 |
| 2532 | PO type | select | — |
| 2534 | KAM Name | select | — |
| 2535 | Priority | select | — |
| 2536 | PO Received | date | ⚠ R6 |
| 2537 | Promised Delivery | date | ⚠ R6 |
| 2538 | Delivery focal person | select | ⚠ R4 |

Plus the line table at L2546 — see the table in Part 1. Committed 118 → 150px,
Note 130 → 220px or move to a second row.

### Production · open batch — `renderOpenBatch` L3612, `screenProd` L3815

| Line | Label | Type | Action |
|---|---|---|---|
| 3612 | Purchase Order | select | ⚠ R4 |
| 3613 | Product (as on the PO) | select | ⚠ R4 |
| 3614 | Plan this batch (Kg/L) | number | — |
| 3615 | Batch # | text | — |
| 3626 | Product (one run can serve several POs of the same product) | select | ⚠ R4, R5 — label is 58 characters |
| 3629 | Batch # (one for the whole run) | text | ⚠ R5 |
| 3635 | Base Product (bulk) | select | ⚠ R4 |
| 3636 | Planned (Kg/L) | number | — |
| 3637 | Batch # | text | — |
| 3815 | Plan this batch (Kg/L) | number | — |
| 3816 | Batch # | text | — |
| 3822 | Batch # | text | — |
| 3823 | Planned (Kg/L) | number | — |

### Production · by-product, divert, rework — L3983, L4012, L4049

| Line | Label | Type | Action |
|---|---|---|---|
| 3983 | Quantity to call (Kg/L) | number | — |
| 3984 | Batch # (assigned now) | text | — |
| 4012 | Recycle into batch (same product, as input) | select | ⚠ R4, R5 |
| 4012 | Quantity (Kg/L) | number | — |
| 4014 | 1 · Pack into brand | select | ⚠ R4 |
| 4014 | 2 · For which PO | select | ⚠ R4 — shows PO + client + needs-qty |
| 4014 | 3 · Qty (Kg/L) | number | — |
| 4049 | Quantity to call (Kg/L) | number | — |
| 4049 | Batch # (assigned now) | text | — |
| 4051 | Merge into batch (same product, as input) | select | ⚠ R4, R5 |
| 4051 | Quantity (Kg/L) | number | — |

> The divert modal also has a **print price** field and verify checkbox
> (L4014/L4031) that this audit's regex did not catch because it is not inside
> a `.fld`. It is 170px. See SPEC-01.

### Production · shift log and batch close — L4092, L4162

| Line | Label | Type | Action |
|---|---|---|---|
| 4092 | Date | date | ⚠ R6 |
| 4093 | Shift | select | — |
| 4094 | Shift incharge | select | — |
| 4097 | Produced this shift (Kg/L) | number | — |
| 4098 | Reason (required if no/short output) | select | ⚠ R5 |
| 4108 | Note (optional) | text | ⚠ R3 |
| 4162 | Variance reason (required) | select | ⚠ R4 |
| 4163 | Note (optional) | text | ⚠ R3 |

### Packing — `renderProdQty` L4252, `renderPackModal` L4283

| Line | Label | Type | Action |
|---|---|---|---|
| 4252 | Batch # (from production) | select | ⚠ R4 |
| 4253 | Qty packed now (Kg/L) | number | — |
| 4254 | Date | date | ⚠ R6 |
| 4283 | 1 · Pack into brand | select | ⚠ R4 |
| 4284 | 2 · For which PO | select | ⚠ R4 |
| 4285 | 3 · Qty (Kg/L) | number | — |
| 4286 | 4 · Brand batch # (on pack — reuse the same # to merge several base batches) | text | ⚠ R5 — 74-character label |
| 4287 | 5 · Mfg date (printed on pack) | date | ⚠ R6 |
| 4288 | 6 · Expiry date (auto +2 years, editable) | date | ⚠ R5, R6 |

Plus the price block at L4280 (170px input) — see SPEC-01.

### Pre-shipment QA — L4491, L6031, L6155

| Line | Label | Type | Action |
|---|---|---|---|
| 4491 | Inspector name (shared QA login) | text | ⚠ R5 — and see SPEC-04 on identity |
| 4492 | Remarks | text | ⚠ R3 |
| 6031 | Quantity going out (Kg/L) | number | — |
| 6035 | Inspector name | text | — |
| 6036 | Remarks (optional) | text | ⚠ R3 |
| 6155 | Inspector name | text | — |
| 6156 | Remarks (optional) | text | ⚠ R3 |

> All three inspection modals are missing the PO print price and a price check
> line. See SPEC-01.

### Supply chain · PR receipt, delay, defer — L4834, L4867, L4986

| Line | Label | Type | Action |
|---|---|---|---|
| 4834 | Receive qty | number | — |
| 4834 | GRN # | text | — |
| 4834 | Date | date | ⚠ R6 |
| 4867 | Delay reason | select | ⚠ R4 |
| 4867 | Responsible dept | select | ⚠ R4 |
| 4986 | Reason | select | — |
| 4986 | Comes back on (1–30 days out) | date | ⚠ R5, R6 |

### Shipments — L5268, L5456, L6085, L6216, L6321

The worst-affected area: 32 controls, 22 of them free text, all in 3-column
170px grids.

| Line | Label | Type | Action |
|---|---|---|---|
| 5268 | Delivery date * | date | ⚠ R6 |
| 5269 | Delivery confirmed via * | select | ⚠ R4 |
| 5270 | Reference / note (required if "Other") | text | ⚠ R3, R5 |
| 5456 | Qty shipped (Kg/L) | number | — |
| 5457 | Date | date | ⚠ R6 |
| 5458 | Destination | text | ⚠ R2 |
| 5459 | Carrier | text | ⚠ R2 |
| 5460 | Vehicle # | text | — |
| 5461 | DC number | text | — |
| 5462 | Bilty / reference | text | ⚠ R2 |
| 5463 | Delivered date (optional) | date | ⚠ R6 |
| 5464 | Remarks | text | ⚠ R3 |
| 6085 | Dispatch date | date | ⚠ R6 |
| 6086 | Destination · usual location remembered | text | ⚠ R2, R5 |
| 6087 | Transport type * | select | — |
| 6088 | Vehicle # | text | — |
| 6089 | Bilty # | text | — |
| 6090 | Carrier / transporter | text | ⚠ R2 |
| 6092 | SO # (sales order) * | text | ⚠ R5 |
| 6093 | Driver name · optional | text | ⚠ R2 |
| 6094 | Driver contact · req. if driver named | text | ⚠ R2, R5 |
| 6095 | Seal # · optional | text | — |
| 6096 | Remarks | text | ⚠ R3 |
| 6216 | SO # * | text | — |
| 6221 | Destination | text | ⚠ R2 |
| 6222 | Dispatch date | date | ⚠ R6 |
| 6231 | Vehicle # | text | — |
| 6232 | Bilty # | text | — |
| 6233 | Carrier | text | ⚠ R2 |
| 6238 | Driver name | text | ⚠ R2 |
| 6239 | Driver contact | text | ⚠ R2 |
| 6240 | Seal # (opt) | text | — |
| 6241 | Remarks | text | ⚠ R3 |
| 6321 | Dispatch date | date | ⚠ R6 |
| 6322 | Destination | text | ⚠ R2 |
| 6323 | Carrier | text | ⚠ R2 |
| 6324 | Vehicle # | text | — |
| 6325 | DC number | text | — |
| 6326 | Bilty / reference | text | ⚠ R2 |
| 6327 | Status | select | — |
| 6328 | Delivered date | date | ⚠ R6 |

`renderDispatchModal` (L6085) and `renderMPShip` (L6216) both need `.m-lg`
(1000px) — eleven and ten fields respectively cannot be entered comfortably in
580px.

### Admin · master data — L6791 to L7143

| Line | Label | Type | Action |
|---|---|---|---|
| 6791 | *(no label)* | number | ⚠ Lead-time input with no label at all |
| 6878 | Off-spec of | select | — |
| 6878 | Becomes | select | — |
| 6973 | Client | select | ⚠ R4 |
| 6974 | Annual target (PKR) | number | — |
| 6991 | Client | select | ⚠ R4 |
| 7027 | Product | select | ⚠ R4 |
| 7133 | Product / brand name * | text | ⚠ R2 |
| 7134 | Generic / composition * (prints on CoA) | text | ⚠ **R3** — a composition string is long and prints on the certificate |
| 7135 | Form * | select | — |
| 7141 | Production group * (daily rate → committed dates) | select | ⚠ R4, R5 |
| 7142 | Pack sizes (Kg/L) * | text | ⚠ R2 — holds a comma-separated list |
| 7143 | Brand owner | text | ⚠ R2 |

### Reports — L7184 to L7518

| Line | Label | Type | Action |
|---|---|---|---|
| 7184 | Month | select | — |
| 7185 | Channel | select | — |
| 7186 | Client | select | ⚠ R4 |
| 7187 | Priority | select | — |
| 7417 | Raw material | select | ⚠ R4 |
| 7450 | Group rows by | select | — |
| 7451 | Split columns by | select | — |
| 7452 | Measure | select | — |
| 7516 | Metric | select | ⚠ R4 |
| 7517 | Compare (overlay) | select | — |
| 7518 | Period | select | — |

### Users & Access — L7682, L7711

| Line | Label | Type | Action |
|---|---|---|---|
| 7682 | Full name | *(no `type` attribute)* | ⚠ Add `type="text"` |
| 7683 | Username | *(no `type` attribute)* | ⚠ Add `type="text"` |
| 7684 | Password | password | — |
| 7685 | Role | select | — |
| 7711 | Full name | *(no `type` attribute)* | ⚠ Add `type="text"` |
| 7712 | Username | *(no `type` attribute)* | ⚠ Add `type="text"` |
| 7713 | New password (blank = keep) | password | ⚠ R5 |
| 7714 | Role | select | — |

---

## Order of work for Fault 2

| Step | Change | Risk | Fixes |
|---|---|---|---|
| 1 | R4 — delete `text-overflow:ellipsis` from `.fld select` | None | Every truncated dropdown, app-wide, one line |
| 2 | R6 — `input[type=date]{min-width:150px}` and widen the Committed column | None | 23 date fields |
| 3 | R5 — `white-space:nowrap` on `.fld label` + `align-self:start` | None | Row misalignment app-wide |
| 4 | R2 — `auto-fit/minmax(220px,1fr)` on `.formgrid`, remove the three inline `repeat(3,minmax(0,1fr))` overrides | Low | Every crushed field |
| 5 | R1 — `.m-md` / `.m-lg` classes, applied first to the dispatch, multi-PO, pack and QA modals | Low | The four worst modals |
| 6 | R3 — 14 fields become `<textarea>` | Low — additive | Every place a real explanation belongs |
| 7 | R8 — `maxlength` + counters | Low | Sets expectations |
| 8 | R7 — replace 10 `prompt()` calls with proper modals | Medium — touches control flow | Deviation notes, rejection reasons, correction notes |

Steps 1–3 are three CSS lines and fix a visible share of the complaint. They
can go live the same day.

---

*Audit run 2026-08-21 against `o2s/o2s.html` @ 2026-08-16. Module: O2S.*
