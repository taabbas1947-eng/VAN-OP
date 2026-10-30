# Roles: one screen, System Administrator only (design, Option A)

_Draft for agreement, 28 Oct 2026 (MODULE: PLATFORM). Not built. Owner: Tahir. C2M parts need the
collaborator's agreement before any work starts._

## 1. Rulings (Tahir, 28 Oct 2026)

1. The **System Administrator** holds all access power.
2. Only a System Administrator **creates roles**, **sets what each role may do** (its rights) and
   **assigns roles** to people, in every app.
3. **COO and CFO are roles like any other.** They keep their business powers (approvals, price
   overrides) as ordinary rights; they lose every access power.
4. **One central screen on the platform** for roles, for every app.
5. **Option A:** each app keeps its own roles and rights where they are today and offers a small
   *roles service*; the platform screen talks to that service. The platform does not store any
   app's roles or rights.
6. **App admin will be dropped** (timing: later, Tahir 27 Oct).

## 2. Today and after

| Power | Today | After |
|---|---|---|
| Create logins, passwords, switch off | System Administrator | System Administrator |
| Assign roles | System Administrator; app admin for ordinary roles of its app | System Administrator |
| Create a role, set its rights: O2S | O2S COO; a department lead for rights in their department | System Administrator |
| Create a role, set its rights: C2M | C2M COO (the only role with `roles.manage`) | System Administrator |
| Roles only a System Administrator gives | O2S COO, C2M CFO, C2M COO, C2M custom roles (`sysAdminOnlyRole`) | List not needed: nobody else assigns |
| Where | People & access (assign); each app's own screen (design) | People & access: People tab (assign), Roles tab (design) |

## 3. The platform screen

People & access keeps its People tab (assign) and Activity tab. The **Roles by app** tab becomes
the place where roles are designed:

1. Pick an app (live apps only).
2. See its roles, grouped as the app groups them, with how many people hold each.
3. **Add a role**: a name, its department (where the app has departments) and its rights as tick
   boxes, grouped as the app groups them.
4. **Edit a role**: rename (where the app allows it), change its rights. Anything that takes a right
   away asks first and lists the people who hold the role.
5. **Archive a role**: only when nobody holds it. Roles are never deleted; history keeps their name.
6. From any role, open its holders on the People tab.

The screen shows only what the app's service returns. It holds no list of rights of its own.

## 4. The roles service each app offers

Every app on the platform offers the same 5 calls. Each call checks that the caller is a
**System Administrator** (`isPlatformAdmin`); everyone else gets 403.

| Call | Does |
|---|---|
| `GET  /api/<app>/rolesvc/catalogue` | The rights this app has: groups, then items `{ key, label, note }` |
| `GET  /api/<app>/rolesvc/roles` | Every role: `{ key, label, department, builtin, archived, rights: [keys] }` |
| `POST /api/<app>/rolesvc/roles` | Create a role `{ label, department, rights }`; the app makes the key |
| `PUT  /api/<app>/rolesvc/roles/:key` | Change `{ label, rights }` |
| `POST /api/<app>/rolesvc/roles/:key/archive` | Archive; refused while anyone holds the role |

Every change is written twice: to the app's own audit trail, and to the platform access log
(`platform_access_log`, actions `role.create`, `role.rights`, `role.archive`, with before and
after). The platform offers its log function to apps server side, as it already does for holders.

People are still assigned on the People tab through `/api/platform/access`, unchanged.

## 5. Per app

### O2S (MODULE: O2S)

- Roles and rights live in O2S's own data: `masters.roles`, `masters.roleRights`,
  `masters.departments`. O2S has **33 rights in 5 departments** (commercial, supply chain,
  production, quality, leadership); 15 are marked "COO only, not for a department lead".
- Today the O2S COO, and a department lead within their department, change rights in the
  Authorisation panel (`o2s.html`, `addRole`, the rights ticks).
- The service edits that data on the server through the same revision-guarded save the app uses,
  so screens already open merge the change. A rights change reaches an open O2S screen at its next
  sync; a person's role still reaches O2S at their next sign-in.
- The Authorisation panel stops offering "Add a role" and the rights ticks; it points to the
  platform screen.

### C2M (MODULE: C2M, the collaborator's)

- Roles and rights live in `c2m_role` (`role_key`, `label`, `is_admin`, `actions_json`,
  `builtin`). C2M has **48 actions in 5 groups** (Prices and lists, Costs and recipes, Setup, What
  this role sees, Administration).
- Today only the COO role creates and edits roles: it is the locked `is_admin` role that always
  holds every action, including `roles.manage`.
- The existing `/api/c2m/roles` routes become the service, gated on System Administrator instead
  of `roles.manage`. The COO role stops being the locked "every action" role and gets its own list
  of actions like any other role.

### Every new app (C2L, Nigehbaan, QMS)

Publishes its role catalogue (as today, `docs/ACCESS-MODEL.md`) and offers the 5 calls above.

## 6. Platform changes (MODULE: PLATFORM)

1. Remove app admin: the App admin tick, `POST /api/platform/admin`, and the `is_admin` checks in
   `loadAdminCaps`, `/api/me` and the access routes. The column stays in the table, unused.
2. Remove `sysAdminOnlyRole` and its screen copy `sysOnlyRole`: nobody but a System Administrator
   assigns roles, so the list protects nothing.
3. People & access opens for System Administrators only.
4. The Roles by app tab: the design screen of §3, calling each app's service.
5. Offer the access-log function to apps, server side.

## 7. Order of work

Each step is its own piece of work and its own push.

1. **Platform:** pieces A and B (built, not pushed), then the removal of app admin (§6 items 1 to 3).
2. **C2M:** the service, and COO as an ordinary role (the collaborator).
3. **O2S:** the service; the Authorisation panel points to the platform.
4. **Platform:** the Roles tab design screen (§6 items 4 and 5), app by app as each service is ready.

## 7A. What the trial found (28 Oct 2026, branch `roles-trial`, local only)

Built as one trial across the 3 modules, each its own piece; tested on a copy of the live data of 24 Oct.

1. **C2M's COO is more than a role-designer.** C2M's "administrator role" flag (`is_admin`, held by COO) carries
   business rules: approvals only of what the administrator proposed (D-89), the exemption from ruling 19,
   taking back someone else's proposal, the monthly rate check. Making COO an ordinary role would change C2M
   approvals. The trial keeps the flag and shows COO **locked** ("always holds every action"); it only removes
   the action "Create and edit roles" (`roles.manage`) from C2M, so no C2M role designs roles any more. The
   collaborator decides whether COO becomes ordinary.
2. **O2S's COO** likewise holds every right in O2S's own code; the trial shows it locked.
3. **O2S has duties outside the 33 rights:** sign-offs given by role name in O2S's code (draft, review and
   approve a COA; inspect; release a truck; approve a delivery challan). The screen shows them per role as
   "also given by O2S's own rules", so a lab role no longer reads as "0 rights". (29 Oct: now ticks, see §7A
   The O2S step, item 7.)
4. **12 of O2S's 33 rights are not in force yet** (O2S still decides them from screen access). They can be
   ticked, as in O2S's own Authorisation panel, and say so.
5. **O2S's separation of duties** (5 pairs, e.g. the person who loads does not release) is checked by the
   service too; the platform screen cannot get round it.
6. **C2M has no "archived" mark:** archiving removes a role nobody holds; C2M's audit keeps what it was.
7. **O2S obeys a role made on the platform screen** without any change to `o2s.html`: a role "Dispatch Clerk"
   with 1 right, given to a person, was answered yes for that right and no for others by O2S's own check.
8. **Still open in the apps:** O2S's own Authorisation panel (Add a role, rights ticks) still works for the O2S
   COO and department leads; the trial does not change `o2s.html` (O2S work, after agreement). C2M's old Roles
   routes and screen remain in its code but no role can reach them, since no role holds `roles.manage`.

### Independent review of the trial (28 Oct 2026: code and data safety), fixed

1. **Rights not in force are read only.** For the 12 O2S rights O2S still decides itself (10 by role name in its
   code, 2 from screen access), the screen shows O2S's real answer today and nothing is written. Checked: for 5
   roles and 5 such rights the screen and O2S's own check give the same answers. Only the 21 rights in force can
   be set; a new role leaves the other 12 to O2S, so they follow its screen access.
2. **A save applies only the admin's own changes**, measured from what their screen showed, so a change made
   meanwhile by someone else is kept (tested). C2M also keeps a rename made meanwhile.
3. **A new O2S role starts locked out of Back Office**, never inheriting a leftover screen-access row of the same
   name (the trial data has one, "Ismaeel"); names like "constructor" are refused.
4. **C2M says "Remove", not "Archive",** and built-in C2M roles cannot be removed (C2M sends notices to them).
5. **Role changes in the log are filed as `role:<name>`**, so they never appear in a person's history, and the
   Activity tab says them in words.
6. A real fault on the Roles tab is shown as it is, not as "no roles service yet".

### Still open after the trial (not fixed; for agreement)

1. **Two writers in O2S.** O2S's own Authorisation panel still lets the O2S COO and department leads add roles
   and tick rights; when an open O2S page saves the same right, the page's value wins. Until O2S closes its panel
   (O2S work), "only a System Administrator designs roles" is not enforced in O2S, and separation of duties can
   be broken by two saves made at the same moment. Any signed-in login can still rewrite all O2S data through
   `/api/state` (security register S-01).
2. **Rare timing cases:** archiving a role at the same moment someone is given it; two roles of the same name
   made at the same moment in O2S and on the platform; two System Administrators removing each other.
3. **C2M's old Roles screen** text and docs still mention "Create and edit roles" (collaborator).
4. C2M role names must have Latin letters (the key is made from them); an Urdu-only name is refused.

### Messages that send people to the COO (Tahir, 29 Oct 2026)

Reviewed one by one (artifact "COO Messages Review"); Tahir took the suggestions:
- **Access messages move to the System Administrator** (26: logins, roles, rights, screen access, in O2S and C2M).
- **"Who may see a page" (5) and business decisions (25) stay** with the role that holds them.
- **C2M names roles, not people**, everywhere on its screens and in its messages: Tahir → the COO, Yawar → the CFO,
  Majid → the Production Manager, Himayat → the QC Head, Fahim → the Plant Manager. Done on the trial (C2M's
  `c2m-routes.js` and `c2m.html`, text only; code that matches stored data, such as "Yawar's Master Cost Sheet",
  and developer comments are unchanged). The printed price list keeps the signatory's name (Yawar Hussain).
- **O2S's 25 access messages wait for the O2S step** that hands its role and rights screens to the System
  Administrator, so no message says something O2S does not do.

### The O2S step (Tahir, 29 Oct 2026: "go with 1 & 2"; built on the trial, O2S build 2026-10-30a)

1. **Built:** O2S's own role, rights, screen-access and people tools are closed: the 14 writers in `o2s.html` refuse
   with one message (`accessMoved`); Back Office → People is read only (who holds which role) with a link to the
   launcher; the People desk says "Change on the launcher".
2. **Built:** screen access moved to the platform Roles screen ("Which screens it opens": No access, View, Edit for
   16 screens), with the role's **department**, **"Lead of its department"** and **Restore** for an archived role, since
   O2S's own lead and department settings are closed too. A lowered screen on a held role asks first. A new role
   starts locked out of Lists, People and Correct a record, as O2S's own Add a role did.
3. **Built (Tahir, 29 Oct 2026: "remove lock from COO role"; D-351):** the O2S COO is an ordinary role. O2S's 5
   COO shortcuts are gone (mayRole, mayHere, accessLevelOn, canEdit, _canEditOn); a one-time step (cooUnlockV1, and the
   roles service on the server copy) gave the COO every right in force and Edit on every screen as ticks, so nothing
   changed on the day. Checked in O2S: every right, screen and sign-off answered as before; then a right and a screen
   taken from the COO on the platform were refused by O2S, and given back. Kept: business powers fixed to the COO by
   name (approvals, corrections, sign-offs) and the separation-of-duties exemption. C2M's COO is still locked
   (C2M's administrator flag, D-89: the collaborator's decision).
4. **O2S reads the person's current role from the server each time it opens** (Tahir, 29 Oct 2026), not from the
   sign-in. Today the role is stamped into the sign-in token for up to 30 days, so a role given or taken away on
   People and access reaches O2S only at the person's next sign-in. Seen on the trial: Ahmer was given O2S COO again
   and O2S still hid Back Office until he signed out and in.
   **Built** (`roleFromServer`, called by `bootState` before the first paint; no O2S role: O2S does not open).
5. **Built:** the access messages say "System Administrator"; Guide rule R-049 "Who sets your access"; System
   documentation D-350 (access, api, dictionary, schema rebuilt with `build_sysdoc.py`); changelog 2026-10-30a.
   Tested: `apps/o2s/tests/accessmoved.test.js` 43/43 (runs the real functions); all O2S suites as before except the
   2 old failures; O2S's own access rule obeys screens set on the platform (checked in the browser).
6. **Left for the real O2S build:** the old People screen code (ppRender, roleEditorHTML, newRoleHTML and the rest)
   is unreachable but still in `o2s.html`, and some O2S tests (shell, rolemodel, authmodel) still pin that old code
   by its text; delete both together when this goes live.
7. **Built: who may sign is a list, ticked on the platform** (Tahir, 29 Oct 2026: "i want it to be dynamic list all
   sign off and check it for the roles"; COO "(a) Ticks like every role"; scope "the 7 sign-offs now; the rest
   later"; O2S D-352 then D-353). The Roles screen has a section, "What this role signs", with 9 ticks: COA draft
   (old-flow submit, bench results), COA review, COA approve, inspection, truck review, truck release, DC approve and
   DC reject. It replaces the read-only "Also given by O2S's own rules" line. O2S keeps the lists in
   `masters.signoffs`; with no list saved, today's lists stand, so nothing changes on the day. The COO is ticked
   wherever it signs today and never on a COA, and it can be unticked. The saves, the buttons, the Today jobs and the
   2-person rules all read the same list. The service keeps at least one role on every sign-off. It checks the
   5 two-person rules against the lists (the COO is exempt, as in O2S) and applies only the admin's own changes.
   If nobody active is left to sign, it saves and warns. Inspection still needs Edit on the screen; the AQCM's and
   QCM's named leave cover still signs. Tested: `apps/o2s/tests/signoffs.test.js` and `rolesvc-signs.test.js`
   (24, with mutation checks); against the trial server (17 checks, data put back); in the browser.
   Later: free samples, provisional release, corrections, UNFIT decisions.

Note (29 Oct): O2S's "read and sign" briefing "What changed on 13 and 15 Oct" applies per person to every existing
O2S role, COO included (12 parts for the COO). Ahmer has not signed it (only Tahir has, for COO, on 16 Oct). A new
role such as "IT User" is not in the briefing's list, so it is not asked to sign.

## 8. To confirm

1. **O2S COO and CFO rights.** Today O2S treats the COO as holding every right. When COO becomes an
   ordinary role, which rights does it keep? The same question for CFO. These lists must be set
   before the switch, or the COO loses approvals on the day.
2. **C2M COO's actions.** Which of the 48 actions does the C2M COO keep once it is no longer the
   locked role? The collaborator's call.
3. **O2S department leads** lose the power to change rights in their department. Confirm.
4. **Second pair of eyes.** A rights change takes effect when the System Administrator saves; it is
   logged but nobody approves it. Is that enough?
5. **O2S screens.** O2S has rights and also screen access per role. Confirm both move to the
   platform screen (O2S session to check the model).
