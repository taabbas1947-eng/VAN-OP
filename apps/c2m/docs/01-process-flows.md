# 1. Process flow diagrams

Version 0.9.3 · 19 Oct 2026 · Owner: Yawar (CFO) keeps it current; Tahir approves changes · Rule: R-5h item 1 (D-20)
Changed in 0.9.3 (19 Oct 2026): 1.17 VAN brand list margin added to the Reports flow, with the link step (D-73).
Changed in 0.9.2 (19 Oct 2026): the 12 unbuilt reports carry no version number (built after their pictures are approved).
Changed in 0.9.1 (3 independent reviews, 18 Oct 2026 night): 1.3 approve ticked only leaves the rest in a new item (D-61). Other 0.9.1 logic is in 03, 3.16.
Changed in 0.9.1 (documentation review, 18 Oct 2026): 1.1 cost approval checks every pack is fully costed (D-40); 1.3 rate and packing price saves do not yet leave out waiting packs (I-18), Tahir sees re-approvals under Waiting on others; 1.5 and 1.7 place names; 1.6 refusals (D-40, D-44, D-56); 1.11 2 re-approval items; new diagrams 1.9 to 1.13, new 1.16 Today and 1.17 Reports; 1.15 Reports, 6 Prices views, 5 product page tabs; rule numbers on every step.
Changed in 0.9.0: no flow changed. Where work is done stays as 1.15; Today now orders it (next move, groups, ages: D-54) and Reports join for Yawar and Tahir (D-57).
Changed in 0.8.0: new 1.15 Where each job is done (the screen redesign, D-45 to D-52); place names in 1.3, 1.4, 1.5 and 1.9 moved to the 0.8.0 screens.
Changed in 0.7.0: new 1.14 VAN brand products (D-44).
Changed in 0.6.0: cost approval waits until every pack is costed (D-40); re-approval measured from the approved cost and checked again on approval (D-41).
Changed in 0.4.0 and 0.5.0: rate order (rates Yawar adds beat the base bands); approvals dated ahead wait for their date, only 1 may wait, Tahir can withdraw it; O2S pull lock frees itself after 10 minutes; Tahir sees re-approvals under "For your information"; no real figures in this file (public repo).
Changed in 0.3.0 and 0.3.1: re-approval is now approve all, approve ticked, or close with a reason, and has 8 triggers. New flows: labour and FOH rate choice, Himayat's Materials, VAN list revision, O2S pull, price proposal with dates.

Rule references: R-2 = Design Record section 2; R-5b to R-5i = Design Record sections 5b to 5i; D-xx = 06-decisions.md; F-xx = 09-formulas-and-rules.md.

Legend: each subgraph is a lane (a role and its named owner). A dashed arrow is a send back. A rounded box is a start or end. A diamond is a decision. C2M has no reopen: once approved, an item changes only through a new item (a new recipe version, a new price, a new revision); withdraw (1.6, 1.7) is the only undo, and only before the date. Diagrams are Mermaid; they render on GitHub and in most Markdown viewers. The app's Setup, System documentation, shows the source text.

## 1.1 Recipe (owner: Majid; R-2 People and rights; D-08, D-09; R-5i 1 and 2)

```mermaid
flowchart LR
  S([Start: a change, or an imported recipe that does not rebuild]) --> A
  subgraph Production [Majid, Production Manager]
    A[Write new version or check imported recipe · D-08] --> B[Send for review]
  end
  subgraph QC [Himayat, QC Head]
    C[Review inputs and nutrient analysis · D-08, D-23]
  end
  subgraph Plant [Fahim, Plant Manager]
    D[Endorse recipe, nutrients and cost · D-08]
  end
  subgraph CFO [Yawar, CFO]
    E{Every pack fully costed: material rates, packing for a VAN-packed pack, labour and FOH above Rs 0? · D-40}
    E -- yes --> F([Approved: official recipe, dated cost version per pack · D-16])
    E -- no --> E2[Refused, naming each pack and what is missing · D-40]
  end
  B --> C --> D --> E
  C -. send back: reason + advice · D-09 .-> A
  D -. send back .-> A
  E -. send back .-> A
  A -. resend goes straight to whoever sent it back · R-5i 1 .-> C
```

- 1 version in progress per client product (R-2 Recipes).
- A one-time change (e.g. TSP replaced by DAP) is an ordinary new version and goes through all 4 steps; Majid writes another version to switch back (R-5i 2).
- On cost approval the previous approved version becomes "earlier version" and every pack gets a new dated cost version.
- Cost approval is refused, naming the pack, until every pack is fully costed on the version: material rates, a priced packing bill for a VAN-packed pack, a labour and a FOH rate (D-40, 0.6.0).
- The plant is not forced to make the C2M recipe for now (R-5c).

## 1.2 Rate change (owner: Yawar; R-2 Rates; D-10)

```mermaid
flowchart TB
  subgraph CFO [Yawar, CFO]
    A[Try a new rate, with source · D-10] --> B{Rise or drop above rate_warn_pct? · F-01}
    B -- yes --> W[Did you mean? Tick 'Yes, I meant this rate'] --> C
    B -- no --> C[Effect shown: every pack, cost now and after, approved cost and %, Rs on open POs, price for target · D-10, D-41]
    C --> D{Save or drop · D-10}
    D -- drop --> X([Nothing changes])
    D -- save --> E[Rate saved, dated, with source, every recipe recosts · D-10, D-16]
  end
  E --> F{Any pack moved more than reapprove_pct from its approved cost? · F-11}
  F -- yes --> G[1 re-approval item for this cause · see 1.3 · D-41]
  F -- no --> Y([Done])
```
No approval by Tahir for rates (D-10). Packing item prices follow the same flow (D-19).

## 1.3 Re-approval (owner: Yawar; R-2 Cost; R-5i 6; changed in 0.3.1)

Triggers. Each makes 1 item for its cause, holding every pack whose cost now differs from its approved cost by more than reapprove_pct (3%). A pack already waiting in an open item is left out (not yet for a rate save or a packing price save: open issue I-18).
1. A material rate saved (Inputs, Materials).
2. A packing item price saved.
3. A packing bill edited.
4. A packing bill assigned to a pack.
5. A labour or FOH rate added or retired.
6. A product's type changed.
7. A product's reprocessed flag changed.
8. A rate corrected in the import queue.
Also: closing an item makes a new item if packs still differ for another cause (0.3.1).
If a pack's cost moved again between the item being shown and Yawar approving it, C2M approves today's cost and writes "cost moved since shown" in the change record, with the shown and the approved figure (0.5.0).
Each pack shows its last approved cost as "from" and the % against it. On approval each pack is checked again: one now within reapprove_pct of its approved cost, or no longer fully costed, keeps its approved cost and is named (D-41, 0.6.0).

```mermaid
flowchart TB
  T([Trigger 1 to 8]) --> I[Item on Yawar's Today, worked in a panel · R-2 Cost]
  subgraph CFO [Yawar, CFO]
    I --> Q{Decide · R-2 Cost}
    Q -- Approve all, 2 steps --> A1[New dated cost version for every pack still over the % and costed · D-41, D-43]
    Q -- Approve ticked only --> A2{At least 1 ticked? · B-01}
    A2 -- no --> R1[Refused: tick at least 1 pack, or close]
    A2 -- yes --> A3[New cost for ticked packs; the packs not ticked go into a new open item 'Left open from item N' · R-5i 6, D-61]
    Q -- Close: the change was wrong --> Z1[Write why in the box · R-2 Cost] --> Z2[Item closed, approved costs unchanged · R-2 Cost]
  end
  subgraph COO [Tahir, COO]
    V[Sees open items under 'Waiting on others' on Today: with Yawar, re-approve, with its age; Open shows the packs read only; cannot approve or close · R-2 Cost, D-54]
  end
  Z2 --> Z3{Packs still differ for another cause? · R-2 Cost}
  Z3 -- yes --> I
  Z3 -- no --> E([Done])
  A1 --> E
  A3 --> E
  I -.-> V
```

## 1.4 Labour and FOH rate choice (owner: Yawar; D-25; R-5i 7; F-05, F-16)

```mermaid
flowchart TB
  subgraph CFO [Yawar, CFO: Setup, Settings and targets]
    A[Add a named rate: labour or FOH, Rs per kg, from date today or earlier] --> B{Applies to}
    B -- all products --> B1[Optional: form, reprocessed, pack range]
    B -- a product type --> B2[Pick the type]
    B -- a list of products --> B3[Tick the products]
    B1 --> C{Checks pass? future date, pack range, form · 0.3.1}
    B2 --> C
    B3 --> C
    C -- no --> X[Refused with the reason]
    C -- yes --> D[Saved, applies from its date by itself]
    R[Retire a rate, with why] --> R1{Every pack still has a labour and a FOH rate?}
    R1 -- no --> X2[Refused: add the replacing rate first]
    R1 -- yes --> R2[Retired]
  end
  subgraph C2M [C2M, for every product and kind]
    P1{Product listed on a rate of this kind?} -- yes --> W[Take it]
    P1 -- no --> P2{Rate for its product type?} -- yes --> W
    P2 -- no --> P3{Rate Yawar added for all products that fits form, reprocessed, pack?} -- yes --> W
    P3 -- no --> P4[Base band that fits form, reprocessed, pack] --> W
    W --> SUM[Conversion = labour picked + FOH picked · F-16]
  end
  D --> P1
  R2 --> P1
  SUM --> RA[Moved costs go to re-approval · 1.3]
```
Any rate Yawar adds beats the base bands (D-37). Within a level: more conditions first, then the latest date, then the narrower pack range, then the newest (decision table in 03). The base bands (Rs per kg, set by Yawar; loaded at first load) are 4 rates for all products, marked is_base: solid not reprocessed, solid reprocessed, liquid packs 10 L and above, liquid packs below 10 L. Each band is split into a labour rate and a FOH rate (A-15). Freight inwards is not part of FOH (D-38). The reprocessed flag is set per product (D-30).

## 1.5 Material class and nutrient % on Inputs, Materials (owner: Himayat; D-23, D-48; R-5i 4 and 4a)

```mermaid
flowchart LR
  subgraph QC [Himayat, QC Head: Inputs, Materials]
    A[Today: N materials need a class or nutrient %, opens in a panel · D-46] --> B[Inputs, Materials, filter To do · D-48]
    B --> C{Class right? · D-23}
    C -- no --> D[Pick class, Save class · D-23]
    D --> D2{New class adds no nutrients? · R-5i 4a}
    D2 -- yes --> D3[Nutrient values cleared, old values kept in the change record · D-23]
    D2 -- no --> E
    C -- yes --> E{Nutrient source? · R-5i 4a}
    E -- yes --> F[Enter % per field, 'Blank fields are 0' ticked by default · R-5i 4] --> G([Complete])
    E -- no --> G2([Adds no nutrients: nothing to enter · R-5i 4a])
    D3 --> G2
  end
  subgraph CFO [Yawar, CFO]
    Y[Can do the same in Inputs, Materials, and sees and saves the rate; adds materials with a rate · D-10, D-48]
  end
```
Non-nutrient inputs (binder, filler, anti-caking agent, wetting agent or adjuvant, colour, pH adjuster) count in recipe weight and cost and add 0 to the analysis. No rates or cost are shown on this screen.

## 1.6 Price proposal (owner: Yawar proposes, Tahir approves; R-2 Prices; D-06, D-22, D-34; R-5i 3)

```mermaid
flowchart LR
  subgraph CFO [Yawar, CFO]
    A0[Prices, To change: Propose opens a side panel · D-56] --> A
    A[Price, reason the client will read, Takes effect from today or later, valid till · D-22, D-34] --> K{Refused? pack not costed · D-40; VAN brand pack · D-44; client reason empty · D-56}
    K -- yes --> KX([Refused with the reason])
    K -- no --> B{GP below target on cost today? · D-06}
    B -- yes --> R[Written below-target reason required · D-06] --> C
    B -- no --> C{Another price already waiting for Tahir for this pack? · D-22}
    C -- yes --> X[Refused: wait for Tahir]
    C -- no --> W[Waiting for Tahir]
    F[Revise and resend: replaces the sent-back proposal]
  end
  subgraph COO [Tahir, COO]
    W --> D{Approve, 2 steps, or send back}
    D -- send back with reason --> F
    D -- approve --> G{Takes effect after today?}
    G -- no --> E([In force now: previous price taken now, old price ends today])
    G -- yes --> H[Approved, waiting for its date: today's price stays in force until then]
    H --> H2{Another approved price already waiting for this pack?}
    H2 -- yes --> H3[The older waiting price is cancelled; change record says 'cancelled']
    H --> WD[Tahir can Withdraw it, with why, before its date]
    WD --> WD2([Withdrawn: today's price stays; change record says 'withdrawn'])
  end
  F --> W
  H -. on its date .-> E2([Takes over by itself: the price in force is picked by date])
```
Only 1 approved price may wait for its date per pack. The approve reply is {ok, waitsUntil, cancelled}.

## 1.7 VAN brand list revision (owner: Yawar proposes, Tahir approves; D-28; R-5i 10)

```mermaid
flowchart LR
  subgraph CFO [Yawar, CFO: Prices, VAN brand lists]
    A[Revise a list: type only the prices that change, Now and change % shown · D-28] --> B[Reason, effective from today or later, valid till · D-28, D-34]
    B --> C{A revision already waiting for this list, or an approved one waiting for its date? · D-34}
    C -- yes --> X[Refused]
    C -- no --> W[Proposed · D-28]
    F[Revise and resend: replaces the sent-back revision · D-09]
  end
  subgraph COO [Tahir, COO]
    W --> D{Approve, 2 steps, or send back · D-28}
    D -- approve, dated today or earlier --> E([Applied: list rows, previous prices and list dates change, new PDFs use them · D-28, D-42])
    D -- approve, dated ahead --> WT[Approved, waiting for its date · D-34]
    WT -- first load of C2M on or after its date --> E
    WT -- Tahir withdraws, with why --> WX([Withdrawn: the list stays as it is · D-34])
    D -- send back with reason --> SB[Sent back · D-09]
  end
  SB --> F --> W
```
Only 1 revision may wait per list. While an approved revision waits for its date, a new revision of that list is refused: Tahir withdraws it first, or Yawar waits until it takes effect. C2M applies a waiting revision on its first load on or after the date; the change record says "applied", once. The approve reply is {ok, waitsUntil}.
Dealer discount is typed as % on the screen and stored as a fraction, also on revise and resend. Distributor price with FED and dealer net prices are worked out. The previous price on a distributor list is the price on the last distributor list issued (D-42, 0.6.0).

## 1.8 O2S pull (owner: Yawar or Tahir; D-12, D-21)

```mermaid
flowchart LR
  subgraph People [Yawar or Tahir]
    A[Pull now, Setup, From O2S · D-12]
  end
  subgraph C2M [C2M]
    A --> B{Another pull running? · D-21}
    B -- yes, started less than 10 minutes ago --> X([409: a pull is already running])
    B -- no --> C[Mark O2S source Pulling · D-21] --> D[Read app_state row 1, read only · D-12, D-21]
    D --> E[Copy PO lines and trucks, remove rows from older pulls · D-16]
    E --> F{Failed?}
    F -- yes --> G([Source Failed with the reason, previous pull's data stays · D-21])
    F -- no --> H([Source Read, counts and issues shown · D-21])
  end
```
1 pull at a time. A pull left "Pulling" for more than 10 minutes (for example after a crash) frees itself, so the next Pull now runs (0.5.0). C2M never writes to O2S.

## 1.9 Client price rule (owner: Yawar; R-5 client price rule)

```mermaid
flowchart LR
  subgraph CFO [Yawar, CFO: Setup, Customers]
    A[Open a customer · R-5] --> B{Price rule · R-5}
    B -- time --> T[Time-based, with cycle e.g. monthly · R-5]
    B -- po --> P[Fixed for each PO · R-5]
    B -- list --> L[VAN brand list prices · D-28]
    T --> S[Save: rule, cycle, region, O2S names · R-5, D-05]
    P --> S
    L --> S
    S --> E([Saved, in the change record · D-20])
  end
```
- Time-based (e.g. Client X, monthly): POs received before the effective date are supplied at the PO price.
- PO-based (e.g. Client Y): the price is fixed for that PO.
- Others: to be set by Yawar in Setup, Customers (A-06).

## 1.10 Price list documents (owner: creator; D-14)

```mermaid
flowchart LR
  subgraph Maker [Yawar or Tahir; a KAM for granted lists only]
    A[Prices, Price lists: pick audience and client · D-14] --> B{KAM? · R-2 People and rights}
    B -- yes --> G{List or client granted? · R-2}
    G -- no --> X([403: not granted])
    G -- yes --> F
    B -- no --> F[Pick fields, dates, reference, note, reasons · D-14]
    F --> V[Check the preview: number, issued and effective block, 2 signatures · D-58]
    V --> C[Create PDF: C2M numbers it VAN/PL/year/number and saves the rows · D-14]
    C --> E([PDF prints as issued; a distributor list sets each row's previous price · D-42])
  end
```
Pick audience, pick fields, set dates and reference, check the document, Create PDF. Cost and margin are never available as fields. With no effective date typed, a white label PDF takes the client's own latest approved price date, and a VAN list PDF takes its own list's dates (0.3.1). A document dated ahead shows the prices in force on that date: waiting list revisions applied over today's rows, and the client prices in force on that date (0.5.0). Every page carries the footer and "page n of N"; there is no blank last page (0.5.0). KAMs download only granted lists, cannot set notes, dates or reasons, and the grant is checked again on download.

## 1.11 Import (owner: Yawar; D-07, R-4)

```mermaid
flowchart LR
  L[Loader, once, from Tahir's PC · D-07, R-4] --> Q[Items from Yawar's sheets on Yawar's Today · D-07, D-46]
  subgraph CFO [Yawar, CFO]
    Q --> D{Accept or correct · D-07}
    D -- accept --> A([Accepted, pre-fill kept · D-07])
    D -- correct, with why --> K{Rate item? · D-07}
    K -- yes --> R[Saved through the rate controls: digits, warning, re-approval · D-10]
    K -- no --> N([Decision recorded only; the figure does not change · D-07])
    R --> A2([Corrected · D-07])
  end
```
Day-1 masters load from Yawar's sheets with `loader/load-import-pack.js` (in the C2M App folder on Tahir's PC, outside apps/c2m, because the loader and the import pack hold Yawar's figures). Every conflict or data question stays open in Yawar's import queue until he accepts or corrects it. A rate correction passes the rate controls and can make a re-approval item. The 13 Oct cost is loaded as Yawar's sheet; the move to the bands waits in 2 re-approval items, 1 for white label packs and 1 for VAN brand packs (A-19, D-44).

## 1.12 Settings and targets (owner: Yawar proposes, Tahir approves; D-18, D-06)

```mermaid
flowchart LR
  subgraph CFO [Yawar, CFO: Setup, Settings and targets]
    A[Change a setting or ask a client target · D-18, D-06] --> B{Threshold or target? · D-18}
    B -- budget line --> N([Applied at once, notice to Tahir · D-18])
    B -- threshold or target --> W[Request waits for Tahir; 1 open target request per product · D-06]
  end
  subgraph COO [Tahir, COO]
    W --> D{Approve or refuse, in a panel on Today · D-18, D-46}
    D -- approve --> Y([Value applied · D-18])
    D -- refuse --> Z([Nothing changes · D-18])
  end
```
Thresholds (rate warning, re-approval, red flag share and gap, forward horizon) and client target overrides: Yawar proposes, Tahir approves or refuses (2 steps). Only 1 open target request per product. Budget and ambition lines (budget_gp, ambition_gp, wl_budget_gp, conv_budget_month) start at 0 in the migration and are set by the first load; a later change applies at once with a notice to Tahir.

## 1.13 Monthly (owner: Yawar and Tahir; D-18)

```mermaid
flowchart LR
  M([1st of the month: jobs on Today · D-54]) --> Y1
  M --> T1
  subgraph CFO [Yawar, CFO]
    Y1[Enter last month's actual labour and FOH · D-18] --> Y2([Shown against conv_budget_month · D-18])
    Y3[Tie to the books: ERP sales and COGS · D-18] --> Y4([Gap shown · D-18])
  end
  subgraph COO [Tahir, COO]
    T1[Check the top 15 rates against the purchase register · D-18, D-39] --> T2([Marked done; Yawar is refused this check · D-18])
  end
  M --> Y3
```
Yawar enters actual labour and FOH; C2M shows them against conv_budget_month. Re-entering a month keeps the earlier values in the change record (0.5.0). Tahir (second person) ties the top 15 rates to the purchase register; Yawar cannot do this check. Yawar enters ERP sales and COGS to tie C2M to the books.

## 1.14 VAN brand products (owner: Yawar; D-44, ruling 8, 18 Oct 2026)

```mermaid
flowchart TB
  S[Yawar's Master Cost Sheet, VAN Brands tab: 1 column per pack · D-44] --> L[Day-1 load: 1 C2M product per VAN product, its packs, 1 recipe, a packing bill per pack · D-44, D-19]
  L --> C[1 approved cost per pack: Yawar's figure; today's cost on the bands · D-44, A-19]
  O[O2S truck: buyer, channel, region, brand, pack, PO price · D-12] --> M{White label? · D-44}
  M -- yes --> W[Client's own product and pack · D-03]
  M -- no --> V[The VAN pack with that brand and pack size, whoever buys it · D-44]
  V --> G[Sale keeps buyer, channel and region; GP = PO price less the pack's cost on the truck's date · D-16, D-44]
  C --> G
```
- A product whose packs carry different recipes in Yawar's sheet is held as 2 products (each keeps 1 recipe), e.g. a 3 L pack costed with other quantities.
- A VAN pack has no single price: each channel has its own list. VAN prices change through the VAN brand list revisions (1.7); a per-pack price proposal is refused.
- O2S VAN packs with no costing column load with no cost and are listed in Yawar's import queue.

## 1.15 Where each job is done (owner: Tahir; 0.8.0 and 0.9.0; D-45 to D-59, Tahir's screen rulings of 18 Oct 2026)

Every job and approval starts on the person's Today and is done in a panel there; the screens behind are for looking and for setup. Rules, rights and approval steps are those of 1.1 to 1.14, unchanged.

```mermaid
flowchart LR
  subgraph T [Today: next move, To approve, To do, Waiting on others · D-54]
    J[Job or approval, with its age · D-54] --> P[Panel on Today: the numbers, who sent it, the buttons · D-46]
    P --> A{Approve, send back, accept or enter · D-46}
    A --> D[Done: the panel shows the new state; Close or Escape · D-46]
  end
  subgraph S [Places in the left rail for looking and setup · D-53]
    M[Margin · D-11] --- RP[Reports: GP bridge, PO price against approved price; 12 more after their pictures are approved · D-57]
    RP --- PR[Products: 1 page per client product; tabs Recipe, Cost and price by pack, Price history, Sales, History · D-47]
    PR --- PC[Prices: To change, With Tahir, Waiting for date, By customer, Price lists, VAN brand lists · D-56]
    PC --- IN[Inputs: Materials, Packing items, Packing bills · D-48]
    IN --- SE[Setup: customers, O2S, Yawar's sheets, settings and targets, access, records, documentation · D-49]
  end
  PR -. Open to approve .-> P
  PC -. Open to approve .-> P
  SE -. Open to approve .-> P
```

| Job | Who | Opens on Today in a panel |
|---|---|---|
| Check, review, endorse, approve cost of a recipe | Majid, Himayat, Fahim, Yawar | the recipe version, with its steps and buttons (also opened from the product page or Recipes: "Open to ...") |
| Re-approve cost | Yawar (Tahir reads) | the item: approve all, approve ticked, close as wrong |
| Packs not costed | Yawar | each pack with what is missing, and its product page |
| Items from Yawar's sheets | Yawar | the queue: accept or correct |
| Price sent back, prices to change | Yawar | the proposal and its form; the list with Propose |
| List revision sent back | Yawar | the revision and its form |
| Monthly actuals, tie to the books | Yawar | the entry forms |
| Rate check | Tahir | Mark done |
| Approve a price, a list revision, a threshold change, a target change | Tahir | the item and Approve or send back (refuse) |
| Materials to complete | Himayat | the materials table on To do |
| Customers flagged red | Tahir | opens Margin (analysis, not a job) |
| Packs costed with no price | Yawar | opens Prices, To change (D-54) |

## 1.16 Today: the next move (owner: Tahir; D-54, B-12; 0.9.0)

```mermaid
flowchart TB
  subgraph C2M [C2M, for the person signed in]
    A[Build the jobs: group approve, do or red; priority; start date · D-54] --> B{Any approval? · D-54}
    B -- yes --> N1[Next move = first approval by priority, oldest first · B-12]
    B -- no --> C{Any red item? · D-54}
    C -- yes --> N2[Next move = first red item by priority, oldest first · B-12]
    C -- no --> N3[Next move = first job by priority, oldest first; undated last · B-12]
    N1 --> G[Then To approve, To do, Waiting on others; every line shows its age; stuck after more than 2 working days, Monday to Saturday · D-54]
    N2 --> G
    N3 --> G
  end
```

## 1.17 Reports (owner: Yawar and Tahir; D-57; 0.9.0)

```mermaid
flowchart LR
  subgraph People [Yawar or Tahir]
    A[Reports: 14 cards in 4 groups · D-57] --> B{Built? · D-57}
    B -- no --> L([Shows "not built yet": its picture goes to Tahir for approval first · D-57])
    B -- yes, GP bridge --> G[Pick group and month; parts must add up within Rs 1 · F-19]
    B -- yes, PO price --> P[Pick this month, last month or FY to date · F-20]
    B -- yes, VAN brand list margin --> V{Each list row linked to its C2M pack? · D-73}
    V -- no --> K[Yawar checks the suggested pack, picks the rest, Save links · D-73]
    K --> V
    V -- yes --> M[Every VAN pack: GP on each list against cost and the ambition GP; pick the farmer list · F-22]
    G --> X([Export to Excel])
    P --> X
    M --> X
  end
```
