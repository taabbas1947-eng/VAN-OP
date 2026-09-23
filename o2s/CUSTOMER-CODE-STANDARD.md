# Customer code standard — O2S

*Ruled by Tahir Abbas, 23 September 2026. Written against `o2s.html` as it stands
that day; every claim below was read from the code, not assumed.*

---

## The rule

```
{SEG}-{ABBR3}-{YY}-{NNN}
```

| Part | Meaning | Example |
|---|---|---|
| `SEG` | segment — `WL` · `DLR` · `DST` · `FRM` · `VG` · `COBO` | `DLR` |
| `ABBR3` | first three letters of the name, A–Z only | `GHF` |
| `YY` | year inducted, two digits | `26` |
| `NNN` | sequence, zero-padded to three, from a counter that only increases | `003` |

`DLR-GHF-26-003`. One shape for every segment.

### The two principles behind it

**1. Nothing mutable goes in a code.** A code is an identity. Anything inside it
that can change will one day be wrong, and by then unfixable. This is why region
and city come out of dealer codes — a dealer who moves city would otherwise carry
a permanently false code. Region and city stay as columns on the record, where
they can be corrected.

**2. A change of segment is a new record, not an edit.** BKK is the worked
example: a distributor now moving into white label in parallel. That is two
relationships with one company, so two records and two codes —
`DST-BKK-26-100` and `WL-BKK-26-108`, both correct, neither a duplicate.

**The code names the relationship. It does not name the company.**

### What is NOT in the rule

**NTN stays optional** — ruled 23 Sept. The field exists on the customer record
and can carry the company's tax number, which would link BKK's two records
automatically. Tahir chose not to enforce it. Consequence, recorded so nobody is
surprised later: rolling one company up across segments stays a manual job.

---

## The safety constraint — read this before changing any code

Customers have no identity independent of their code. A new record saves as:

```js
var rec = { id: code, code: code, name: ..., segment: ... };
```

`id` **is** the code. So changing a code is changing an identity. Whether that is
safe depends entirely on the segment, because the two are matched differently:

```js
// Dealer — matched BY CODE, and the code is stored inside the order
if (entryChannel === 'Dealer') {
  var code = ((entryClient||'').split('|')[0]||'').trim();
  return cs.filter(c => c.code === code)[0];
}
// Every other segment — matched BY NAME
return cs.filter(c => c.segment === seg && !c.isParent && c.name === entryClient)[0];
```

| Segment | Matched by | Order stores | Code safe to change? |
|---|---|---|---|
| Dealer | **code** | `DLR-PB-JHN-001\|Kissan Zarai Merkaz` | **NO — never** |
| White-label | name | the name | yes |
| Distributor | name | the name | yes |
| Direct Farmer | name | the name | yes |
| VGreen / COBO | outlet / segment | — | yes |

**A dealer's code is baked into every order raised against him.** Change it and
those orders point at a customer that no longer exists. `clientHasPrintHistory()`
compares the same composite string, so the dealer's own price history breaks too.

Conversely: a **name** change breaks the other four segments, for the same reason
in reverse. Neither the code nor the name is safe everywhere, which is the real
argument for giving customers a proper id one day.

---

## What changes, and what does not

### Ruled 23 Sept

| | Ruling |
|---|---|
| **Existing codes** | **Left alone.** 31 of 32 stay exactly as they are, odd shapes included. |
| **Excel Chemical** | **Fixed** — the one plainly wrong record. See below. |
| **New customers** | Follow the rule above. |
| **Dealer codes** | Region and city drop out **for new dealers only.** Existing dealer codes are never touched — see the constraint above. |

### The Excel Chemical fix

`WL-EXC-26-109` sits in the **Distributor** segment with a **White-label** code.

**Why it happened** — editing a customer keeps the original code:

```js
var code = f.editing || custCode(f.segment, f.name, f.inducted, ...);
```

It was created as the tenth White-label (`100 + 9` = 109) and later edited into
Distributor. The code is generated once at creation and never re-derived. This is
what the code does by design, not a data-entry slip — so it will happen again to
the next customer who changes segment, unless the behaviour changes.

**Why it is safe to fix** — Excel Chemical is a Distributor, matched by name.
No order stores its code. Verify that once against live data before the change,
then re-code it to `DST-EXC-26-1NN` with the next distributor sequence.

**The deeper fix** — when a segment changes on an existing record, either issue a
new code, or refuse the change and require a new record (which is what principle
2 says should happen anyway). Leaving it silent is what produced this.

---

## Three defects in `custCode()` to fix while the rule is implemented

### 1. The sequence is a row count, not a counter

```js
'WL-' + _custAbbr3(name) + '-' + _custYY(inducted) + '-' + (100 + cs.filter(c => c.segment === 'White-label').length)
```

The number is *how many exist now*, not *how many have ever existed*. So if a row
is ever removed, the next customer added reuses a retired code — and because the
code is the identity, that silently merges two different customers in any history
that referenced the old one.

There is a guard against the same-instant case:

```js
if (!f.editing && (state.customers||[]).some(c => c.code === code)) {
  toast('Code ' + code + ' already exists'); return;
}
```

It refuses rather than overwrites, which is right — but it leaves the second
person blocked with no code rather than giving them the next one.

**Fix:** a stored monotonic counter per segment, never a row count. Never reused,
even after a deletion.

### 2. The count includes parent rows

`cs.filter(c => c.segment === 'White-label').length` does not exclude
`isParent` records, so a segment with a parent row is off by one against its own
visible list.

### 3. `custBrandKeyFor('Distributor')` returns the literal `'BKK'`

```js
function custBrandKeyFor(seg){
  if (seg === 'White-label') return '';
  if (seg === 'COBO')        return 'VITAL AGRI NUTRIENTS (PVT) LTD';
  if (seg === 'Distributor') return 'BKK';
  return 'Vgreen';
}
```

Every distributor is stamped with brandKey `BKK`. Correct when BKK was the only
distributor; wrong now that Kashmir Sugar Mills and Excel Chemical exist. Unrelated
to codes, found in the same function, recorded so it is not lost.

---

## Tests to write before any of this ships

1. A new customer in each of the six segments produces a code matching
   `^(WL|DLR|DST|FRM|VG|COBO)-[A-Z]{3}-\d{2}-\d{3}$` — VGreen and COBO outlets
   excepted if they keep their short forms.
2. The sequence never reuses a number after a record is removed.
3. Two adds in the same tick produce two different codes, not one refusal.
4. Changing a customer's segment does **not** silently keep the old prefix.
5. No existing dealer code changes, and every order's `client` string still
   resolves to a customer.
6. Excel Chemical resolves to the same orders before and after its re-code.
