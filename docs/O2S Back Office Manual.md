# O2S — Back Office Manual
Vital Agri Nutrients · Order-to-Ship · written the night of 23 September 2026, from the COO's rulings of that day.
For the COO, the CFO and the Plant Manager. Plain words, no jargon. Numbers as digits.

## 1. The 3 places

| Place | Who | What it is for |
|---|---|---|
| **Today** | everyone | The jobs waiting on you, grouped the way the plant does them, one button each. The button is the same action as before; it just no longer hides behind a tab. Your own jobs first; what stalled on someone else and was escalated to you comes after, under its own heading. |
| **Report Center** | everyone, read-only | Dashboard (opens on the Firefighter), PO Tracker, Reports. No editing here. Anything with a money figure is for 4 roles only: COO, CFO, Plant Manager, KAM. |
| **Back Office** | COO, CFO, Plant Manager | Customers, products, budgets, roles & access, people, reconciliation. Each item inside is gated by its own right. |

Production, Lab QC, Pre-shipment QA, Shipments and New PO Entry still exist — they hold the forms — but nobody reaches them by tab. A job on Today opens the right one. The "+ New order", "+ Open a batch", "+ Log a shift" and "+ Record a shipment" buttons on Today start the things the queue cannot raise by itself, and appear only for the people whose rights allow them.

## 2. Products — brand, base, pack, who buys it

**One product master.** Back Office → Admin · Master Data → Business masters → Products. Every product is one row:

- **Brand** — the name on the bag. What the customer orders. Example: *Max Sulfur*.
- **Base product** — what the plant actually manufactures in bulk. Example: *Sulfur 70%*. Several brands share one base: Max Sulfur and Green Sulfur are both Sulfur 70%. Production runs the BASE; packing turns it into the BRAND. Recipes, lab test templates and production batches belong to the base.
- **Generic / composition** — the chemistry, as it prints on the COA. Example: *Sulfur Fertilizer > 70%*.
- **Pack sizes** — Kg or L per bag or drum, comma-separated; the first is the default. A customer can have its own pack sizes (LCI buys Cala Mag V in 1 L, Rudolf in 1000 L) — those are kept per customer.
- **Sold to** — the customer keys that may order it (a white-label company, "Dealers", "Vgreen", …). Order entry offers a customer only the brands sold to it. **A brand not in this list cannot be ordered.**
- **Form and production group** — Powder / Liquid / Granular …; the group drives the committed-date engine.

**Where it came from.** Until tonight a brand lived in 3 places: a catalogue fixed in the code, a brand map beside it, and a list added through Admin. They were merged into this one master on first load. Where the two old lists disagreed about a brand's base, the row says *"catalogue said … — settle it"*: pick the right base once and save. **A base that is the brand's own name** ("Cal-Mag V (own)") means bulk is made specifically for that brand — correct for some, a mistake for others (V-Borate 17% should be a real base). Settle those too.

**Deactivate, don't delete.** A deactivated product can no longer be ordered; every existing order and batch keeps it.

## 3. Customers

- Finance (Ismaeel) adds a customer from Customer Master (or from the New order form). It is born **Pending approval**.
- **The CFO approves it** (the COO can too). It shows as a job on the CFO's Today: *New customer to approve* → Approve. Until then the customer is not offered in New PO Entry.
- Codes follow the standard in `o2s/CUSTOMER-CODE-STANDARD.md` (WL-ARY-26-100, DLR-PB-MUL-007 …). Segment decides the channel: White-label, Dealer, Distributor, VGreen, COBO, Direct Farmer.
- The KAM is a **reviewer**: he sees his accounts and every order, he raises nothing and changes nothing. Orders are raised by Finance, the CFO and the COO only.

## 4. Budget — channel, then customer

Back Office → Business masters → **Channel budgets** (COO / CFO). Rs, financial year 1 Jul – 30 Jun, monthly split under it.

```
Channel total (Rs)              e.g. White Label  Rs 300,000,000
  └ allocated to named clients  ARYSTA 40,000,000 · MAXIM 90,000,000 · …
  └ unallocated                 what is left of the total
```

- **White Label, Distributor, Vgreen, Cobo** — a channel total, allocated to named clients under it (Client annual targets, Client monthly targets — the cards below Channel budgets).
- **Dealer** — one segment total. A per-dealer allocation is allowed, not expected. No province level.
- **Farmer** — one segment total. Never allocated to an individual farmer.

Sales & Budget (Report Center → Dashboard → Financial) opens with the channel table: target, allocated, booked (ordered × invoice price), delivered (delivered × invoice price), % of target, traffic light. Then the client table as before.

## 5. Roles and access — roles only

- **Every person has one role. The role gives the rights. There are no per-person exceptions.** To change what one person can do, change their role or create a new one.
- The 15 roles (23 Sep 2026): COO · Plant Manager · KAM · CFO · Finance · Finance Desk Officer · Production Manager · Production · QCM · AQCM · Lab Rep · QA Inspector · Supply Chain · Warehouse · Supply Chain Officer.
- Rights are granted per role in Back Office → Admin · Master Data → Access control → Authorisation. A right that is *live* (26 codes, 21 live) is decided by that grant. Screens (view / edit) are decided by the access matrix on the same page.
- **Who sees a job on Today**: the role the job is addressed to, plus any role holding the live right behind it (that is why the Warehouse Assistant now sees dispatch), plus whoever it was escalated to.
- **One login per person.** A shared login ("lab", "qa") logs every action as the role, not the person; "done by you today" cannot work on it.

## 6. Every day, in one sentence each

- Finance raises the order → Supply Chain acknowledges and checks raw material → the CFO approves a purchase request if material is short → Supply Chain receives it → Production runs the base and packs the brand → the Lab drafts the COA, the AQCM verifies, the QCM approves → QA inspects the packed lot and the truck → Supply Chain plans the truck, the warehouse loads and issues the gate pass, Lead Supply Chain releases → delivery is confirmed.
- Late? The Plant Manager gives **one reason per order**. Short? Production Manager or Lead Supply Chain asks to close short; the Plant Manager approves; the short-close report counts it.
- Reconciliation (Back Office) flags any packed order line whose packing trail does not add up. It is read-only today; making each flagged line a Back Office job with the fix one tap away is the next step.

## 7. What was poorly designed, and what was done about it

| Found in the live app, 23 Sep 2026 | Done |
|---|---|
| 17 screens by tab; Production alone had 9 tabs inside it | 3 places; Today routes to the form |
| Jobs reached a person by role NAME only — 11 of 21 people had an empty list | live rights decide who sees a job |
| 104 obligations, one per order line; 9 of them the same run | grouped: one run, one bay visit, one truck, one reason per order |
| A brand in 3 lists; "base" sometimes another brand's name | one product master; disagreements flagged to settle |
| Access split over 2 screens and 4 views; raw codes on the panel | roles only; matrix cells written from the rulings, once, logged |
| Finance could not even SEE New PO Entry; the CFO could see but not edit | orders and customers to Finance + CFO |
| Money visible to everyone in the report builder | 4 money roles; Finance dataset and money columns gated |
| 44 orders with no print-on-pack answer, addressed to a read-only KAM | answered "no" by ruling, logged |
| Shared logins: lab, qa, aqcm, qcm, fahim, saad, yawar, tahir | one login per person (COO, Users & Access) |
| A second COO login not on the org list (ahmer) | to be deleted by the COO |
| "On Time" as a delay reason in the master list | to be removed in Reference data |
| Reconciliation is a report with no action | next: flagged lines become Back Office jobs |
