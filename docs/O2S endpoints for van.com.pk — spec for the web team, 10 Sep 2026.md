# O2S endpoints for van.com.pk

**For VAN's web team. 10 September 2026.**

The website's batch verification and QC report download are built and finished. They are switched
off, waiting on three endpoints. When those answer, one flag turns the whole thing on and no
front-end code changes.

Everything the website asks of O2S is in one file: **`src/lib/o2s.ts`**. Read that file first; this
document is the same contract written out for whoever writes the server side.

---

## To turn it on

In `src/lib/o2s.ts`:

```ts
export const O2S = {
  enabled: false,          // ← true
  base: '/api/public',     // ← wherever the endpoints live
  timeoutMs: 8000,
}
```

That is the whole switch. Until `enabled` is true, every lookup returns `offline` and the site tells
the reader plainly that the live check is not connected and hands him WhatsApp, exactly as before.
**Nothing on the site ever invents a pass.**

If the endpoints sit on a different origin from van.com.pk, that origin must send
`Access-Control-Allow-Origin: https://van.com.pk` (and for the www host too, if that is used).

---

## 1. Verify a batch

```
GET {base}/batch/{batch}
```

`{batch}` arrives normalised: trimmed, upper-cased, internal spaces removed. `vu 25186` is sent as
`VU25186`. Match on that form.

**200**

```json
{
  "batch":        "VU25186",
  "product_slug": "vital-urea",
  "product_name": "Vital Urea",
  "analysis":     "SCU. N 32% min · S 13% min",
  "pack":         "Bag - 50 kg",
  "made_on":      "2026-06-14",
  "released_on":  "2026-06-19",
  "status":       "released",
  "certificate_url": "https://o2s.van.com.pk/api/public/batch/VU25186/certificate.pdf"
}
```

**404** — an empty body. The number is not in O2S. The page treats this as "not in VAN's records"
and shows the farmer the report-a-bag route.

| Field | Rule |
|---|---|
| `product_slug` | **Must match a slug in the site's own catalogue.** The page compares it with the product the farmer picked. The full list is in `src/data/catalogue.ts`; a mismatch is answered differently from a miss, so a wrong slug here would produce a wrong warning. |
| `analysis` | The registered analysis, as printed on the bag. Display string, not parsed. |
| `made_on`, `released_on` | ISO `YYYY-MM-DD`. `released_on` is `null` unless the batch is released. |
| `status` | `released` · `held` · `withdrawn`. Only `released` is a pass. |
| `certificate_url` | Absolute URL to the PDF. If omitted, the page falls back to `{base}/batch/{batch}/certificate.pdf`. |

---

## 2. The QC report

```
GET {base}/batch/{batch}/certificate.pdf   →   200 application/pdf
```

Open to anyone holding the batch number. No sign-in, no phone number, no form. Tahir's ruling: the
number is printed on the bag, so having it already means having the bag, and anything more stops
most farmers.

**One requirement on O2S, and it is not optional.** Every copy that leaves must be stamped with its
batch number and the date it was downloaded, so a report cannot be passed off as another batch's.
A browser cannot stamp a PDF it did not generate, so the server does it — a footer line on every
page is enough:

```
VAN Lab · Batch VU25186 · downloaded 10 September 2026 · van.com.pk · LAB 336
```

The site already tells the reader the file carries this. That sentence goes live with `enabled`, so
please do not turn the flag on before the stamp is in.

---

## 3. Where is my sample

The other half of the Lab page, and a different question: not "is this bag real" but "where has the
sample I posted got to". Same adapter, same rules.

```
GET {base}/sample/{ref}
```

**200**

```json
{
  "ref":         "S-2026-0418",
  "received_at": "2026-09-02",
  "stage":       "analysts",
  "updated_at":  "2026-09-05",
  "tests":       ["Moisture", "Total nitrogen", "Sulfur"]
}
```

`stage` is one of the **seven steps the blind-chain diagram on the Lab page already draws**, so the
diagram and the tracker cannot drift apart:

`parcel` · `reception` · `coded` · `split` · `analysts` · `compared` · `released`

**404** — an empty body.

---

## Two rules that hold on every response

**1. No customer detail. Ever.**

Not a name, not a district, not a dealer, not a phone number, not an order number, not a company.
Anyone in the world can call these with a number read off a bag.

This is not a general privacy preference, it is the specific argument the VAN Lab page is built on:
the laboratory never knew whose sample it was, which is why nobody there could have gone easy on a
VAN bag. An endpoint that leaks who bought a batch would undo that argument from the outside, and it
would do it quietly.

**2. Only released batches read as released.**

A batch on hold or withdrawn must say so in `status`. It must not be absent, and it must not read
`released`. A farmer standing in a field with a withdrawn batch is the single most important person
this endpoint will ever answer.

---

## How to test it before it goes live

With `enabled` still false the site shows three worked examples on `/verify` — a batch that passes,
a batch number that belongs to a different product, and a number that is not in the records —
labelled as examples so nobody mistakes one for a live check. Those are exactly the three screens
your responses will drive. Point `base` at a staging endpoint, set `enabled` to true in a local
build, and the same screens fill with real records.

Four things worth testing against a real O2S:

1. A released batch, with the right product picked. Expect the pass screen and a working PDF.
2. The same batch with the **wrong** product picked. Expect the gold warning, not a pass.
3. A number that does not exist. Expect the rust "not in VAN's records" screen.
4. The endpoint switched off mid-request. Expect "the live check is not connected yet", never a
   fail — a reader must never be told his real bag is fake because a server was down.

---

## Contact

Front end: whatever question comes up, the answer is in `src/lib/o2s.ts` — it is the only file that
talks to O2S, and it is commented for exactly this handover.
