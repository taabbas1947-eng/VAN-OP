# VAN Systems · the access model

Ruled by Tahir on 25 September 2026. Built the same day in `server.js`,
`launcher.html` and `pd/pd-lib.js`. The full proposal with the findings is the
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

A grant of its own: module `platform`, role `admin`, seeded once at boot from
the O2S COO rows. The `admin` gate and Manage access read it; the COO role in
the token keeps working during the changeover.

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

`docs/platform/RECONCILE-2026-09-25.sql` PART 1 is a read-only report of every
place the 2 stores disagree. Run it on local first, then production.
