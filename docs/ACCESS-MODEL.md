# VAN Systems · the access model

Ruled by Tahir on 25 September 2026. Built the same day in `server.js`,
`launcher.html` and `apps/pd/pd-lib.js`. (17 Oct 2026: PD was removed, with its `pd_role` mirror column and
PD roles; `LEGACY_COL` now holds O2S only. Read PD below as history; C2L replaces it.) The full proposal with the findings is the
"VAN Systems Access Model" page on claude.ai.

## The rule

**The platform owns identity and who holds which role. Each module owns what
its roles are and what they may do.**

| Layer | Where | Written by |
|---|---|---|
| Identity | `auth_users`: username, name, password, active | Manage access (create), O2S Users & Access (name, password) |
| Membership | `user_module_roles`: person, module, role, is_admin | **Only** `setModuleRole()` / `clearModuleRole()` in server.js |
| Permissions | O2S: rights, access matrix, departments. PD: its gates. | Each module, in its own store |

`auth_users.role` and `auth_users.pd_role` stay as mirrors, written by the same
2 functions, because O2S and PD still read them. They are never written by
anything else.

## What each screen does

- **Manage access (launcher)** grants or changes a role. It draws 1 column per
  module from `GET /api/platform/catalogue`, grouped by that module's own
  departments, with a title beside the name where the module gives one.
- **O2S Users & Access** is unchanged on screen. The routes it calls
  (`/api/users`) now write the platform table too. A rename carries the
  person's rows with them; a delete removes them.
- **O2S Admin → Roles** is still where an O2S role is created. The platform
  reads it from O2S's store (`masters.roles`: name, deptId, builtin, archived).

## Platform administrator

A grant of its own: module `platform`, role `admin`, shown as **System Administrator**. The `admin` gate
and People and access read it.

**Ruled by Tahir, 21 Oct 2026: the System Administrator holds all access power; COO is an ordinary role.**
The O2S COO no longer counts as administrator (the changeover rule ended): not in the `admin` gate, `/api/me`,
the admin capabilities or the launcher. The start-up step that seeded the grant from the O2S COO rows now runs
only when no System Administrator exists at all (a fresh database). Only a System Administrator gives O2S COO,
C2M CFO or COO, and roles made on C2M's Roles screen. Local-file mode (no database, development only) has no
role table, so there the O2S COO stands in. Before this ruling the two live O2S COOs (tahir, ahmer) were checked
to hold the System Administrator grant, so nobody lost access power.

Review of 21 Oct 2026, same day: those roles are also changed and taken away only by a System Administrator. An
app admin may not move someone off O2S COO, C2M CFO or COO, or a C2M custom role (`sysAdminOnlyRole` in server.js;
the screen shows the row locked with the reason). Removing a System Administrator is refused when no other active
System Administrator would remain (the same rule as switching one off). The start-up seed counts grant rows, not
active logins: if every System Administrator is switched off, recovery is by hand in the database.

**What this ruling does not reach (recorded 21 Oct 2026, not built; for Tahir and the app owners):** O2S's own
Authorisation panel still lets the O2S COO set every O2S role's rights, and C2M's Roles screen still lets the C2M COO
widen a built-in role that an app admin may then give. O2S's Users & Access refuses an O2S COO who is not a System
Administrator. A role taken away takes effect in O2S at the person's next sign-in (the token carries the O2S role
for up to 30 days); switching off takes effect at once.

**Ruled by Tahir, 28 Oct 2026 (design agreed, not built):** the System Administrator creates every
role, sets its rights and assigns it, in every app, from one platform screen; COO and CFO become
ordinary roles; app admin will be dropped. Each app keeps its roles and offers a roles service.
Design and open questions: `docs/ROLES-DESIGN.md`. Until it is built, the rules above stand.

## For the next module (QMS, ComPha)

2 things and no more:

1. Publish a role catalogue: add the module to `MODULE_LIST` in server.js with
   `live: true` and give `roleCatalogue()` its roles as
   `{ key, name, title, department, archived }`.
2. Read `GET /api/me` for the person's role in your module, then apply your
   own permissions.

Do not write `user_module_roles` from module code. Do not compare your roles
with another module's: a role belongs to its module (Tahir, 25 Sept: agronomy
is not an O2S job and does not exist in O2S; it exists on the platform because
those people need PD).

## Checking a database

`migrations/RECONCILE-2026-09-25.sql` PART 1 is a read-only report of every
place the 2 stores disagree. Run it on local first, then production.

## Rulings of 26 September 2026

Tahir, 26 Sept. Not built yet; these are PLATFORM Step 1 in
`OP-HANDOFF-PLATFORM.md` unless marked otherwise. Standing condition: nothing
built may leave any O2S account unable to work.

1. **People are managed on the launcher only**: create, rename, reset
   password, deactivate, and every app's role. O2S Users & Access becomes a
   view of O2S people and their O2S role (O2S work, its own session).
2. **Leavers are deactivated, never deleted.** Their name stays on every
   record.
3. **A role renamed in O2S carries through** to everyone who holds it.
4. **Title, WhatsApp number and email live on the platform, per person**,
   edited on the launcher. A title is a label and grants nothing. No app
   keeps its own copy.
5. **1 role per person per app stays.** The platform role is the person's
   job. Extra duties (covering Tax, a committee seat, standing in for
   someone) are assignments the app keeps in its own data, keyed by the
   platform username.
6. **"Who holds role X" is answered to an app's server only**, for that
   app's own roles: username, name, title, active, WhatsApp, email. Users'
   browsers never receive other people's contacts. `/api/platform/users`
   stays admin-only and is not for apps.
7. **Nigehbaan joins inside the VAN-OP server** as a module, like O2S and PD,
   so its server code calls the platform function directly; no key needed.

### For Nigehbaan, in full

- Sign in with the platform login; read the person's Nigehbaan role from
  `GET /api/me`.
- Publish the role catalogue (see "For the next module" above).
- 1 Nigehbaan role per person. Tax cover, committee seats and similar duties
  are Nigehbaan's own tables, keyed by platform username.
- Contacts and titles come from the platform, never stored in Nigehbaan.
- For nudges and the Monday summary, Nigehbaan's server code calls the
  platform's holders function for its own roles (to be built in Step 1).
- Module rules from `CLAUDE.md`: its own folder and route block, registered
  before O2S's catch-all; never writes `user_module_roles`.

## People and access, phase 1 (built 27 September 2026, not pushed)

Design and rulings: `docs/PLATFORM-DESIGN.md`. In short:

| Table | Holds | Written by |
|---|---|---|
| `platform_people` | The human: name, title, department, company, WhatsApp, email. `account_id` links to at most 1 login (`auth_users.id`); NULL = a person with no login | People and access only |
| `auth_users` | The login, unchanged. `name` is kept in step with the person's name because O2S and PD read it. `active = 0` means switched off | People and access (switch off, password); O2S Users & Access until the O2S session |
| `platform_access_log` | 1 row per change: actor, action, subject, app, before, after, via. Triggers refuse UPDATE and DELETE | the platform only, through `logAccess()` |

Created by `migrations/P001_people_and_access_log.sql` (local) and
its `.PRODUCTION.sql` copy. Until P001 is applied, the server behaves exactly
as before; the person's page then says Details, switch off and history need migration P001.

**Switched off.** Only an explicit switch-off on People and access sets
`active = 0`. From then on the login is refused and any open session stops
(checked in `auth()` from a set held in memory, loaded at boot). Roles are
kept, so switching back on restores them. Guards: not yourself, not the last
System Administrator. (The "last O2S COO" guard was dropped on 21 Oct 2026, Tahir: COO is an ordinary role.
O2S's own `/api/users` routes still refuse to demote or delete the last COO; that is O2S's to decide.)

**Logged actions:** `account.create`, `person.update`,
`account.password_reset` (never the password), `account.switch_off`,
`account.switch_on`, `role.grant`, `role.change`, `role.revoke` (from
`setModuleRole()` / `clearModuleRole()`, so O2S's Users & Access is logged
too, marked `via = o2s-users`), `admin.grant`, `admin.revoke`. Logging is
best effort: if the log cannot be written, the change still stands and the
server log says why.

**Services for apps** (server side, `platformServices`): `holdersOf(app,
role)` and `contactsFor(usernames)` return switched-on people with name,
title, WhatsApp and email. A vacant role returns an empty list. Hand
`platformServices` to an app's routes when it is mounted; contacts never go
to a browser except the platform administrator's. O2S alerts
(`apps/o2s/notify-routes.js`, 16 Oct 2026) receive it and use `holdersOf('o2s',
role)` to find who an alert goes to.

**Routes (platform administrator):** `PATCH /api/platform/people/:username`,
`POST /api/platform/people/:username/password`,
`POST /api/platform/people/:username/active`,
`GET /api/platform/people/:username/history`. **Access administrators:**
`GET /api/platform/holders` (who holds what, vacant roles marked).
`/api/platform/users` rows gain `active`, `personId`, `title`, `department`,
`company`, and for the platform administrator `whatsapp` and `email`.
`/api/me` gains `title`.

**Not in phase 1:** renaming a username (O2S's records point at usernames;
stays in O2S's Users & Access until the O2S session), any O2S screen change,
Nigehbaan joining, the "open to every active person" flag, companies as a
scope on grants, the org chart.

**Tests:** `tests/people-access.test.js` (19 checks) runs only
against a throwaway copy (`PLATFORM_TEST_DB=throwaway`; it refuses
`van_platform` and production by name).
