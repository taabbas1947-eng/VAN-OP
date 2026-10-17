# 6. Decisions with dates

Version 1.2 · 16 Oct 2026 · Owner: Tahir rules; Claude records · Rule: R-5h item 6 (D-20)
Changed in 0.5.0: band values, budget figures and the split % removed for the public repo (they stay in the Design Record). No decision changed. The 0.5.0 fixes apply D-22, D-28, D-34 and D-37; they add no new decision.
Changed in 0.3.1: header put in the standard form (version, owner, rule). No decision changed. The 0.3.1 fixes apply D-14, D-15, D-23, D-25, D-26, D-27 and D-28; they add no new decision.

The full record with every option and discussion is "E:\Cost and Pricing\Costing System Design Record.md" (sections named R-x below). Status: current unless marked.

| No | Date | Who | Decision | Replaces | Status |
|---|---|---|---|---|---|
| D-01 | 10 Oct 2026 | Tahir | C2M is its own module on the VAN platform; same database and sign-in; roles from the central registry (R-2) | | current |
| D-02 | 10 Oct | Tahir | The platform rule "cost is out" is updated for C2M, not the module rescoped (R-2) | | current (edit pending at go-live) |
| D-03 | 12 Oct | Tahir | Every client product has its own recipe; the base recipe is a pre-fill only (R-5b) | shared recipe | current |
| D-04 | 12 Oct | Tahir | Conversion: Yawar's base bands (Rs per kg, set by Yawar); rules configurable, most specific wins (R-5b, R-5e) | labour hours | current |
| D-05 | 12 Oct | Tahir | Freight Rs per kg by segment x region (R-5b) | dealer and farmer only | current |
| D-06 | 12 Oct | Tahir | Target GP: B2B product default; client override (R-5b); override needs Tahir (R-5f, 14 Oct) | | current |
| D-07 | 12 Oct | Tahir | All 12 weak points corrected at import; Yawar moderates every item (R-4) | | current |
| D-08 | 13 Oct | Tahir | Majid writes, Himayat reviews, Fahim endorses, Yawar approves cost (R-2) | both endorse | current |
| D-09 | 13 Oct | Tahir | Send back with reason and revision advice; resend returns to the sender (R-2, 14 Oct) | | current |
| D-10 | 13 Oct | Tahir | Rates need no approval; C2M warns on a move above 10%, rise or drop (R-2) | COO second check | current |
| D-11 | 13 Oct | Tahir | GP only on the board; drill customer first; 3 severity rankings; red and amber flags; 4 periods (R-5d) | | current |
| D-12 | 13 Oct | Tahir | C2M reads platform apps only; no ERP link (R-5c) | | current |
| D-13 | 14 Oct | Tahir | O2S look for C2M (R-5d) | | current |
| D-14 | 14 Oct | Tahir | Price lists per audience, field picker, formal VAN document; cost and margin never printed (R-5f record) | | current |
| D-15 | 14 Oct | Tahir | Forward exposure ranks problems; locked-in shown beside it (R-5f) | open PO only | current |
| D-16 | 14 Oct | Tahir | Dated cost versions; each truck at the cost on its date (R-5f) | | current |
| D-17 | 14 Oct | Tahir | Contribution floor on price screens; red needs gap above 2 points and Rs impact (R-5f) | | current |
| D-18 | 14 Oct | Tahir | Thresholds need Tahir's approval; monthly second-person rate check; monthly tie to the books (R-5f) | notice only | current |
| D-19 | 15 Oct | Tahir | Packing: separate packing bill per pack size, items priced per piece, secondary packing rules; Yawar approves bills alone (R-5g) | inside recipe | current |
| D-20 | 15 Oct | Tahir | System documentation is mandatory in Back Office, 12 sections, version, owner, rule link (R-5h) | | current |
| D-21 | 15 Oct | Tahir | 1 build with everything; all 6 users at once; read O2S app_state directly; build outside VAN Systems for now (R change log) | | current |
| D-22 | 16 Oct | Tahir | Resend returns to the sender; one-time changes stay ordinary versions; a price starts on its approval date; drift limit 3% of product cost (R-5i 1, 2, 3, 6) | restart at Himayat; end dates; rate date; 2% or 5% | current |
| D-23 | 16 Oct | Tahir | Himayat's Materials screen: class and nutrient % per grade. Non-nutrient inputs (binder, filler, anti-caking, wetting agent, colour, pH) count in weight and cost and add 0 (R-5i 4, 4a) | Yawar enters | current |
| D-24 | 16 Oct | Tahir | Phone layout for lists and approvals (R-5i 5) | desktop only | current |
| D-25 | 16 Oct | Tahir | Conversion = 1 labour + 1 FOH rate, on the base bands; named rates assigned to all products, a form, a product type or a list of products, applied by themselves. Supersedes A-02 (R-5i 7) | Yawar's per-product figures; 1 combined rate; add-ons | current |
| D-26 | 16 Oct | Tahir | Client-packed products keep VAN's inner liner (or seal) as packing. Supersedes A-14 (R-5i 8) | remove; Yawar decides each | current |
| D-27 | 16 Oct | Tahir | Forward exposure: switch between budget kg and run rate (R-5i 9) | 1 basis | current |
| D-28 | 16 Oct | Tahir | VAN brand list revisions: Yawar proposes, Tahir approves or sends back (R-5i 10) | Yawar alone | current |
| D-29 | 16 Oct 2026 | Tahir | Conversion pool: wait for 2 months of actuals before changing the band basis (R-5j 1) | raise bands; unrecovered line; variable-only targets | current |
| D-30 | 16 Oct 2026 | Tahir | Reprocessed (solid reprocessed band): the 5 products Tahir named, set per product with the reprocessed flag (R-5j 2) | production lines; Yawar's list; drop the band | current |
| D-31 | 16 Oct 2026 | Tahir | Red flag: more than red_gap_pts below target AND Rs gap above red_share_pct (1%) of all white label sales in the period. Replaces red_rs (R-5j 3) | a fixed Rs amount (2 levels offered); top 3 | current |
| D-32 | 16 Oct 2026 | Tahir | VAN brand costs uploaded by Yawar once live; company GP waits (R-5j 4) | load before go live; sheet cost | current |
| D-33 | 16 Oct 2026 | Tahir | Stuck flag on Tahir's Today: a recipe more than 2 working days at one step (Sundays off). No messages leave C2M (R-5j 5) | messages; notice only | current |
| D-34 | 16 Oct 2026 | Tahir | Approvals dated ahead wait for their date (prices and VAN list revisions) (R-5j 6) | take over at once | current |
| D-35 | 16 Oct 2026 | Tahir | History: method change shown as its own effect, plus a switch to restate past trucks at the bands (R-5j 7) | one view only | current |
| D-36 | 16 Oct 2026 | Tahir | Contribution floor adds the labour rate (R-5j 8) | materials + packing + freight | current |
| D-37 | 16 Oct 2026 | Tahir | Rate order: any rate Yawar adds beats the base bands; among his rates more conditions first, then newest (R-5j 10) | strictly by conditions; newest first | current |
| D-38 | 16 Oct 2026 | Tahir | Material rates are delivered: freight inwards is taken out of the FOH pool before the band split into labour and FOH (R-5j 11) | keep in FOH | current |
| D-39 | 16 Oct 2026 | Tahir | Traded goods carry a lower repack rate Yawar adds on Traded-Solid; liquids stay per L; KAMs see no margin (replaces 14 Oct); rate check stays with Tahir (R-5j 9, 12, 13, 14) | | current |
