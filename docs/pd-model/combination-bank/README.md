# Combination Bank — design folder

_Created 18 August 2026. **Design only. Nothing here is built.**_

| File | What it is |
|---|---|
| `RULES.md` | **Start here.** The agreed rules, in words, not code. If code and this file disagree, this file wins until Tahir signs a change. |
| `combination-bank-demo-v6.html` | A standalone visual demo of the agreed behaviour. Double-click it — it opens in any browser, needs no server, saves nothing, and is wired to nothing. Dummy data throughout, except the 51 raw materials, which are read verbatim from the app's own master. |

## What the demo shows

Eight tabs. The ones worth opening first:

- **Add one** — the entry form with material lines. Set humate to 5% and filler to
  23% and the duplicate check blocks the save; change the MAP grade and it stops
  blocking. That contrast is the whole design in ten seconds.
- **Duplicate rules** — the four bands and every guard against a false accusation.
- **Material register** — 91 grades. Blue rows are VAN's real 51; amber rows are
  invented for the demo and must be confirmed or dropped.
- **Moderator queue** — what a moderator sees, and what each verdict does.

## What it is not

It is not a prototype of the app, not connected to PD, and not a starting point for
code. It is a picture, kept so that a future session does not have to re-derive
decisions that were already made carefully.

Read `RULES.md` §10 before treating any data in it as real, and §11 before building
anything.
