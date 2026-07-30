# VAN Systems — Platform Design (Access & Sign-in)

_Design spec agreed 2026-07-30. Defines how the four systems live under one platform, how sign-in works, and how permissions are modelled. Written before building so the promise is checkable, not taken on faith._

---

## 1. The shape

**VAN Systems** is the platform — the front door. Under it sit **four co-equal sibling modules**. It is **one codebase, one login, one deployment** — a modular monolith, not four separate apps.

```
VAN Systems                ← platform (front door)
  ├─ shared:  identity/login · module→role assignment · the launcher
  ├─ O2S      ┐
  ├─ PD       │   four peers — each owns its own screens, data, permissions
  ├─ QMS      │   (QMS, ComPha not built yet)
  └─ ComPha   ┘
```

**Rule of thumb:** the platform owns *who you are* and *which modules/role you have*; each module owns *what its own screens do and what its roles may do*. No module is the parent of another — O2S is not "the main app with add-ons."

---

## 2. Access model — RBAC, scoped per module

Three layers. The chain is: **User → which modules → role in each module → that role's permissions.**

| Layer | Question it answers | Owned by | Stored where |
|---|---|---|---|
| **Identity** | Who are you? (one login) | Platform | shared auth DB — `auth_users` |
| **Module + role** | Which modules can you enter, as what role? (one role per module) | **Platform** | shared auth DB — `user_module_roles (username, module, role)` |
| **Permissions** | What can that role do inside the module? | **Each module** | the module's own store, as an **access matrix** (role × screen → view/edit) |

- **O2S is the template for the permission layer**: editable roles + a role×screen access matrix (`masters.accessMatrix`), managed in the Admin → "Access control" card. **PD, QMS, ComPha each get their own access matrix in the same style** — same UX, their own screens and roles.
- **Platform** answers *"User_A is a Reviewer in PD and a KAM in O2S, with no access to QMS/ComPha."*
- **Each module** answers *"a Reviewer in PD can screen G1 and log gates but not approve G2."*
- This is why the modules stay peers: no module's permission logic lives in a central rulebook that would make it subordinate.

**Decisions locked:** one role per user per module (multiple later only if a real case appears); permissions are **editable per module** (access-matrix style, no deploy needed to change who-can-do-what within a module's existing roles) — not hard-coded.

---

## 3. Where the data lives

- **Shared auth DB (MySQL, relational — the same DB O2S/PD already use, NOT the `app_state` blob):**
  - `auth_users` — identity + hashed password (exists today).
  - `user_module_roles` — `(username, module, role)`. **NEW.** Generalises cowork's one-off `pd_role` column into a table that scales to all four modules with zero rework.
  - (optional) a small **module registry** — the list of modules and the roles each defines — so the admin UI knows what to offer.
- **Each module keeps its own access matrix in its own store** — O2S in its state; PD/QMS/ComPha in their relational tables. Consistent with "each module owns its data."

---

## 4. Sign-in flow

1. Hit **VAN Systems** (`/`) → **not logged in → platform login** (the launcher's logged-out state).
2. Log in → platform issues the token → **land on the launcher**.
3. Launcher shows **only the modules you're allowed into** (filtered by your `user_module_roles`).
4. Click a module → **straight in, no second login** (shared token); the module then applies **its own access matrix** for your role.

**Auth mechanics:** one signed token (`van_token` in `localStorage`), issued by `POST /api/login`; every module trusts it. Signing into one = signed into all — already true by construction (PD reuses the exact same token today).

**The one new endpoint:** `GET /api/me` → returns your identity + your `(module, role)` list. Drives (a) the launcher's tile filtering and (b) each module loading the right access matrix.

**Login lives at the platform front door**, not inside O2S. Each module keeps its own embedded login **only as a fallback** — for a deep-link straight to `/o2s` or `/pd`, or an expired token mid-session. The primary path is always the front door.

---

## 5. What this changes vs. today (cowork's current build)

| | Today | Target |
|---|---|---|
| Launcher | open to anyone, static | auth-aware; login-or-tiles; role-filtered |
| Login | embedded in O2S (`index.html`); PD borrows it | **platform** login at the front door; modules keep embedded login as fallback |
| Module access | O2S role + a `pd_role` column (special case) | general `user_module_roles` table (all four uniform) |
| "Who am I / what can I open" | not exposed | `GET /api/me` |

Structurally, cowork already kept things peer-friendly: `pd/` is its own folder, `index.html` untouched, only a few PD lines in the shared `server.js`. The main thing that still reads as "PD is an extension" is **auth ownership** — hoisting login to the platform fixes it.

---

## 6. Build order (first slice → full)

1. **`user_module_roles` table** + migrate the existing `pd_role` into it; **`GET /api/me`**.
2. **Make the launcher auth-aware** — logged-out shows login; logged-in shows tiles filtered by `/api/me`. Tiles link to each module's route (O2S → `/o2s`, PD → `/pd`).
3. **Each module reads the token / `/api/me` for its role** and applies its own access matrix. (O2S already has one; give PD — then QMS/ComPha — the same access-matrix pattern.)
4. **Platform admin screen** — assign `user → module → role` (COO/admin only). Generalise cowork's PD role-assignment endpoint (`PUT /api/pd/users/:username/role`) to any module.
5. Keep embedded module logins as fallback throughout.

---

## 7. Invariants (don't break these)

- **Four peers, never "O2S + add-ons."**
- **Platform owns identity + module/role; each module owns its screens, data, and permissions.**
- **One login, one token, one deploy.**
- **Each module owns its own data** — no shared state blob across modules.
- **Permissions are editable per module** (access-matrix style) — changing who-can-do-what within a module's existing roles needs no deploy.

---

## 8. Open items (decide when reached)

- **Module registry** — is the list of modules + their roles a table, or defined in code? (Needed so the admin UI knows what roles to offer per module.)
- **Deep-link UX** — on `/o2s` with no token: let the module show its own login (simplest), or bounce to the front door and return? (Fallback works either way.)
- **PD access matrix** — PD's role→permission is currently code-gated (`may_screen`, `allowed_pages`); give it an editable access matrix like O2S when PD's UI gets its design pass.
