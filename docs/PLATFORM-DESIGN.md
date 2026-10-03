# VAN Systems platform · people and access design

Draft for Tahir's rulings, 27 September 2026. Nothing here is built yet.
Tahir's brief: build the access panel and backend so they carry future apps,
even if VAN Systems grows into an ERP. Do not rush; test before deploying.
Standing condition: nothing built may leave any O2S account unable to work.

## 1. The layers

| Layer | What it answers | Where it lives | Status |
|---|---|---|---|
| **Person** | Who is this human? Name, title, department, company, WhatsApp, email, joined, left | `platform_people` (new) | proposed |
| **Account** | Can this person sign in? Username, password, switched on or off | `auth_users` (existing) | exists; not restructured |
| **App** | Which systems exist, who may enter each, and each app's role list | each app registers itself in code | partly exists (`MODULE_LIST`, `roleCatalogue()`) |
| **Grant** | Which role does this person hold in this app? | `user_module_roles` (existing) | exists; 1 role per app |
| **Permission** | What may that role do? | inside each app | exists; each app its own |
| **Access log** | Who changed what, when, from what to what | `platform_access_log` (new) | proposed |

### Why a person is separate from an account
An ERP knows people who never sign in: factory workers who get policies on
paper (Nigehbaan), drivers, Board members, leavers. If a person only exists as
a login, none of them can be recorded. So:

- `platform_people` holds the human. `person_id` never changes.
- `auth_users` stays the login, exactly as today. A person links to at most 1
  account, through `auth_users.id` (already present, never changes, and
  already used by 36 PD foreign keys).
- Nothing is added to or removed from `auth_users`. O2S reads it untouched.

### Why an access log
Compliance (Nigehbaan, ISO, audits) will ask "who gave this person that
access, and when?" Today nobody can answer. The log is append-only: every
create, detail change, switch-off, password reset and role grant writes 1 row.
Nothing ever edits or deletes a row.

## 2. Rules every app follows (the contract)

1. Sign in with the platform login. No app keeps users or passwords.
2. Register itself in code: key, name, whether it is live, who may enter
   (role holders only, or every active account), and a function returning its
   role list: `{ key, name, department, archived }`. Keys never change and are
   never reused; names may change; roles are archived, never deleted.
3. Read the signed-in person's role from `/api/me`, then apply its own
   permissions.
4. Never write `user_module_roles`, `auth_users` or `platform_people`.
5. For messages and escalation, call the platform's server-side services:
   `holdersOf(app, role)` and `contactsFor(usernames)`. Contacts never reach a
   browser except the platform administrator's.

## 3. Room left for later (designed for, not built)

- **Companies.** VAN and VGreen are separate companies. A grant could later
  carry a company, so one person holds different roles in each.
- **Org chart.** Departments and positions owned by the platform, fed from HR.
  Nigehbaan's 17 "roles" are really positions; O2S and PD roles are
  permissions. Keeping those 2 ideas apart is what lets both grow.
- **HR as the source of people.** HRMS (today a separate Django app with its
  own login) could later feed `platform_people`, so a new joiner appears once.
- **Apps outside this server.** A key per app for server-to-server calls.
- **More than 1 role per app.** Ruled out today (30 July, 26 Sept); the grant
  table can be widened later without touching O2S.

## 4. Phase 1: what gets built first

- Migration `MIGRATION-001` (local first, production by hand): creates
  `platform_people` and `platform_access_log`, and fills 1 person per existing
  account from `auth_users`. Read-only check queries before and after.
- Server: login and every request refuse a switched-off account (only an
  explicit switch-off; nobody else is affected); routes to edit a person,
  reset a password, switch off and on, all written to the log; the "who holds
  what" view; `holdersOf` and `contactsFor` ready for apps.
- Launcher "People and access": people list with search, details, contacts,
  switch off and on, reset password, 1 role column per app, and a "Who holds
  what" view showing vacant roles.
- Not in phase 1: renaming a username (stays in O2S until the O2S session),
  any O2S screen change, Nigehbaan joining, companies, org chart.

## 5. Testing before anything is deployed

1. **Automated, on a throwaway copy.** A real MariaDB loaded with the schema
   and accounts from `van_platform.sql`, the server booted against it, and a
   test suite that proves: every existing account's grants are unchanged; O2S
   endpoints answer exactly as before; a switched-off account is refused and
   switched back on works; the last administrator and last COO cannot be
   switched off; every change writes 1 log row; the migration can run twice
   safely.
2. **Local, on Tahir's XAMPP.** Tahir applies the migration and restarts. A
   read-only check script confirms every O2S account is still switched on and
   holds the same role. Tahir signs in as himself, 1 O2S user and 1 PD user.
3. **Production, only when Tahir chooses.** STATE check first, migration by
   hand (schema-qualified), then push. The same read-only check afterwards.

## Tahir's rulings, 27 September 2026

1. A person is separate from a login: `platform_people`, linked to at most 1
   login. The login table is not touched.
2. An access log from day 1, append-only.
3. Companies: a company field for information now; grants stay company-wide
   until an app needs 2 companies.
4. Testing: all 3 gates (automated on a throwaway copy, local XAMPP, then
   production when Tahir chooses).

## Status

Phase 1 built 27 September 2026 and passed gate 1. See
`docs/ACCESS-MODEL.md`, section "People and access, phase 1".
Gates 2 and 3 are Tahir's.
