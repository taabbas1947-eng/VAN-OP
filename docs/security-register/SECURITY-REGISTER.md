# VAN Operations Platform — Security Register

**Owner: the security / IT department. Not the PD or O2S application work.**

This file exists so that security defects found while building the application
are **written down and handed over**, instead of stopping application work or
being forgotten. Nothing in this register is a gate on a PD or O2S release.

- Application work (features, correctness, usability) is Tahir's.
- Everything in this file belongs to the security department.
- Findings are added here as they are discovered. Nothing is removed — items are
  marked **CLOSED** with a date and who closed them, so the history survives.

**System:** VAN Operations Platform · `van-control-tower.onrender.com`
**Repository:** `github.com/taabbas1947-eng/VAN-OP`
**Hosting:** Render (web service) · MySQL on HostGator

---

## Open items

### S-01 · Any logged-in account can read and destroy the entire O2S dataset
**Severity: critical · Confirmed live, not theoretical · Raised 2026-08-16**

`GET /api/state` and `POST /api/state` require only that a request carries a
valid session. They do **not** check that the account has any O2S role — or any
role at all.

**How it was confirmed.** An account holding **no O2S role and no PD role**
signed in normally, called `GET /api/state`, and received the complete O2S
dataset — every order, customer, batch and shipment. The same account then
called `POST /api/state` and the server accepted the write, returning `{"rev":1}`.

**What it allows.** Any person who can log in, at any privilege level, can read
all commercial data and overwrite the entire operational dataset in a single
request. There is no per-record protection to fall back on, because O2S stores
everything as one JSON document.

**Direction of fix (for the department to evaluate, not a prescription):** the
same module/role check already applied to the `/api/pd/*` routes needs applying
to `/api/state`. PD's surface-gating pattern is the working reference.

---

### S-02 · Seeded accounts still hold the default password
**Severity: critical · Raised 2026-08-16**

Accounts created by the seeding routine were issued the password `van@2026`,
including the **`admin`** account. As far as is known these have not been
changed, and the site is on a public URL.

**What it allows.** Anyone who learns or guesses the default gets an account —
and via `admin`, control of the platform's user and role administration.

**Note.** A login throttle now exists (shipped 2026-08-16), so this is not
brute-forceable at speed. It does nothing about a *known* default.

---

### S-03 · `SESSION_SECRET` not confirmed set
**Severity: high, pending verification · Raised 2026-08-16**

It has not been verified whether `SESSION_SECRET` is set to a strong random
value in the Render environment. If it is unset or left at a default, session
tokens may be forgeable, which would let an attacker impersonate any user
without a password at all — including `admin`.

**This one is a five-minute check** in Render → Environment. It is listed as a
finding only because it is unverified, not because it is known to be wrong.

---

### S-04 · Library uploads may be writing to temporary storage
**Severity: medium — data loss, not a breach · Raised 2026-08-16**

`render.yaml` requests a 1 GB persistent disk at `/var/data` and points
`PD_LIBRARY_DIR` at it. Render only acts on that file if the service is managed
as a Blueprint. If the plan was changed by hand in the dashboard instead, the
disk was never attached.

**Why it is silent.** The upload code calls `mkdirSync(..., {recursive:true})`,
so with no disk present it will happily create the directory on the container's
**temporary** filesystem. Uploads succeed, appear correct, and then **vanish on
the next deploy or restart.** No error is raised, nothing is logged.

**Check:** Render → Settings → Disks should list a disk named `pd-library`.
If that list is empty, this is live.

---

## S-05 · The money screen is gated; the money dataset is not · MODULE: O2S

**Raised:** 23 September 2026, while wiring the Reports screen open to every role.

**What it is.** `Sales & Budget` (screen `budget`) is deliberately narrow —
`owners:['CFO','Plant Manager','Finance']` — so PKR figures are restricted. But
the Report Builder on the **Reports** screen carries a dataset called
`finance: 'Finance · sales & invoicing'` whose fields include
`price` (PKR/Kg) and `value` (Sale value PKR), and `RB_DATASETS` has **no role
gating at all**: `rbSetDS()` and `rbDef()` take whatever the dropdown offers.

So any role that can open Reports can read invoice prices and sale values by
picking one item from a list. The intent expressed by gating `budget` is not
carried through.

**Not introduced by the Reports ruling.** Thirteen of the fourteen roles —
including QA Inspector, Lab Rep, AQCM, QCM and Production — were already owners
of `reports` before 23 September. The ruling added `Finance Desk Officer`, a
Finance role that would legitimately see prices anyway. The gap is older than
the ruling; the ruling is only how it was found.

**Not a customer-facing leak.** The standing rule that no price may appear on an
outgoing document is untouched — this is an internal screen. It is a question of
who inside the plant sees commercial terms.

**The fix, when the COO wants it,** is one gate in the dataset list rather than a
redesign: filter the dropdown in `rbRender()` by role, or give `RB_DATASETS`
entries an optional `owners:[…]` the way `SCREENS` already has. Left for him to
rule on — he may well be content that his managers see prices.

---

## Closed items

_None yet._

---

## Log

| Date | Change |
|---|---|
| 2026-08-16 | Register created. S-01 to S-04 raised from the PD audit. |
| 2026-09-23 | S-05 raised from O2S: the Report Builder's finance dataset is not role-gated. |
