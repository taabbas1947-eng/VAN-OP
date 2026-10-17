# OP-HANDOFF-C2M · session log (append-only, CLAUDE.md §4.1 rules)

C2M (Cost to Margin): cost, recipes, prices and margin for every client pack. App key `c2m`, page `/c2m`,
API `/api/c2m/*`, tables `c2m_*`. Built by the collaborator (v0.5, 15–16 Oct 2026) in
`VAN Platform\Cost and Pricing\C2M App\`; its 12 documents are in `docs/`. The platform part (mount, roles,
own pool) is in `OP-HANDOFF-PLATFORM.md`, entries of 17 Oct 2026.

## 17 Oct 2026 — Step 3: C2M brought into the repo and tested locally with real data (MODULE: C2M) — NOT PUSHED

- **Into the repo:** only `apps/c2m/` from the collaborator's folder (21 files: page, routes, engine, lib,
  o2s, pricelist, logo, 12 docs, migration `001_c2m_core.sql` + `.PRODUCTION.sql`). Checked first: no customer
  prices, costs or client names; money figures in comments and docs are made-up examples, plus the base band
  rule ("Rs 20 / Rs 30") and the Rs 10 price floor. **Not brought in, never to be:** `loader/` (real customer
  prices hard-coded), `import pack/`, `local database/`, `harness/`, `node_modules/`, `Build Inputs/`.
- **Local database:** `001_c2m_core.sql` run on `van_platform` twice: 39 `c2m_` tables, 9 settings, safe twice;
  O2S `app_state` unchanged (rev 14341).
- **Tested by Tahir on his local VAN-OP (port 3000):**
  - People and access shows a C2M column. Roles given: ahmer coo, tahir coo, yawar cfo; each one is in
    `platform_access_log`.
  - `/c2m` opens with a role.
  - "Pull now" copied 241 PO lines (73 POs) and 283 trucks. A second pull gave the same counts. O2S unchanged.
- **Rehearsal of the first real data load (step 5), local only:**
  - Ran the collaborator's loader `--production` against local `van_platform`, with the import pack read
    where it is.
  - Loaded: 26 customers, 133 client products, 142 packs, 59 materials, 32 recipes, 148 dated cost versions
    (4 cost sheets, 30 Jun to 13 Oct), 37 white-label prices, 89 VAN list rows, 25 open import items.
    O2S: 241 PO lines, 283 trucks, 1 sync issue.
  - A second run was refused ("C2M already holds products"), nothing changed. Tahir: Margin shows.
  - Note for go-live: the collaborator's `C2M App\node_modules` is incomplete (`mysql2` cannot find
    `sqlstring`), so the loader does not start from that folder. The rehearsal ran from a temporary copy using
    VAN-OP's packages. Run `npm install` there first, or do the same on the day.
- **Still to do before step 4 (live):**
  - Ask the collaborator for the missing `package.json`, `tests/` and the fix for `tests/run-all.js`
    (doc 12 I-16), so C2M's own tests run here.
  - Check the flag rule (`c2m-lib.js` fixed Rs against D-31 share of sales).
  - The launcher tile stays closed and its date changes after step 4.
- **Open, from C2M's own notes:** VAN brand products have no cost (A-07); no freight (A-08); most clients
  without a price rule (A-05/A-06); 3 real packing bills, the rest placeholders (A-03/A-12).

Pushed: **no**. Tahir: "do not push until we test it locally"; push steps 2 and 3 together when he is done.

## 17 Oct 2026 (2) — Independent review of C2M v0.5: 4 reviewers, "push, but know this" (MODULE: C2M)

Code, data safety, workflow and design reviewers (none wrote C2M), read-only, with the local rehearsal data.
All 4: **safe to push with the tile closed, live C2M tables empty and no live C2M roles**; fix the items
below **before the first live load or opening the tile.** Verified in the code by the integrating session:
items 1, 2, 3, 6 and 7.

**Held up:**
- No cost, rate, price or margin reaches qc or viewer, whether on screen, in API replies or in PDFs.
- Every write route checks the role on the server.
- All values are passed as parameters; no SQL injection found.
- Money is DECIMAL.
- Most decisions are guarded against 2 people at once (409).
- The formulas that run match doc 09: F-01, 02, 04 to 13, 15.
- The O2S pull never writes O2S and rolls back on failure.
- The flag on screen follows F-13/D-31 (`c2m.html` `flag()`). The `lib.flag`/`lib.exposure` copies are unused.

**Fix before first live load / opening (for the collaborator):**
1. **No screen adds a customer, client product or pack** (no route inserts `c2m_customer` /
   `c2m_client_product` / `c2m_client_pack`). A new client or product is never costed; "Sales C2M could not
   place" tells Yawar to add it, but he can't. A VAN brand product with no recipe can't get a first recipe
   either (`c2m.html` new-recipe list filter).
2. **Import queue "Correct" changes nothing except for `rate` items** (`c2m-routes.js` import act). It changes
   nothing for 23 of the 25 day-1 items (kind `note`). The item reads "corrected" but C2M keeps the old
   figure.
3. **Planned or loading O2S trucks count as sold** (`c2m-o2s.js`: every non-voided shipment, no `stage`
   check). Their kg also stays in open POs, so it is counted twice. 0 such trucks in the rehearsal data.
4. **Re-approval "Close: the change was wrong" does not undo the wrong rate.** The same packs are queued again
   at the wrong cost with "moved for another reason", and can then be approved. Items made by a rate or
   packing price save also show a false "approved" figure and % (`from: m.now` / `c0.total` instead of the
   approved cost). A pack can sit in 2 open items (rate saves don't skip waiting packs), and approving both
   writes 2 cost versions.
5. **Rs 0 packing approved silently:** a VAN-packed pack with no packing bill, a bill item with no price, or
   pack size 0. 100 VAN-packed packs have no bill; 9 white label packs with an approved recipe have none (2
   bulk, 7 client-packed). Contradicts A-03.
6. **A price with an end date leaves a gap:** once it ends, the price it replaced does not return. Margin
   falls back to the last O2S PO price, and price lists drop the product without saying so. None of the
   approved prices has an end date yet.
7. **Separation of duties:**
   - Yawar sets rates, approves cost and approves his own re-approvals.
   - Tahir's monthly check stores no figures.
   - A platform admin who is also C2M coo can switch himself to cfo in People and access, propose, then switch
     back and approve; no route compares approver with proposer.
   - Price approval is advice only: O2S PO entry is not controlled.
   - Doc 12 I-01 says there is no stand-in.
8. **Customer price-list PDFs:**
   - The first list calls every price "New price" (O2S PO prices are ignored as previous price).
   - "Raw material cost change" is pre-filled as the reason and prints for the client.
   - An empty list can be downloaded and uses up a VAN/PL number.
   - The title month comes from the latest price date, not the issue date.
   - Every PDF is signed by Yawar, even one a KAM downloads.
9. **Live placeholders:** budgets are seeded `'0'` in the production migration, so Margin reads "against its
   0% budget". A blank Settings box saves 0 with no approval. An old Settings tab can silently put back old
   values; no 1-open-request-per-key rule.
10. **FOC sample lines:** full target price × kg is counted as locked exposure, and cost with no sale shows the
    customer red "below cost". Doc 09 has no rule.
11. **Freight is not dated** (a future rate applies today) and never raises a re-approval. No freight is
    loaded yet (A-08).
12. **C2M's tests are missing.** `tests/lib.test.js`, `flow.test.js` and `run-all.js` are not on disk, so the
    "95 checks passed" (doc 12.1) cannot be re-run. The real F-12/F-13 code lives only in `c2m.html`, and
    screens are untested.

**Smaller:**
- Labels:
  - "approved version" heads today's cost on the Recipe screen.
  - "Not costed: no approved recipe" also shows for a missing rate.
  - A pack can show "costed" with packing or conversion at 0.
  - Customer GP is shown with no sign of how much of its sales is costed.
- Hard-coded dates in screen text (13 Oct, 29 Jul).
- Guide versus screen:
  - "Blank fields are 0" ticked versus unticked.
  - "tables show as cards" is true for the Materials table only.
  - KAMs get no docs, because the viewer branch returns early.
- The first click after typing may be swallowed by a re-render. Likely, but not tested in a browser.
- Lower-case person names.
- Some refusals don't say who to ask.
- "Mark notices seen" also clears notices that arrived after the screen was drawn.
- Several 2-step routes are not one transaction, and the toast then says "Nothing was saved".
- Packing bills and customers: in 2 tabs the last save wins with no warning.
- The in-app change record shows no before/after values.
- Long text is silently cut locally (not strict mode); on live it would fail. `o2s_names` is cut at 600
  characters.
- Confirm live MySQL isolation is not SERIALIZABLE, or the pull's `app_state` read would block O2S saves.
- A missed monthly check cannot be done after the month moves on; "tie to the books" shows no gap.
- `checkDates()` opens a connection at start-up.
- Google Fonts are loaded from the internet.

Pushed: no.

## 17 Oct 2026 (3) — Launcher tile live, and a way back to the launcher (MODULE: C2M + PLATFORM) — NOT PUSHED

Tahir: "lets active the tile" and "add back to launcher in C2M".
- `launcher.html` (platform): the C2M tile is a live, role-based tile (`data-module="c2m"`, `/c2m`), like O2S.
  It opens for C2M role holders and is locked ("Access not granted") for everyone else. On live, nobody holds a
  C2M role, so it shows locked. **Give live C2M roles only after step 4 (tables) and v0.6 fixes and the data
  load (step 5).**
- `c2m.html` (C2M): "← Back to launcher" at the start of the header, linking to `/`, with the same words and
  tooltip as O2S's rail button; small `.hdr .home` style. This is the integrating session's change to the
  collaborator's file; keep it in v0.6.

Pushed: no.

## 17 Oct 2026 (4) — Tahir: C2M goes live now, with known limits (MODULE: C2M) — NOT PUSHED

Tahir's ruling, after the 4-reviewer report above: **live now, known limits.**
- Live C2M roles for **Tahir (coo) and Yawar (cfo) only** until v0.6. No other role holders: not Majid,
  Himayat, Fahim or KAMs.
- **No customer price-list PDFs are sent** until v0.6 fixes item 8 ("New price", the pre-filled reason, empty
  lists, the title month, the signature).
- The collaborator fixes items 1 to 12 in v0.6 while Tahir and Yawar use it.

Go-live steps:
1. Push.
2. `001_c2m_core.PRODUCTION.sql` in phpMyAdmin on `jodilkah_vanop_db` (Tahir).
3. First data load with the loader `--production` against live, once, from Tahir's PC. The password is
   typed by Tahir, never in chat or files.
4. Roles in People and access.
5. Check: pull O2S, Margin, and Yawar enters the real budgets (seeded 0).

Pushed: no.
