# Nigehbaan (نگہبان) · build plan on the VAN platform

Draft, 7 October 2026, for Tahir and the collaborator. Nothing here is built yet
except the folder. The demo (`../nigehbaan-demo.html`) is the agreed picture of
the app; this plan says how it becomes an app on the platform.

**What Nigehbaan is:** VAN's compliance and risk app. It reminds people before a
date, traces the chain after them (approval, payment, deposit, filing) until the
proof is in, tracks every deadline, licence, payment and certificate with its
proof, finds what is missing, escalates when something is stuck, counts the
cost of each gap in rupees, and lets anyone raise a concern in confidence.

Sources: the demo (2,657 lines, read in full on 7 Oct 2026), the staff note
`docs/نگہبان Nigehbaan.docx` (25 Sep 2026), the platform rulings of 26 and 27
Sep 2026 (`docs/ACCESS-MODEL.md`, `OP-HANDOFF-PLATFORM.md`) and the app contract
(`docs/RESTRUCTURE-PLAN.md` §3).

---

## 1. Where things stand

| Item | State |
|---|---|
| Folder `apps/nigehbaan/` | made 7 Oct 2026 |
| Demo `nigehbaan-demo.html` | moved here; **kept out of git** while the repository is public (S-07). Ask Tahir for the file. |
| Staff note `docs/نگہبان Nigehbaan.docx` | moved here; kept out of git for the same reason |
| Server, tables, routes | none yet |
| Platform support | none yet: the platform knows only `o2s`, `pd` and `platform` (§3) |

**How the demo works today:** one HTML page, written as a claude.ai page. All
data sits in 19 "collections" kept in the browser (localStorage key
`nigehbaan-demo-v1`). Every rule runs in the browser, so nothing is checked,
escalated or reminded unless someone has the page open. The signed-in person is
a fake "Demo user". Uploads, AI ("Ask Nigehbaan", label reading) and comments
are switched off.

**What carries over:** the screens, the wording, the business rules (status,
escalation ladder, scoring, label checks) and the seed register: 111
obligations, 86 licences and trade marks, 18 positions, 13 policies, 6
hazardous materials, settings.

**What must change:** data moves to MySQL; the person comes from the platform
login; access is checked on the server, not only hidden in the browser; the
reminder and escalation checks run as a server job.

---

## 2. How it fits the single platform login

Settled rulings (26 to 27 Sep 2026), unchanged here:

1. **Sign-in is the platform's.** Nigehbaan keeps no users or passwords. The page
   reads the person from `GET /api/me` (username, name, title, and their
   Nigehbaan role in `modules[]`).
2. **1 role per person per app.** The person's Nigehbaan role is a row in
   `user_module_roles` (module `nigehbaan`). Nigehbaan never writes that table;
   roles are given on the launcher (People and access).
3. **Extra duties are Nigehbaan's own data**, keyed by platform username: who
   holds which position (Tax Manager, HR, …), who covers whom, committee seats.
4. **Contacts and titles come from the platform** (`platform_people`: title,
   WhatsApp, email). Nigehbaan never stores its own copy. Its server asks the
   platform `holdersOf(role)` / `contactsFor(usernames)` (already in `server.js`
   as `platformServices`). A browser never receives other people's contacts.
5. **Nigehbaan runs inside the VAN-OP server**, like O2S and PD: one address,
   one deploy. Page at `/nigehbaan`, API under `/api/nigehbaan/*`, tables
   `ngb_*`.
6. **Speak up is open to everyone, even without an account, like a hotline**
   (Tahir, 27 Sep). That is a public page with no login, protected the way PD's
   drop box is (`/pd/drop`: honeypot plus a per-hour limit per address).

```
 browser ── /nigehbaan (page) ─┐
          ── /api/me ──────────┤  the platform: login, van_token, roles, people, contacts
          ── /api/nigehbaan/* ─┤  Nigehbaan's routes: check role, read/write ngb_* tables
 anyone ─── /speak-up (public)─┘  public concern form, no login
                                  └─ one MySQL: auth_users, user_module_roles, platform_people … + ngb_*
```

---

## 3. What the platform must change first (MODULE: PLATFORM, a separate piece of work)

By the repo rule an app and the platform are never changed in one piece. These
come first, in their own change:

| # | Change | Where |
|---|---|---|
| P1 | Rename the planned app key `compha` to `nigehbaan` (nobody holds a `compha` role) | `MODULE_LIST`, launcher card |
| P2 | Accept Nigehbaan roles: `validModuleRole('nigehbaan', role)` checks the app's own role list | `server.js` |
| P3 | Add `nigehbaan` to `REAL_MODULES` so it can have its own access administrator | `server.js` |
| P4 | `roleCatalogue()` reads Nigehbaan's role list (from the app, not copied) | `server.js` |
| P5 | Mount the app: `/nigehbaan` page, `/api/nigehbaan/*` routes and the public `/speak-up`, all registered **before** O2S's catch-all route | `server.js` (1 `require` line, like PD) |
| P6 | Launcher card "Nigehbaan" goes live | `launcher.html` |
| P7 | Contacts: the WhatsApp and email fields on the person already exist in migration P001. P001 must be applied (local, then production by hand) before reminders can name anyone | `migrations/P001…` |
| P8 | Optional, from the restructure plan phase 2: the app describes itself in `apps/nigehbaan/app.json` and the loader reads it, so P1 to P6 become one-time work for every later app | `server.js` loader |

Nothing in P1 to P7 changes how O2S or PD sign in.

---

## 4. Roles: how they are made

**Roles and the access matrix are the collaborator's to decide.** This section
is a proposal from the demo, for him to confirm or change.

The demo knows 4 levels plus an editor switch:

| Demo level | How the demo decides it | What the person sees |
|---|---|---|
| lead | position in department "Management" (CEO, COO) | everything: all tasks, scoreboard, ESG, back office, activity |
| owner | any other department | their department's registers (others read-only), their tasks |
| committee | department "Committee" | the sealed harassment area only |
| staff | everyone else | Speak up, policies to read and confirm |
| Editor | an account flag | back office, compliance types, full Speak up register, policy editing |

**Proposed Nigehbaan roles** (one per person, in `user_module_roles`, given on
the launcher):

| Role key | Name | Replaces in the demo |
|---|---|---|
| `admin` | Compliance administrator | Editor (back office, settings, compliance types, policies) |
| `lead` | Leadership | lead |
| `owner` | Compliance owner | owner (their department comes from the position they hold, §5 `ngb_positions`) |
| `staff` | Staff | staff |

**Committee is a seat, not a role** (proposal): per ruling 5, a committee
place is an extra duty, so it lives in `ngb_seats` (username, seat
`hic_member` / `hic_chair`). A committee member keeps their normal role and
also sees the sealed area. Tahir said on 27 Sep "we have to discuss this", so it
stays open (§8).

**Who gets a role:** the demo shows Speak up and policies to every employee. Two
ways, for the collaborator to choose:
- **All active accounts** (`access: all-active` in the app contract): anyone
  signed in who holds no Nigehbaan role is treated as `staff`. Needs one
  platform change (the launcher shows the card to everyone).
- **Role holders only**: every employee must be given `staff` on the launcher.

**Rules the server enforces** (the demo only hid buttons):
- The sealed harassment area: only holders of a committee seat.
- "Preview as" and "Open someone's desk": only `admin` and `lead`.
- A department owner writes only their department's registers.
- A proof is accepted by someone other than the person who sent it (for high
  and critical items).
- Print control: gate 1 (Regulatory Manager) and gate 2 (Plant Manager) by 2
  different people.

---

## 5. Tables (all `ngb_`, migrations in `apps/nigehbaan/migrations/`)

People are always stored as the platform **username** (or `auth_users.id` where
a foreign key is wanted). No names, phones or emails are copied into these
tables. Every table also gets `created_at`, `created_by`, `updated_at`,
`updated_by`.

### 5.1 People and duties

| Table | One row is | Main columns |
|---|---|---|
| `ngb_positions` | A position (not an employee): CEO, Tax Manager, HR, … | `id`, `position`, `department`, `estate` (Head office / Factory / Both), `holder_username` (NULL = vacant), `cover_position_id`, `manager_position_id` |
| `ngb_seats` | An extra duty such as a committee seat | `username`, `seat`, `from_date`, `to_date` |

### 5.2 Obligations (the core)

| Table | One row is | Main columns |
|---|---|---|
| `ngb_obligations` | A duty required by a law, regulator, contract or VAN policy | `id`, `ref`, `name`, `domain`, `authority`, `jurisdiction`, `estate`, `recurrence` (none/monthly/quarterly/halfyearly/annual), `frequency_text`, `lead_days`, `criticality`, `risk_type`, `esg` (E/S/G), `evidence_required`, `law_ref`, `source`, `penalty_text`, `min_pkr`, `max_pkr`, `impact`, `accountable_position_id`, `responsible_position_id`, `signoff_position_id`, `consulted`, `informed`, `status` (Active/Watch/Not applicable), `notes` |
| `ngb_occurrences` | One dated round of an obligation (e.g. FED return for Sep 2026) | `id`, `obligation_id`, `period`, `due_date`, `date_verified`, `status` (open/in_progress/submitted/review/compliant), `submitted_at/by`, `reviewed_at/by`, `returned_note/at/by`, `completed_at/by` |
| `ngb_evidence` | One proof item on anything | `id`, `subject_type` (occurrence/training/record), `subject_id`, `kind` (file/ref), `file_id`, `text`, `at`, `by` |
| `ngb_files` | An uploaded file (PDF or image, up to 20 MB) | `id`, `name`, `mime`, `size`, `storage_key`, `uploaded_by`, `at` |

### 5.3 Registers

| Table | One row is | Main columns |
|---|---|---|
| `ngb_licences` | A licence or registration VAN holds (PSQCA, Punjab, …) | `id`, `name` (type), `regulator`, `product`, `brand`, `formulation`, `number`, `standard`, `holder`, `address`, `issue_date`, `expiry_date`, `surveillance_date`, `renewal` (not filed/filed/renewed), `monthly_sales_pkr`, `marking_fee`, `region`, `site`, `missing`, `original_at`, `owner_position_id`, `custodian_position_id`, `client_id` (NULL = VAN's own), `cert_file_id`, `notes` |
| `ngb_trademarks` | A trade mark (the demo mixes these into licences; split here) | `id`, `mark`, `mark_type`, `class`, `country`, `app_no`, `filed_date`, `reg_no`, `stage`, `expiry_date`, `used_on`, `image_file_id` |
| `ngb_trademark_licences` | Which licences a mark covers | `trademark_id`, `licence_id` |
| `ngb_clients` | A partner brand VAN manufactures for | `id`, `name`, `brands`, `contact_text`, `annual_business_pkr`, `owner_position_id`, `qc_position_id`, `notes` |
| `ngb_dealers` | A dealer and their certificate to sell fertilizer | `id`, `name`, `firm`, `district`, `province`, `cert_no`, `authority`, `cert_expiry`, `annual_purchase_pkr`, `status`, `owner_position_id`, `cert_file_id` |
| `ngb_documents` | A contract or document | `id`, `title`, `type`, `counterparty`, `signed_date`, `expiry_date`, `notice_days`, `value_pkr`, `signed_copy`, `original_at`, `terms`, `owner_position_id`, `custodian_position_id`, `file_id` |
| `ngb_vehicles` | A vehicle | `id`, `reg_no`, `make`, `commercial`, `in_company_name`, `token_paid_until`, `insurance_expiry`, `insurance_type`, `fitness_expiry`, `route_permit_expiry`, `driver`, `driver_licence_expiry`, `echallan_checked`, `owner_position_id`, `notes` |
| `ngb_materials` | A hazardous material | `id`, `name`, `form`, `hazard`, `location`, `max_qty`, `unit`, `sds`, `last_inspection`, `inspect_every_days`, `owner_position_id`, `notes` |
| `ngb_material_requirements` | One requirement for a material (licence, SDS, store) | `material_id`, `key`, `label`, `critical`, `status` (missing/verify/held/not_required), `law`, `why`, `penalty_pkr`, `licence_id` |

### 5.4 People compliance and safety

| Table | One row is | Main columns |
|---|---|---|
| `ngb_employees` | An employee as compliance sees them (EOBI, PESSI, file) | `id`, `emp_no`, `name`, `department`, `designation`, `estate`, `join_date`, `gross_wage`, `status`, `hazardous_role`, `senior`, `gender` |
| `ngb_employee_file` | One required paper in an employee's file | `employee_id`, `item_key`, `ref`, `date`, `done`, `file_id` |
| `ngb_trainings` | A safety training session | `id`, `title`, `date`, `trainer`, `topics`, `hours`, `location` |
| `ngb_training_attendees` | Who attended | `training_id`, `employee_id` |

Open: HRMS is a separate app with its own login. Whether employees and wages
are typed here, imported (the demo has CSV import) or read from HRMS is a
decision (§8).

### 5.5 Speak up and policies

| Table | One row is | Main columns |
|---|---|---|
| `ngb_concerns` | A concern raised | `id`, `ref` (VAN-xxxxxx), `at`, `category`, `text`, `where_text`, `want_text`, `confidential`, `channel` (web/public/offline), `status` (new/ack/review/resolved/closed), `handler_position_id`, `ack_at`, `resolved_at`, `outcome`, `satisfied`, `follow_up_code_hash` |
| `ngb_concern_reporters` | Who raised it, kept apart | `concern_id`, `username` (NULL for anonymous or public) |
| `ngb_concern_updates` | A note on a concern | `concern_id`, `at`, `by`, `note`, `visible_to_reporter` |
| `ngb_policies` | A VAN policy | `id`, `title`, `purpose`, `pillar`, `status` (Not written/Draft/Approved), `version`, `effective`, `audience`, `required`, `body`, `owner_position_id`, `file_id` |
| `ngb_policy_acks` | A person confirmed a policy version | `policy_id`, `username`, `version`, `at` |

**Anonymity, by design:** in the demo the concern's record key *was* the
reporter's user id. Here the reporter sits in a separate table that only the
server reads, and only to show a reporter their own concerns. A public or
anonymous concern stores no username; the reporter gets a reference and a
follow-up code (stored as a hash) to check the answer later.

### 5.6 Print control (labels)

| Table | One row is | Main columns |
|---|---|---|
| `ngb_prints` | A label print job | `id`, `sku`, `brand`, `holder`, `pack_size`, `version`, `planned_qty`, `licence_id`, `status` (draft/checked/review1/review2/released/printed/rejected), `extracted` (JSON), `gate1_at/by`, `gate2_at/by`, `release_printer`, `release_qty`, `released_at/by`, `received_qty`, `received_dn`, `received_at/by`, `rejection_note/at/by`, `override_reason` |
| `ngb_print_images` | Up to 6 artwork images | `print_id`, `file_id`, `order` |
| `ngb_print_checks` | One rule check result | `print_id`, `check_key`, `pass`, `detail` |

### 5.7 Alerts, settings, custom types, audit

| Table | One row is | Main columns |
|---|---|---|
| `ngb_signals` | The saved state of one alert (overdue, expiring, missing) | `key` (e.g. `occ-123`, `lic-exp-45`), `first_seen`, `resolved_at`, `severity`, `title`, `ack_state` (on_it/blocked), `ack_note/at/by`, `escalation_stage` |
| `ngb_nudges` | A reminder sent | `signal_key`, `at`, `by`, `to_username`, `channel` (whatsapp/email) |
| `ngb_settings` | One settings block | `key` (policy, payroll, hr, recognition, esg, regions, labels, areas), `value` (JSON) |
| `ngb_types` | A compliance type built in Back office (e.g. property tax) | `id`, `parent_id`, `name`, `tab_name`, `description`, `authority`, `law_ref`, `domain`, `record_noun`, `status`, `order`, `show_tab`, `regions`, `recurrence`, `lead_days`, `sev_overdue`, `evidence_required`, `due_key`, `cost_key`, `fields` (JSON), `layers` (JSON) |
| `ngb_records` | A record of a custom type | `id`, `type_id`, `title`, `region`, `site`, `status`, `values` (JSON), `date_verified`, `submitted_at` |
| `ngb_record_approvals` | One approval layer signed | `record_id`, `cycle`, `layer`, `at`, `by` |
| `ngb_audit` | One change to anything | `id`, `at`, `username`, `subject_type`, `subject_id`, `action`, `detail` (JSON). Append-only. Replaces the demo's per-record `history` lists. Covers concerns, policy confirmations and alerts too, which the demo did not log. |

About 33 tables. The first migration also loads the demo's seed: 111
obligations, 86 licences and trade marks, 18 positions, 13 policies, 6
materials and the settings.

---

## 6. Feature plan, in steps

Each step goes through the usual gates: tests, then local XAMPP (`van_platform`),
then production when Tahir chooses.

| Step | What | Module | Result |
|---|---|---|---|
| N0 | Folder, demo moved, this plan | NIGEHBAAN | done 7 Oct 2026 |
| N1 | Platform hooks P1 to P7 (§3) | PLATFORM | the launcher shows Nigehbaan; roles can be given; `/nigehbaan` opens the demo behind the login |
| N2 | The core on MySQL: positions and seats, obligations, occurrences, evidence and files, settings, audit; the 4 roles enforced on the server; seed loaded | NIGEHBAAN | Register, Tasks and Home work with shared data for everyone |
| N3 | The registers: licences and trade marks, contracts, clients, dealers, fleet, hazardous materials | NIGEHBAAN | every register shared and saved |
| N4 | Speak up (signed in, plus the public `/speak-up` hotline) and policies with read-and-confirm | NIGEHBAAN | concerns handled with anonymity; policies confirmed per version |
| N5 | The watcher: a server job (every hour) that works out alerts, moves escalation Owner → Cover → Manager → COO at 2, 5 and 10 days (halved for critical), and sends reminders; a Monday summary | NIGEHBAAN (+ platform contacts) | nothing depends on someone having the page open |
| N6 | People compliance and safety: employees, file papers, trainings | NIGEHBAAN | after the HRMS decision (§8) |
| N7 | Print control: the 2-gate label release; AI label reading if approved | NIGEHBAAN | after the AI decision (§8) |
| N8 | Scoreboard and recognition titles, ESG page, Back office custom types, "Ask Nigehbaan" | NIGEHBAAN | the full demo, live |

**How the page is reused:** the demo's screens talk to a small storage layer
(`collection(...).onSnapshot`, `doc(...).set/update/delete`). Step N2 replaces
only that layer with calls to `/api/nigehbaan/*`, so the screens and wording stay
as they are. The business rules that decide status move to the server (shared
code) so the watcher in N5 and the page give the same answer.

---

## 7. Folder layout

```
apps/nigehbaan/
  nigehbaan-demo.html        the demo (kept out of git while the repo is public)
  nigehbaan.html             the live page, from N1/N2
  ngb-routes.js              /api/nigehbaan/* and /speak-up, mounted from server.js by 1 line
  ngb-lib.js                 shared rules: status, escalation, scoring, label checks
  app.json                   when the platform loader exists (P8)
  migrations/                N001_core.sql, N002_seed.sql, …
  tests/
  docs/                      this plan, the staff note
  OP-HANDOFF-NIGEHBAAN.md    the session log, append-only
  README.md
```

---

## 8. Decisions needed

| # | Decision | Who | Why it matters |
|---|---|---|---|
| D1 | Make the VAN-OP repository private (S-07) | Tahir / security department | until then, the demo, its seed and the staff note stay out of git |
| D2 | The 4 roles in §4, and every employee as `staff` vs all active accounts | collaborator | decides P2 to P4 and who sees the card |
| D3 | Committee: a role or a seat (proposal: seat) | collaborator, with Tahir | the sealed harassment area depends on it |
| D4 | Employees and wages: typed here, imported, or read from HRMS | collaborator | EOBI/PESSI checks need wages and headcount |
| D5 | Reminders: WhatsApp click-to-send (as the demo) or sent automatically; email provider | collaborator | the watcher in N5 |
| D6 | AI for label reading and "Ask Nigehbaan": use the Claude API or leave it out | Tahir | cost and a key to manage |
| D7 | Where uploaded files live: MySQL or Cloudflare R2 (not the Render disk, see restructure plan Z1) | Tahir | proofs and certificates |
| D8 | Policies: sign-in only, or also public like Speak up | collaborator | the public pages |
