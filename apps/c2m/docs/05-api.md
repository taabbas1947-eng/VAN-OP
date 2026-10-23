# 5. API documentation

Version 1.0.3 · 20 Oct 2026 · Owner: Tahir (C2M module owner); Claude records · Rule: R-5h item 5 (D-20)
Changed in the next version (21 Oct 2026; piece 1 of 4 after Tahir's rulings D-89 to D-95; the version number is set at the push; 1.0.3 is live): 5.14 added: GET and POST /api/c2m/roles, POST /api/c2m/roles/:key, POST (and DELETE) /api/c2m/roles/:key/delete; the 45 route guards now check an action (can) not a role name; /me and state.me carry admin and actions; state.people carries roleLabel and grantee.
Changed in 1.0.3 (20 Oct 2026; 1.0.2 went live on 20 Oct at 11:24): 5.13 added: POST /lists/master/preview and /lists/master/carry; /lists/links refuses an unlink or mark after the carry-over; /lists/revise words its refusal for the carry-over (D-87).
Changed in 1.0.2 (19 to 20 Oct 2026; 1.0.1 went live on its own on 19 Oct at 23:19): POST /api/c2m/lists/links open to coo and renames a linked row (unlink gives its name back), takes wasPack per row (20 Oct 2026); POST /api/c2m/lists/revise and /lists/revisions/:id/approve answer 400 when an added pack's product is out of use (20 Oct 2026, D-86); POST /api/c2m/names/rename-linked, /api/c2m/names/product/:id and /api/c2m/names/o2s added; GET /api/c2m/state gives products o2sNames and nameLog to cfo and coo (D-85).
Changed in 1.0.1 (19 Oct 2026): POST /api/c2m/lists/links takes {id, noPack: true or false} (D-80).
Changed in 1.0.0 (19 Oct 2026): POST /api/c2m/lists/revise accepts added rows (D-77); GET /api/c2m/state me.more, and buyer lines with cat on sales, foc, open and poLines (D-74, D-76).
Changed in 0.9.3 (19 Oct 2026): POST /api/c2m/lists/links added (D-73).
Changed in 0.9.2 (19 Oct 2026): no route added or removed. GET /api/c2m/state adds fedPct for every role; settings refuses fed_pct not above 0 and below 100 (400); an approved FED change works again the price with FED on every distributor and dealer row; list revisions and documents use the FED setting; a document stores its fedPct (D-72).
Changed in 0.9.1 (3 independent reviews, 18 Oct 2026 night): no route added or removed. reapprovals approve replies reopened (D-61); the 4 approval routes refuse the proposer with 403 (D-63); checks validates its figures (D-64); GET /api/c2m/state, cfo and coo: foc [{date, cust, grp, brand, pack, packId, po, kg, cost}] and FOC lines left out of sales and open (D-62); each pack, for those who see prices: priceEnded {price, till} or null, lastPoPrice; checks rows carry data (parsed) in place of data_json.
Changed in 0.9.1 (documentation review, 18 Oct 2026): me.nav for cfo and coo shows reports; a wrong mount answers 503 (5.1, 5.3); state reply keys by role (5.2a); past dates refused on propose and revise; more 403 and 503 messages; lock clash 409; first example corrected; examples for every route (5.4).
Changed in 0.9.0: no route added or removed. GET /api/c2m/state adds, for cfo and coo only: priceHistory [{id, packId, price, prev, from, to, reason, by, at, decidedBy, decidedAt}], poLines [{po, received, cust, grp, brand, pack, packId, kg, price, foc}], importedAt, nextDocRef; proposals add decidedAt; products add fam and typeName (every role that receives products; a viewer receives none); white label list rows add typeId and fam. me.nav for cfo and coo adds reports (D-53, D-55, D-57). priceHistory holds approved prices, including those a newer price ended; poLines covers this financial year. POST /api/c2m/prices/propose now refuses an empty reason (400, "Write the reason the client will read on the list.").
Changed in 0.8.0: nav lists per role (state.me.nav too); 2 error texts name the new places (a packing price is changed on Inputs, Packing items; a VAN pack is priced in Prices, VAN brand lists). No route added or removed; no reply shape changed (D-45 to D-52).
Changed in 0.7.0: state sales rows carry the buyer, the O2S channel and region for VAN brand sales; propose refused for a VAN brand pack (D-44).
Changed in 0.6.0: re-approval approve replies {ok, approved, left}; state carries costGaps on a pack that is not costed; recipe advance to approved is refused while a pack is not fully costed; propose is refused for a pack of an inactive product, and for any pack that is not costed, including one whose recipe is not in C2M yet; a labour or FOH rate must be above 0; issuing a distributor list sets each row's previous price to the printed price; re-approval items can carry {from: null, pct: null, first: true} for a pack's first approved cost.
Changed in 0.4.0 and 0.5.0: mount needs the platform pool; 503 when dates do not come back as text; prepared statements; 2 withdraw routes; validFrom (Takes effect from) on propose; approve replies carry waitsUntil (and cancelled for prices); a list revision is refused while an approved one waits; 1 open target request per product; pull lock frees after 10 minutes; examples use made-up figures.
Changed in 0.3.0 and 0.3.1: stale single-product conversion row removed; 1 table for all routes; new routes for product type, reprocessed flag, material class, VAN list revisions, re-approval close and the logo; packIds on re-approval approve; validFrom and validTo on price propose; confirmed and the reply {reapproval, kind} on import correct; 1 errors section with every 409 route.

Code: `apps/c2m/c2m-routes.js`. Style: close to OpenAPI (method, path, who, body, reply, errors). Rule references: see 06 and the Design Record.

## 5.1 Mount, sign in, format, versions, limits
- Mount: the platform mounts C2M with 1 line, `require('./apps/c2m/c2m-routes')(app, { pdq, pool, auth, path, fs, crypto })`. pool (the platform's mysql2 promise pool), pdq and auth are required, because transactions and the 409 guards depend on the pool. Without them C2M answers every /c2m and /api/c2m request with 503 "C2M is not set up: ... Ask IT." (see 5.3); the platform keeps running.
- Dates as text: at start C2M reads a date from the database. If the pool does not return DATE and DATETIME as text (mysql2 option dateStrings: true), every /api/c2m request gets 503 "C2M needs the database pool to return dates as text (mysql2 option dateStrings: true). Ask IT."
- Queries: every query runs as a prepared statement (pool.execute). A list in a query gets 1 placeholder per value (IN (?,?,?)), because a prepared statement cannot take an array for 1 placeholder.
- Sign in: the platform's own sign-in (`auth`), read as a Bearer token (`van_token`), as O2S does. Then C2M looks up the person's role in `user_module_roles` (module 'c2m'). No c2m role: 403.
- Every `/api/c2m/*` route needs both. JSON in and out, except the PDF and the documents.
- Dates are `YYYY-MM-DD`. Times C2M writes are Pakistan time (Asia/Karachi, F-15).
- Numbers for rates, prices and Rs per kg must be digits only (e.g. `387` or `387.5`); "Rs 387" or "3,87" is refused.
- Versioning: none yet (1 client, the C2M page). Limits: JSON body 10 MB on the stand-in; the platform sets its own.
- Owner of every route: Tahir (module owner). Rule on each row.

## 5.2 Routes

Roles: cfo = Yawar, coo = Tahir, production = Majid, qc = Himayat, plant = Fahim, viewer = KAMs and managers. "409" in the last column means the route can return 409 (see 5.3).

| Method | Path | Who | Body | Reply | Rule | 409 |
|---|---|---|---|---|---|---|
| GET | /c2m | anyone (the page then asks for sign-in) | | the page (no-store) | D-01 | |
| GET | /c2m/assets/van-logo.png | anyone | | VAN logo PNG for the page and PDFs | D-13, D-14 | |
| GET | /api/c2m/me | all roles | | {user, name, role, label, nav}. nav (0.9.0): cfo and coo [today, margin, reports, products, prices, inputs, setup, guide]; production and plant [today, recipes, guide]; qc [today, recipes, inputs, guide]; viewer [lists, guide]. Screens only: rights are checked on each route (D-45) | R-2 | |
| GET | /api/c2m/state | all roles; filtered by role (see 11). `?as=username`: grants.give only, for a manager given price lists (viewer type role): the reply is that manager's own state, read only (D-97) | | everything the person's screens need, keys by role in 5.2a; a pack that is not costed has cost null and costGaps (what is missing, D-40) | R-2, D-14, D-40 | |
| POST | /api/c2m/sync | cfo, coo | | {syncId, poLines, trucks, issues}; a pull left Pulling for more than 10 minutes frees itself | D-12, D-21 | yes |
| POST | /api/c2m/recipes/new | production, cfo, coo | {clientProductId, fromVersionId?, note} | {id} | D-08, R-5i 2 | |
| POST | /api/c2m/recipes/:id/lines | production; draft only | {lines:[{gradeId, qty}], note?} | {ok} | D-08 | yes |
| POST | /api/c2m/recipes/:id/advance | the role of the current step (draft production, review qc, endorse plant, cost cfo) | {note?} | {state} | D-08, D-09 | yes |
| POST | /api/c2m/recipes/:id/sendback | qc, plant, cfo at their own step | {reason, advice} | {ok} | D-09 | yes |
| POST | /api/c2m/rates/try | cfo | {gradeId, rate} | {warning:{warn, pct}, impact:[{packId, label, now, after, pct, approved, pctApproved, reapprove, openKg, rsOnOpen, priceForTarget}]}; now, pct and rsOnOpen are null on a material's first rate; approved and pctApproved are null when the pack has no approved cost yet, and then reapprove is false; saves nothing | D-10 | |
| POST | /api/c2m/rates | cfo | {gradeId, rate, source, confirmed?} | {ok, reapproval: packs batched} | D-10, R-5i 6 | |
| POST | /api/c2m/packing/rate | cfo | {itemId, price, source, confirmed?} | {ok, reapproval} | D-19 | |
| POST | /api/c2m/packing/item | cfo | {name, kind, price, source} | {id} | D-19 | |
| POST | /api/c2m/packing/bill | cfo | {id?, name, lines:[{itemId, level: primary or secondary, pieces, packsPerOuter}]} | {id, reapproval} | D-19 | |
| POST | /api/c2m/packing/assign | cfo | {packId, billId or null} | {ok, reapproval} | D-19 | |
| POST | /api/c2m/reapprovals/:id/approve | cfo | {} for all, or {packIds:[...]} for the ticked packs only (an empty list is refused) | {ok, approved: packs given a new cost, left: [packs kept on their approved cost, with why], reopened: packs not ticked put in a new open item "Left open from item N" (D-61)}; approves today's cost; if a cost moved since the item was shown, the change record says "cost moved since shown"; a pack now within reapprove_pct of its approved cost, or not fully costed, is left (D-41) | R-2 Cost, R-5i 6, D-41 | yes |
| POST | /api/c2m/reapprovals/:id/dismiss | cfo | {why} | {ok, reapproval: packs batched again for another cause} | R-2 Cost | yes |
| POST | /api/c2m/rules/conversion | cfo | {name, kind: labour or foh, rsPerKg (above 0; a Rs 0 rate counts as missing, D-40), scope: general, type or list, baseProductId (type), productIds[] (list), form?, reprocessed? (0 or 1), packMin?, packMax?, validFrom? (today or earlier), source?} | {id, reapproval} | D-25, R-5i 7 | |
| POST | /api/c2m/rules/conversion/:id/retire | cfo | {why} | {ok, reapproval}; refused if any pack would have no labour or FOH rate | D-25 | yes |
| POST | /api/c2m/products/:id/type | cfo | {typeId} or {newType: name} | {ok, reapproval} | D-25, A-16 | |
| POST | /api/c2m/products/:id/reprocessed | cfo | {on: true or false} | {ok, reapproval} | D-04, D-25 | |
| POST | /api/c2m/materials | cfo | {name, typeId, unit: kg or L, grade, rate, source} | {gradeId} | D-10, D-23 | |
| POST | /api/c2m/materials/:id/type | cfo, qc | {typeId} (the class) | {ok}; a non-nutrient class clears the grade's nutrient values (old values in the change record) | D-23 | |
| POST | /api/c2m/grades/:id/nutrients | cfo, qc | {values: {"K%": 56}} (0 to 100) | {ok}; 400 for a class with no nutrient fields | D-23 | |
| POST | /api/c2m/customers/:id | cfo | {priceRule: time, po or list, cycle, region, o2sNames: "a\|b"} | {ok} | R-5 client price rule | |
| POST | /api/c2m/freight | cfo | {segment: Dealer or Farmer, region, rsPerKg, validFrom?} | {ok} | D-05 | |
| POST | /api/c2m/prices/propose | cfo | {packId, price, reason, belowReason (needed below target), validFrom? (Takes effect from; default today; a past date is refused), validTo? (valid till: the last day the price applies; the effective date or later), replaceId? (a sent-back proposal)} | {id}; refused if the pack already has a price waiting for Tahir, its product is inactive, the pack is not costed (D-40), or it is a VAN brand pack (priced through list revisions, D-44) | D-06, D-22, D-34 | yes |
| POST | /api/c2m/prices/:id/approve | coo | | {ok, waitsUntil, cancelled}. Starts on the later of its effective date and today. waitsUntil = the date when it is dated ahead, else null; today's price stays in force until then. cancelled = how many older waiting prices for the pack it replaced (audit "cancelled") | D-22, D-34, R-5i 3 | yes |
| POST | /api/c2m/prices/:id/withdraw | coo | {why} | {ok, issuedDocs}; only an approved price still waiting for its date; the price it shortened gets its old end back; issuedDocs lists price lists already issued with it; Yawar gets a notice (audit "withdrawn", "end restored") | D-34 | yes |
| POST | /api/c2m/prices/:id/sendback | coo | {reason} | {ok}; 400 "Nothing to send back" if no longer proposed | D-09 | |
| POST | /api/c2m/settings | cfo | {changes:{key: value}} | {applied, pending}; 400 when a value is not a number, or fed_pct is not above 0 and below 100 | D-18, D-72 | |
| POST | /api/c2m/settings/requests/:id/approve | coo | | {ok} | D-18 | yes |
| POST | /api/c2m/settings/requests/:id/refuse | coo | | {ok} | D-18 | yes |
| POST | /api/c2m/targets/request | cfo | {clientProductId, toGp (0 to below 100), reason} | {id}; refused if the product already has a target request waiting for Tahir | D-06 | |
| POST | /api/c2m/targets/:id/approve | coo | | {ok} | D-06 | yes |
| POST | /api/c2m/targets/:id/refuse | coo | | {ok} | D-06 | yes |
| POST | /api/c2m/import/:id/accept | cfo | | {ok, reapproval: 0, kind} | D-07 | yes |
| POST | /api/c2m/import/:id/correct | cfo | {value, why, confirmed? (for a rate move over the warning %)} | {ok, reapproval, kind}; a rate item is saved through the rate controls | D-07, D-10 | yes |
| POST | /api/c2m/grants | grants.give (cfo, coo) | {username, kind: list or client, value, on: true or false} | {ok} | R-2 People and rights | |
| POST | /api/c2m/grants/clients | grants.give | {username, on: true or false}: true grants every white label client (VAN brand never), false clears every client grant of that person | {ok, clients: how many}; 400 when the person sees every list already or has no C2M access; 1 line in the change record | D-97 | |
| POST | /api/c2m/grants/copy | grants.give | {from, to}: replaces every list and client grant of `to` with those of `from`, in 1 transaction | {ok, copied: how many}; 400 for the same person twice, or when either is not a manager given price lists; the change record keeps the old and the new grants | D-97 | |
| POST | /api/c2m/actuals | cfo | {month: YYYY-MM, labour, foh} | {ok} | D-18 | |
| POST | /api/c2m/checks | coo for rate_check; cfo for tie_books | {month, kind, data}: rate_check data {rates:[{gradeId, name, c2m, date, source, rs, register}]}, every register above 0; tie_books data {erpSales, erpCogs}, ERP figures above 0; the server works out and stores C2M's own c2mSales, c2mCogs, c2mUncosted and focCost for the month (anything the page sends for them is ignored); rate_check needs at least 1 material | {ok}; 403 if Yawar tries the rate check; 400 "Every material listed needs its purchase register rate (digits above 0) before the check is done." or "Enter ERP sales and ERP COGS for the month, in Rs (digits above 0)." | D-18, D-64 | |
| POST | /api/c2m/notices/seen | cfo, coo | | {ok} | D-18 | |
| POST | /api/c2m/lists/links | cfo, coo (from 1.0.2; the mark: cfo only) | {links:[{id, packId (a VAN brand pack, or null to unlink)} or {id, noPack: true or false} (from 1.0.1)]}, 1 to 500 rows | {changed}; 400 (nothing saved) when the batch is empty or over 500 rows, a row id is missing or not a whole number, a row is unknown, the pack is not an active VAN brand pack (or not a whole number), noPack is not true or false, noPack true comes with a pack, the row is linked, the row names a C2M VAN pack by name, size and unit, a waiting revision adds the pack the row names, or (Undo) a revision that adds a pack to that list waits; each change in the audit (list_price, link; not_c2m_pack or not_c2m_pack_undone, D-80); a link takes out the mark | D-73, D-80 | yes |
| POST | /api/c2m/lists/revise | cfo | {list: dist, dealer or farmer, items:[{id, values:{field: number}} or, from 1.0.0, {id: null, packId: a VAN brand pack not yet on this list, values:{field: number above 0}} (D-77)], reason, validFrom (today or later; a past date is refused), validTill?, replaceId? (a sent-back revision)} | {id, rows}; refused if the list already has a revision waiting for Tahir, or an approved revision waiting for its date | D-28, D-34 | yes |
| POST | /api/c2m/lists/revisions/:id/approve | coo | | {ok, waitsUntil}. Dated today or earlier: list rows, previous prices and list dates change now (waitsUntil null). Dated ahead: waits; C2M applies it on its first load on or after the date | D-28, D-34 | yes |
| POST | /api/c2m/lists/revisions/:id/withdraw | coo | {why} | {ok}; only an approved revision still waiting for its date; the list stays as it is (audit "withdrawn") | D-34 | yes |
| POST | /api/c2m/lists/revisions/:id/sendback | coo | {reason} | {ok} | D-28 | yes |
| POST | /api/c2m/pricedocs | cfo, coo; viewer only for a granted list or client | {audience, client (wl), fields[], eff?, till?, ref?, note?, reasons?} (a viewer cannot set eff, till, note or reasons) | {id, ref} (ref = VAN/PL/year/number). No eff: a client list takes the client's latest approved price date, a VAN list its own list dates. eff ahead: prices in force on that date; a distributor list issued makes each row's printed price its previous price (D-42) | D-14, D-34 | |
| GET | /api/c2m/pricedocs/:id/pdf | cfo, coo; the creator while the grant still stands | | application/pdf, printed from the saved snapshot; footer and "page n of N" on every page | D-14 | |
| GET | /api/c2m/docs/:file | cfo, coo: all 12; production, qc, plant: 01, 07, 11; viewer: 07, 11 | | text/plain (the Markdown file) | D-20 | |

## 5.2a Reply of GET /api/c2m/state, keys by role (owner: Tahir; R-2 People and rights, D-14, D-58)

| Keys | Who receives them |
|---|---|
| me {user, role, label, nav, name}, settings (rows for cfo and coo only, [] for others), fedPct (0.9.2, D-72), products, recipes, today | every role (a viewer gets products [] and recipes []) |
| products[].packs[].cost, costGaps, approvedCost, floor, labour, sheet; recipes[].lines[].rate, date, cost; recipes[].materials | cfo, coo, production, plant |
| products[].packs[].price, priceSource, prevPrice, priceFrom, priceTill, nextPrice, waitingProposal; products[].target, budget, budgetKg | cfo, coo |
| materials (no rates), materialTypes | qc, cfo, coo |
| rates (with source and last 6 rates), packingItems, packingBills, rules, productTypes | cfo, coo, production, plant |
| grants, lists (granted lists only, farmer columns by grant), wlLists (granted clients only) | viewer |
| reapprovals | cfo, coo |
| sales, foc (0.9.1), unmatched, open, proposals, priceHistory, poLines, importedAt, nextDocRef, imports, settingRequests, targetRequests, notices, grants, people, lists, wlLists, actuals, checks, sources, fieldMap, lastSync, audit (last 60), freight, listItems, listRevisions, customers, docs (all 12) | cfo, coo |
| docs (01, 07, 11) | production, qc, plant |

Field rules for list revisions: dist takes now, mrp; dealer takes nsv, disc (a fraction below 1; the page types it as %), frp, mrp; farmer takes pb, sn, snc. On approval C2M works out dist fed = now x (1 + FED %), dealer net = nsv x (1 - disc), netfed = net x (1 + FED %); FED % is the setting fed_pct (5 now, D-72). When Tahir approves a new FED %, every distributor and dealer row is worked again.

## 5.3 Errors

Every error is `{ "error": "plain message" }`. Nothing is saved when an error comes back (writes run in 1 transaction).

| Code | Meaning | Example message | Routes |
|---|---|---|---|
| 400 | Wrong or missing input, or a rule refuses it | "Add the source: PO number or quote." · "A rate starts today or earlier..." · "Tick at least 1 pack, or use \"The rate was wrong\" to close it." · "This pack already has a price waiting for Tahir." · "A revision of this list is approved and waits for (date). Ask Tahir to withdraw it first, or wait until it takes effect." · "Write why the waiting price is withdrawn." | any route with a body |
| 401 | Not signed in (from the platform) | platform message | every /api/c2m route |
| 403 | No C2M role, or the role cannot do this | "You do not have access to C2M. Ask Tahir to grant it in People and access." · "Your role cannot do this in C2M." · "This step is not yours." · "Only the person at this step can send it back." · "You proposed this, so another person approves it (ruling 19)." (approving your own price, list revision, setting or target; D-63) · "The rate check is done by a second person, not by the person who entered the rates." · "This list is not granted to you." · "This document is not yours, or the list is no longer granted to you." · "Not available to your role." | every /api/c2m route |
| 409 | Someone else changed it a moment ago, or the item is no longer in the state the route needs | "Someone else changed this a moment ago. Check before retrying." For the pull: "A pull is already running. Wait a minute, then look again." | any write route on a database lock clash (deadlock or lock wait); sync; recipes/:id/lines, /advance, /sendback; reapprovals/:id/approve, /dismiss; rules/conversion/:id/retire; prices/propose (replaceId), prices/:id/approve, /withdraw; settings/requests/:id/approve, /refuse; targets/:id/approve, /refuse; import/:id/accept, /correct; lists/revise (replaceId); lists/revisions/:id/approve, /withdraw, /sendback |
| 500 | Unexpected fault | "Something went wrong. Nothing was saved." | any |
| 503 | C2M tables are not installed, the pool does not return dates as text, the mount is wrong, or the database cannot be reached | "C2M tables are not installed yet. Ask IT to run the C2M migration." · "C2M needs the database pool to return dates as text (mysql2 option dateStrings: true). Ask IT." · "C2M is not set up: the platform must mount it with its mysql2 promise pool { pdq, pool, auth, path, fs, crypto }. Ask IT." · "C2M is not set up: pdq and auth are missing from the mount. Ask IT." · "C2M cannot reach the database. Try again in a minute." | any route that reads a c2m_ table; every /api/c2m route for the dates and database check; every /c2m and /api/c2m route when the mount is wrong |

## 5.4 Examples (example figures)

Rate over the warning %:
`POST /api/c2m/rates {"gradeId":12,"rate":433,"source":"PO 1234"}`
→ 400 `{"error":"Did you mean Rs 433? It is 12% from the last saved rate of Rs 387. Tick \"Yes, I meant this rate\" to save."}`
Same call with `"confirmed":true` → 200 `{"ok":true,"reapproval":4}`.

Price dated ahead:
`POST /api/c2m/prices/propose {"packId":31,"price":200,"reason":"Raw material cost change","validFrom":"2026-11-01"}` → 200 `{"id":15}`.
`POST /api/c2m/prices/15/approve` → 200 `{"ok":true,"waitsUntil":"2026-11-01","cancelled":0}`.
`POST /api/c2m/prices/15/withdraw {"why":"client asked to hold"}` → 200 `{"ok":true,"issuedDocs":[]}`. Today's price stays.

List revision dated ahead:
`POST /api/c2m/lists/revisions/4/approve` → 200 `{"ok":true,"waitsUntil":"2026-11-01"}`.
`POST /api/c2m/lists/revisions/4/withdraw {"why":"date moved"}` → 200 `{"ok":true}`.

Approve only the ticked packs of a re-approval:
`POST /api/c2m/reapprovals/7/approve {"packIds":[31,32]}` → 200 `{"ok":true,"approved":1,"left":["Product A 10 kg for Client X (today's Rs 132.50 is within 3% of the approved Rs 132.00)"]}`. Packs not ticked, and packs left, keep their approved cost.

Close a re-approval when the change was wrong:
`POST /api/c2m/reapprovals/7/dismiss {"why":"rate typed wrong"}` → 200 `{"ok":true,"reapproval":0}`. If packs still differ for another cause, `reapproval` is the number of packs in the new item.

Two people press the same button:
`POST /api/c2m/prices/15/approve` (second click) → 409 `{"error":"Someone else changed this a moment ago. Check before retrying."}`.

Import rate correction:
`POST /api/c2m/import/3/correct {"value":"Rs 391","why":"invoice 1234","confirmed":false}` → 200 `{"ok":true,"reapproval":2,"kind":"rate"}`.

Every other route, 1 line each (example figures; ids made up; ... = fields left out):

| Call | Reply |
|---|---|
| `GET /api/c2m/me` | `{"user":"yawar","name":"Yawar","role":"cfo","label":"CFO","nav":["today","margin","reports","products","prices","inputs","setup","guide"]}` |
| `GET /api/c2m/state` | `{"me":{...},"settings":[...],"products":[...],"recipes":[...],"today":"2026-10-19",...}` (keys in 5.2a) |
| `POST /api/c2m/sync` | `{"syncId":5,"poLines":240,"trucks":280,"issues":["Customer not matched in C2M: Client Z"]}` |
| `POST /api/c2m/recipes/new {"clientProductId":7,"fromVersionId":21,"note":"TSP replaced by DAP"}` | `{"id":30}` |
| `POST /api/c2m/recipes/30/lines {"lines":[{"gradeId":12,"qty":0.5},{"gradeId":14,"qty":0.6}]}` | `{"ok":true}` |
| `POST /api/c2m/recipes/30/advance {"note":"checked"}` | `{"state":"review"}` |
| `POST /api/c2m/recipes/30/sendback {"reason":"K% short","advice":"raise Material M"}` | `{"ok":true}` |
| `POST /api/c2m/rates/try {"gradeId":12,"rate":400}` | `{"warning":{"warn":false,"pct":3.4},"impact":[{"packId":31,"label":"Product A 10 kg for Client X","now":130,"after":131.3,"pct":1,"approved":130,"pctApproved":1,"reapprove":false,"openKg":0,"rsOnOpen":0,"priceForTarget":175.07}]}` |
| `POST /api/c2m/packing/rate {"itemId":4,"price":105,"source":"quote 77"}` | `{"ok":true,"reapproval":0}` |
| `POST /api/c2m/packing/item {"name":"Bag 10 kg","kind":"bag","price":100,"source":"PO 55"}` | `{"id":40}` |
| `POST /api/c2m/packing/bill {"name":"Bag 10 kg + carton of 2","lines":[{"itemId":40,"level":"primary","pieces":1},{"itemId":41,"level":"secondary","pieces":1,"packsPerOuter":2}]}` | `{"id":9,"reapproval":0}` |
| `POST /api/c2m/packing/assign {"packId":31,"billId":9}` | `{"ok":true,"reapproval":1}` |
| `POST /api/c2m/rules/conversion {"name":"Labour, all liquids","kind":"labour","rsPerKg":5,"scope":"general","form":"liquid"}` | `{"id":12,"reapproval":3}` |
| `POST /api/c2m/rules/conversion/12/retire {"why":"replaced by a product type rate"}` | `{"ok":true,"reapproval":0}` |
| `POST /api/c2m/products/7/type {"typeId":3}` | `{"ok":true,"reapproval":0}` |
| `POST /api/c2m/products/7/reprocessed {"on":true}` | `{"ok":true,"reapproval":1}` |
| `POST /api/c2m/materials {"name":"Material N","typeId":2,"unit":"kg","grade":"Standard","rate":400,"source":"PO 88"}` | `{"gradeId":60}` |
| `POST /api/c2m/materials/18/type {"typeId":5}` | `{"ok":true}` |
| `POST /api/c2m/grades/60/nutrients {"values":{"K%":50}}` | `{"ok":true}` |
| `POST /api/c2m/customers/3 {"priceRule":"time","cycle":"Monthly","region":"Punjab","o2sNames":"Client X\|Client X Pvt"}` | `{"ok":true}` |
| `POST /api/c2m/freight {"segment":"Dealer","region":"Sindh","rsPerKg":4}` | `{"ok":true}` |
| `POST /api/c2m/prices/15/sendback {"reason":"check the date"}` | `{"ok":true}` |
| `POST /api/c2m/settings {"changes":{"rate_warn_pct":"12"}}` | `{"applied":0,"pending":1}` |
| `POST /api/c2m/settings/requests/4/approve` (or /refuse) | `{"ok":true}` |
| `POST /api/c2m/targets/request {"clientProductId":7,"toGp":22,"reason":"client volume up"}` | `{"id":6}` |
| `POST /api/c2m/targets/6/approve` (or /refuse) | `{"ok":true}` |
| `POST /api/c2m/import/3/accept` | `{"ok":true,"reapproval":0,"kind":"note"}` |
| `POST /api/c2m/grants {"username":"kam1","kind":"list","value":"dist","on":true}` | `{"ok":true}` |
| `POST /api/c2m/actuals {"month":"2026-09","labour":1000000,"foh":2000000}` | `{"ok":true}` |
| `POST /api/c2m/checks {"month":"2026-09","kind":"rate_check","data":{"rates":[{"gradeId":5,"name":"Material M","c2m":120,"register":121.5}]}}` (example figures) | `{"ok":true}` |
| `POST /api/c2m/notices/seen` | `{"ok":true}` |
| `POST /api/c2m/lists/revise {"list":"dealer","items":[{"id":5,"values":{"nsv":1000,"disc":0.05}}],"reason":"cost change","validFrom":"2026-11-01"}` | `{"id":4,"rows":1}` |
| `POST /api/c2m/lists/revisions/4/sendback {"reason":"MRP too high"}` | `{"ok":true}` |
| `POST /api/c2m/pricedocs {"audience":"wl","client":"Client X","fields":["product","pack","cur","prev","chg","reason","eff"]}` | `{"id":11,"ref":"VAN/PL/2026/011"}` |
| `GET /api/c2m/pricedocs/11/pdf` | the PDF file (application/pdf) |
| `GET /api/c2m/docs/07-guide.md` | the Markdown text (text/plain) |
| `GET /c2m`, `GET /c2m/assets/van-logo.png` | the page; the logo PNG |

## 5.5 Changed in 1.0.0 (owner: Tahir; D-74, D-76, D-77; version 1.0.0, 19 Oct 2026)

| Route | Change | Errors added | Rule |
|---|---|---|---|
| POST /api/c2m/lists/revise | An item {id: null, packId, values} adds a row for that VAN brand pack on approval. Reply unchanged: {id, rows} | 400 "Only a VAN brand pack can be added to a VAN brand list."; 400 "<brand size unit> is already on this list: change its price instead."; 400 "<brand>: <field> must be a number above 0"; 400 "<n> rows of this list are not linked to a pack yet. Link them first ..." while any row of the list has no packId | D-77, D-73 |
| POST /api/c2m/lists/links | Refuses a 2nd row of a list on 1 pack (400 "Another row of this list (...) is already linked to that pack ..."); refuses a pack that waits to be added to that list in a proposed or approved, not yet applied, revision | 400 "That pack waits to be added to this list in a revision that is with Tahir or approved and waiting for its date. ..." | D-77 |
| POST /api/c2m/settings | budget_gp waits for Tahir like the thresholds (pending, not applied) | none | D-75 |
| POST /api/c2m/prices/propose, POST /api/c2m/lists/revise | A new proposal closes every older sent-back proposal of that pack; a new revision every older sent-back revision of that list (status replaced, audit "replaced"). /lists/revise also refuses an added row while a pack has 2 rows on that list | 400 "<n> packs have more than 1 row linked on this list ..." | D-77, D-78 |
| GET /api/c2m/state | proposals carry to (valid till) |  | D-78 |
| GET /api/c2m/state | me.more (the places under More); every row of sales, foc, open and poLines carries cat (wl, dist, dealer, cobo, vg, farm) and cust is the buyer line (D-74); region is empty for farm | none | D-74, D-76 |

Example (example figures): `POST /api/c2m/lists/revise {"list":"dist","items":[{"id":null,"packId":82,"values":{"now":1000}}],"reason":"new pack","validFrom":"2026-11-01"}` returns `{"id":7,"rows":1}`.

## 5.12 Product names (1.0.2; owner: Tahir; D-85)

| Method | Address | Who | Input | Output and errors | Rule |
|---|---|---|---|---|---|
| POST | /api/c2m/names/rename-linked | cfo, coo | {} | {changed, skipped: [rows linked to a pack of another size, not renamed]}: linked list rows renamed to the official name, each logged (list_price, rename); names read inside the transaction | D-85 |
| POST | /api/c2m/names/product/:id | cfo, coo | {brand?, o2sNames?: [names], was: {brand, o2s} (the names the page showed, o2s joined by \|), preview?: true, accept?: {leave, join}} | preview: {preview, impact: {leave, join: {trucks, rs, from, names}}, brand, o2sNames}, nothing saved; save: {ok, changed, rowsRenamed, impact} (impact leave and join: trucks, rs, from, names, open order lines, openKg, and n = trucks + open lines, the count accept carries); the name before a rename is kept as a spelling. 400 when was is missing, the product is not an active VAN brand product, the name is empty, over 120 characters or holds the sign \|, the spellings are not a list of names or together exceed 120 characters, or a name is already a name of another VAN brand product with a pack size in common (from 20 Oct 2026 a shared official name across different pack sizes is allowed), or another VAN brand product has exactly these spellings; 409 when the names changed since the page showed them, or the trucks moved are not the counts in accept; logged (product_name, rename and o2s_names, with trucks and Rs moved). Example: {"brand": "New name", "was": {"brand": "Old name", "o2s": "Old name"}, "preview": true} | D-85, review 1.0.2 |
| POST | /api/c2m/names/product/:id/use | cfo, coo | {inUse: true or false, preview?: true, accept?: {leave, join}} | preview: {preview, impact, brand}; save: {ok, changed, impact}; 400 when not a VAN brand product, a list row is linked to its packs, a revision adds one of its packs, a price for it waits, or (back in use) its names clash with a product in use; 409 when the trucks moved are not the counts in accept; logged (product_name, out_of_use or in_use). Example: {"inUse": false, "preview": true} | D-86 |
| POST | /api/c2m/names/o2s | cfo, coo | {name, productId, size (the O2S pack size)} | {ok, changed, impact}; 0 when it is already a name of the product; 400 when the size is missing, the product has no pack of that size, or as above (sign \|, 120 characters, clash); logged (product_name, o2s_names, with trucks and Rs now costed) | D-85, review 1.0.2 |
| POST | /api/c2m/lists/links (changed) | cfo, coo | as before; each row may carry wasPack (the link the page showed: a pack id or null) | 409 when wasPack is sent and the row's link differs; 400 when the row is written with another size or unit than the pack, or the pack's product is out of use; a link renames the row to the official name and keeps its first name; an unlink gives that name back; the mark ({noPack}) stays cfo only (403 for coo) | D-73, D-80, D-85 |

## 5.13 1 master list (1.0.3; owner: Tahir; D-87)

| Method | Address | Who | Input | Output and errors | Rule |
|---|---|---|---|---|---|
| POST | /api/c2m/lists/master/preview | cfo, coo | {picks?: {name key: product id or "none"}, keep?: {"list\|packId": row id}, rowPick?: {row id: pack id or "leave"}} | {ready, sig, counts {rows, linked, matched, picked, leaving, undecided, unresolved, groups, toPick}, groups [{key, names, lists, guess {cpId, why}, pick, picked, rows [{id, list, name, size, packId, label, how, why, rowPick, kept}]}], conflicts [{key, list, packId, label, keep, rows [{id, name, linked, prices}]}], leave [{id, list, name, why}], revisions [lists with a revision open]}; after the carry-over {carried {at, by}}; 400 when a pick is not a VAN brand product in use, or a row pick is not a C2M pack of the row's size; reads only | D-87 |
| POST | /api/c2m/lists/master/carry | cfo, coo | as preview, with sig (the plan's signature the screen showed) | {ok, carried, linked, left, renamed}; 400 when sig is missing, the plan is not ready, or a list revision is with Tahir or waiting for its date; 409 when the lists were carried a moment ago, or the plan is not the one seen (nothing saved) | D-87 |
| POST | /api/c2m/lists/links (changed) | cfo, coo | as before | after the carry-over: 400 for an unlink (packId null) or a mark; a move to another pack of the same size is taken | D-87 |
| POST | /api/c2m/lists/revise (changed) | cfo | as before | an added pack is refused while rows of the list are not in the master: "Carry the price lists into the master first" | D-87 |
| GET | /api/c2m/state (changed) | cfo, coo | none | listItems holds rows of the 3 lists only; listMaster {carried {at, by} or null, old}; listOld [{id, list, name, prices, left {at, by, why}}]; lists print from the master after the carry-over, with C2M's description | D-87, D-88 |
| POST | /api/c2m/lists/remove | cfo, coo | {rows: [{id, wasPack}] (1 to 3 lists of 1 pack) or {id, wasPack}, why} | {ok, name}; 400 when why is empty or a revision with Tahir or waiting holds the row; 409 when the row is no longer on a list or wasPack differs | D-88 |
| POST | /api/c2m/names/product/:id/spec | cfo, coo | {spec, was (the description the page showed)} | {ok, changed}; 400 over 200 characters or not a VAN brand product; 409 when it changed since | D-88 |

After review (20 Oct 2026): preview also answers linked [rows already linked, with prices], stale [picks dropped], nameWarn [official names with brackets that will print], sentBack [revisions closed at the carry], counts.waiting [rows waiting for a pack or "leaves"], and each row's prices and mark; a stale pick is dropped (200), not refused. Carry refuses a stale pick (409) and a plan with rows waiting (400). POST /lists/links: 2 rows may swap packs in 1 save; a row off a list is refused (400). POST /lists/revise: 409 when a row left the list a moment ago. POST /lists/revisions/:id/approve: 400 when a row of it is no longer on the list.

Example: POST /api/c2m/lists/master/preview {"picks": {"brand x": "none"}} answers {"ready": false, "counts": {"rows": 89, "linked": 21, ...}, "groups": [...]} (example figures).

After the re-check (20 Oct 2026): POST /lists/revise takes wasPack on each row item (409 when the row was moved meanwhile); an added pack that left the list before brings back its discount, FRP and MRP (and distributor terms, in keep) unless typed. POST /lists/links: a move after the carry-over is refused while an open revision holds the row and tells the other person. Preview also answers groups[].allow (the products a row may be picked to) and noDesc (products with no description).

After the third check (20 Oct 2026): revision rows store packAt (the pack each price was typed for); POST /lists/revise checks wasPack again with the rows locked; an added row's keep holds back [fields that came back] and terms. State: closedAtCarry [{id, list, reason, back, items}]; listOld packId only when the row fits its pack. Distributor rows moved after the carry-over carry prevPack in data_json (the pack the previous price was for). Notices write prices in words (price, NSV, discount %, FRP, MRP, Punjab, Sindh, Sindh credit).

After the fourth check (20 Oct 2026): POST /lists/revise refuses (409) a price that adds a pack when a row was moved onto that pack at the same moment (checked with the rows locked); a pack brought back takes the prices of the row that left last, never one with left.dup. POST /lists/links writes several notices when the moves do not fit 1 ("part 1 of 2"). State: listOld[].left may carry ts and dup. After the fifth check: an added distributor row's keep may hold prev (the price distributors last saw), written as the row's prev on approval; issuing a distributor list sets keep.prev of added packs in an approved revision waiting for its date to the price printed.

## 5.14 Roles (next version; owner: Tahir; D-89, D-90)

Every route that was guarded by role names is now guarded by 1 action key (for example POST /prices/propose needs price.propose). A role that lacks the action gets 403 "Your role cannot do this in C2M." The administrator role holds every action.

| Route | Needs | Does |
|---|---|---|
| GET /api/c2m/roles | roles.manage | {ready, catalogue, roles[{key, label, admin, builtin, actions, holders}]}; ready is false until migration 002 is run |
| POST /api/c2m/roles | roles.manage | create {label, actions[]}; the key is made from the name; 400 on a name already used, an unknown action, or roles.manage; 409 before migration 002 |
| POST /api/c2m/roles/:key | roles.manage | edit {label, actions[]}; 400 for the administrator role |
| POST /api/c2m/roles/:key/delete (DELETE on the same path also works) | roles.manage | delete; 400 while a person holds the role, and for the administrator role |

Changed replies: GET /me and state.me add admin (true for the administrator role) and actions (the keys the role holds); nav and more now follow from the actions. state.people adds roleLabel and grantee (true when the role may print granted lists). Approving a price, list revision, settings request or target request: the administrator may approve his own; anyone else must not be the proposer and the proposer must hold an administrator role, else 403 "You approve only what an administrator proposed (D-89)." Recipe steps check recipe.step.draft, review, endorse or cost.

## 5.15 Add client, add product, variants, follows (piece 3; owner: Tahir; D-94, D-95, D-98)

All answer 400 with "This needs migration 003" until migration 003 is run. Body numbers are digits; names cannot hold the sign |.

| Route | Action needed | Body | What it does |
|---|---|---|---|
| POST /api/c2m/clients | client.add | name, kind (VAN brand, White label, Both), o2sNames (text), segment (not for White label) | Adds a client. Refused when the name or an O2S spelling is already a name of another client. Returns id |
| POST /api/c2m/clients/:id/products | client.add | brand, o2sNames, typeId, form, soldPer (liquid is L, solid is kg), packingMode (VAN, client, bulk), followsId, pvariantId or family and variant, packs [size, billId, clientOnly] | Adds a white label product with its packs. A follower takes its family and variant from the product it follows unless given. Refused for the VAN brand owner, a duplicate name and pack of the same client, a followed product that is not an active VAN brand product, a form different from the followed one. Packs: 0.001 or more, at most 3 decimals, no pack twice; a bulk product keeps no bill. Group recomputed |
| POST /api/c2m/products/:id/packs | client.add | size, billId, clientOnly | Adds 1 pack to a white label product |
| POST /api/c2m/products/:id/variant | variant.add | family or familyId, variant or pvariantId, or clear true | Tags a product with its variant (new family or variant created by name); runs the cost check and a notice, as a rate change does; moves no recipe |
| POST /api/c2m/variants | variant.add | fromProductId, variant, mainVariant (when the main product has none), brand, o2sNames, typeId, packs | New VAN brand product as a variant; its recipe is a copy of the main product's approved recipe (else latest) as a draft version 1 |
| POST /api/c2m/products/:id/follow | client.add | followsId or null | Sets or clears the followed VAN product; cost check and notice |
| POST /api/c2m/products/:id/approve-cost | recipe.step.cost | none | The CFO step for a follower: every pack must be fully costed; writes a cost version for each pack whose cost moved; locks the product row, so a double press writes once |
| POST /api/c2m/rules/conversion | labour.manage | scope variant with pvariantId | A rate for 1 variant |

Changed: recipes/new refuses a follower; recipes/:id/advance writes cost versions (and a change record row) for the fully costed packs of followers when a followed recipe is approved; names/product/:id/use refuses taking a followed product out of use; GET /state adds variantsReady, families, and on each product familyId, pvariantId, followsId, followsBrand, and on each pack clientOnly; rules carry scopePvariantId.

## 5.16 Price list documents and whole rupee prices (22 Oct 2026; owner: Tahir; D-101 to D-107)

- POST /api/c2m/prices/propose: a price with paise is refused (400) before the pack is read: "A client price is a whole rupee. Type 257 (the next whole rupee) or another whole number."
- GET /api/c2m/pricedocs/:id/pdf and the list preview: the white label list has a field ppack (Price per pack, Rs ex FED); the farmer and website lists have a field pack; every list prints 1 signature (Issued by Yawar Hussain). State wlLists rows now carry size (kg or L), famName and pack in C2M's form (500 ml). Documents issued earlier reprint from their saved fields: without Pack size the pack stays in the product name; the title month is the issue month; the Approved by line is gone.

## 5.17 Name on price lists (22 Oct 2026; owner: Tahir; D-109)

- POST /api/c2m/customers/:id takes printName (text, up to 160, empty clears; right customer.edit). With migration 004 not run it answers 409 and saves nothing. GET /api/c2m/state: customers[].printName and printNameReady. The white label list and its document print printName, else the C2M name; the issued document stores the name it printed.

### 5.18 Rename a client (D-110)
`POST /api/c2m/customers/:id` now also takes `name` (text, 1 to 100 characters). Needs Change customer details. The whole save (name, print name, price rule, cycle, region, O2S names) is one transaction on a row read under lock, so a failed check never leaves a half save. The name is set, KAM grants (`c2m_list_grant`, kind client) and `fields_json.client` of white label documents move to the new name, and one audit row (`customer`, `name`) records old, new and the counts moved. Errors 400: empty, not text, too long, or a clash with another client's name or O2S names. Sending the unchanged name does nothing.

### 5.19 Corrections and fixes (23 Oct 2026; D-114, D-116)
- `POST /api/c2m/targets/request` now refuses a blank, non-numeric, negative or 100+ `toGp` with 400 ("Type the new target GP, a number from 0 to 99.9."). Before, a blank was saved as 0.
- `POST /api/c2m/prices/:id/approve`: when the price in force started on the same day as the new one, it is set to replaced and its end date equals its start date (before: end date 1 day before its start).
- `POST /api/c2m/products/:id/edit` {brand, o2sNames, why?}: white label only; right client.add. Refuses a blank name, no change, or a name and pack size that another product of the client already uses. Audit entry client_product edit.
- `POST /api/c2m/products/:id/inuse` {on}: white label only; right client.add. Taking out of use is refused while a price for it waits for Tahir.
- `POST /api/c2m/packs/:id/remove`: white label only; right client.add. Refused if the pack has an approved cost, any price, an open re-approval, or is the product's only pack.
- GET /state adds `outOfUse` [{id, brand, customer}] (white label products out of use).
- The "backoffice" place is gone from `more` (c2m-access.js navFor); a stale link to it opens Setup.
- `POST /api/c2m/prices/:id/retract` (right price.propose): the proposer, or the administrator, takes back a price that waits (status proposed becomes withdrawn). `POST /api/c2m/targets/:id/retract` (right targets.propose): same for an open target request (becomes withdrawn).
- `POST /api/c2m/targets/request` toGp must match 1 or 2 digits with at most 1 decimal, be above 0, and differ from the product's current target.
- `POST /api/c2m/products/:id/inuse` with on:true is refused when another active product of the client uses one of its names and one of its pack sizes.
