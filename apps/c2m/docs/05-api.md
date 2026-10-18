# 5. API documentation

Version 1.3 · 18 Oct 2026 · Owner: Tahir (C2M module owner); Claude records · Rule: R-5h item 5 (D-20)
Changed in 0.8.0: nav lists per role (state.me.nav too); 2 error texts name the new places (a packing price is changed on Inputs, Packing items; a VAN pack is priced in Prices, VAN brand lists). No route added or removed; no reply shape changed (D-45 to D-52).
Changed in 0.7.0: state sales rows carry the buyer, the O2S channel and region for VAN brand sales; propose refused for a VAN brand pack (D-44).
Changed in 0.6.0: re-approval approve replies {ok, approved, left}; state carries costGaps on a pack that is not costed; recipe advance to approved is refused while a pack is not fully costed; propose is refused for a pack of an inactive product, and for any pack that is not costed, including one whose recipe is not in C2M yet; a labour or FOH rate must be above 0; issuing a distributor list sets each row's previous price to the printed price; re-approval items can carry {from: null, pct: null, first: true} for a pack's first approved cost.
Changed in 0.4.0 and 0.5.0: mount needs the platform pool; 503 when dates do not come back as text; prepared statements; 2 withdraw routes; validFrom (Takes effect from) on propose; approve replies carry waitsUntil (and cancelled for prices); a list revision is refused while an approved one waits; 1 open target request per product; pull lock frees after 10 minutes; examples use made-up figures.
Changed in 0.3.0 and 0.3.1: stale single-product conversion row removed; 1 table for all routes; new routes for product type, reprocessed flag, material class, VAN list revisions, re-approval close and the logo; packIds on re-approval approve; validFrom and validTo on price propose; confirmed and the reply {reapproval, kind} on import correct; 1 errors section with every 409 route.

Code: `apps/c2m/c2m-routes.js`. Style: close to OpenAPI (method, path, who, body, reply, errors). Rule references: see 06 and the Design Record.

## 5.1 Mount, sign in, format, versions, limits
- Mount: the platform mounts C2M with 1 line, `require('./apps/c2m/c2m-routes')(app, { pdq, pool, auth, path, fs, crypto })`. pool (the platform's mysql2 promise pool), pdq and auth are required: c2m-routes refuses to start without them, because transactions and the 409 guards depend on the pool.
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
| GET | /api/c2m/me | all roles | | {user, name, role, label, nav}. nav (0.8.0): cfo and coo [today, margin, products, prices, inputs, setup, guide]; production and plant [today, recipes, guide]; qc [today, recipes, inputs, guide]; viewer [lists, guide]. Screens only: rights are checked on each route (D-45) | R-2 | |
| GET | /api/c2m/state | all roles; filtered by role (see 11) | | everything the person's screens need; a pack that is not costed has cost null and costGaps (what is missing, D-40) | R-2, D-14, D-40 | |
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
| POST | /api/c2m/reapprovals/:id/approve | cfo | {} for all, or {packIds:[...]} for the ticked packs only (an empty list is refused) | {ok, approved: packs given a new cost, left: [packs kept on their approved cost, with why]}; approves today's cost; if a cost moved since the item was shown, the change record says "cost moved since shown"; a pack now within reapprove_pct of its approved cost, or not fully costed, is left (D-41) | R-2 Cost, R-5i 6, D-41 | yes |
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
| POST | /api/c2m/prices/propose | cfo | {packId, price, reason, belowReason (needed below target), validFrom? (Takes effect from; default today), validTo? (valid till: the last day the price applies; the effective date or later), replaceId? (a sent-back proposal)} | {id}; refused if the pack already has a price waiting for Tahir, its product is inactive, the pack is not costed (D-40), or it is a VAN brand pack (priced through list revisions, D-44) | D-06, D-22, D-34 | yes |
| POST | /api/c2m/prices/:id/approve | coo | | {ok, waitsUntil, cancelled}. Starts on the later of its effective date and today. waitsUntil = the date when it is dated ahead, else null; today's price stays in force until then. cancelled = how many older waiting prices for the pack it replaced (audit "cancelled") | D-22, D-34, R-5i 3 | yes |
| POST | /api/c2m/prices/:id/withdraw | coo | {why} | {ok, issuedDocs}; only an approved price still waiting for its date; the price it shortened gets its old end back; issuedDocs lists price lists already issued with it; Yawar gets a notice (audit "withdrawn", "end restored") | D-34 | yes |
| POST | /api/c2m/prices/:id/sendback | coo | {reason} | {ok}; 400 "Nothing to send back" if no longer proposed | D-09 | |
| POST | /api/c2m/settings | cfo | {changes:{key: value}} | {applied, pending} | D-18 | |
| POST | /api/c2m/settings/requests/:id/approve | coo | | {ok} | D-18 | yes |
| POST | /api/c2m/settings/requests/:id/refuse | coo | | {ok} | D-18 | yes |
| POST | /api/c2m/targets/request | cfo | {clientProductId, toGp (0 to below 100), reason} | {id}; refused if the product already has a target request waiting for Tahir | D-06 | |
| POST | /api/c2m/targets/:id/approve | coo | | {ok} | D-06 | yes |
| POST | /api/c2m/targets/:id/refuse | coo | | {ok} | D-06 | yes |
| POST | /api/c2m/import/:id/accept | cfo | | {ok, reapproval: 0, kind} | D-07 | yes |
| POST | /api/c2m/import/:id/correct | cfo | {value, why, confirmed? (for a rate move over the warning %)} | {ok, reapproval, kind}; a rate item is saved through the rate controls | D-07, D-10 | yes |
| POST | /api/c2m/grants | cfo | {username, kind: list or client, value, on: true or false} | {ok} | R-2 People and rights | |
| POST | /api/c2m/actuals | cfo | {month: YYYY-MM, labour, foh} | {ok} | D-18 | |
| POST | /api/c2m/checks | coo for rate_check; cfo for tie_books | {month, kind, data?} | {ok}; 403 if Yawar tries the rate check | D-18 | |
| POST | /api/c2m/notices/seen | cfo, coo | | {ok} | D-18 | |
| POST | /api/c2m/lists/revise | cfo | {list: dist, dealer or farmer, items:[{id, values:{field: number}}], reason, validFrom, validTill?, replaceId? (a sent-back revision)} | {id, rows}; refused if the list already has a revision waiting for Tahir, or an approved revision waiting for its date | D-28, D-34 | yes |
| POST | /api/c2m/lists/revisions/:id/approve | coo | | {ok, waitsUntil}. Dated today or earlier: list rows, previous prices and list dates change now (waitsUntil null). Dated ahead: waits; C2M applies it on its first load on or after the date | D-28, D-34 | yes |
| POST | /api/c2m/lists/revisions/:id/withdraw | coo | {why} | {ok}; only an approved revision still waiting for its date; the list stays as it is (audit "withdrawn") | D-34 | yes |
| POST | /api/c2m/lists/revisions/:id/sendback | coo | {reason} | {ok} | D-28 | yes |
| POST | /api/c2m/pricedocs | cfo, coo; viewer only for a granted list or client | {audience, client (wl), fields[], eff?, till?, ref?, note?, reasons?} (a viewer cannot set eff, till, note or reasons) | {id, ref} (ref = VAN/PL/year/number). No eff: a client list takes the client's latest approved price date, a VAN list its own list dates. eff ahead: prices in force on that date; a distributor list issued makes each row's printed price its previous price (D-42) | D-14, D-34 | |
| GET | /api/c2m/pricedocs/:id/pdf | cfo, coo; the creator while the grant still stands | | application/pdf, printed from the saved snapshot; footer and "page n of N" on every page | D-14 | |
| GET | /api/c2m/docs/:file | cfo, coo: all 12; production, qc, plant: 01, 07, 11; viewer: 07, 11 | | text/plain (the Markdown file) | D-20 | |

Field rules for list revisions: dist takes now, mrp; dealer takes nsv, disc (a fraction below 1; the page types it as %), frp, mrp; farmer takes pb, sn, snc. On approval C2M works out dist fed = now x 1.05, dealer net = nsv x (1 - disc), netfed = net x 1.05.

## 5.3 Errors

Every error is `{ "error": "plain message" }`. Nothing is saved when an error comes back (writes run in 1 transaction).

| Code | Meaning | Example message | Routes |
|---|---|---|---|
| 400 | Wrong or missing input, or a rule refuses it | "Add the source: PO number or quote." · "A rate starts today or earlier..." · "Tick at least 1 pack, or use \"The rate was wrong\" to close it." · "This pack already has a price waiting for Tahir." · "A revision of this list is approved and waits for (date). Ask Tahir to withdraw it first, or wait until it takes effect." · "Write why the waiting price is withdrawn." | any route with a body |
| 401 | Not signed in (from the platform) | platform message | every /api/c2m route |
| 403 | No C2M role, or the role cannot do this | "You do not have access to C2M. Ask Tahir to grant it in People and access." · "Your role cannot do this in C2M." · "This step is not yours." · "This list is not granted to you." · "Not available to your role." | every /api/c2m route |
| 409 | Someone else changed it a moment ago, or the item is no longer in the state the route needs | "Someone else changed this a moment ago. Check before retrying." For the pull: "A pull is already running. Wait a minute, then look again." | sync; recipes/:id/lines, /advance, /sendback; reapprovals/:id/approve, /dismiss; rules/conversion/:id/retire; prices/propose (replaceId), prices/:id/approve, /withdraw; settings/requests/:id/approve, /refuse; targets/:id/approve, /refuse; import/:id/accept, /correct; lists/revise (replaceId); lists/revisions/:id/approve, /withdraw, /sendback |
| 500 | Unexpected fault | "Something went wrong. Nothing was saved." | any |
| 503 | C2M tables are not installed, or the pool does not return dates as text | "C2M tables are not installed yet. Ask IT to run the C2M migration." · "C2M needs the database pool to return dates as text (mysql2 option dateStrings: true). Ask IT." | any route that reads a c2m_ table; every /api/c2m route for the dates check |

## 5.4 Examples (example figures)

Rate over the warning %:
`POST /api/c2m/rates {"gradeId":12,"rate":450,"source":"PO 1234"}`
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
