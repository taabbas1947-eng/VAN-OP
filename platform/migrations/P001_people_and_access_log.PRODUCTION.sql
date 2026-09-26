-- ===========================================================================
-- PRODUCTION COPY of P001_people_and_access_log.sql — generated, do not edit
-- by hand; regenerate from the local file. Every table is written as
-- jodilkah_vanop_db.<table> because HostGator's phpMyAdmin SQL tab stays on
-- information_schema. Paste the whole file into the SQL tab.
-- ===========================================================================
-- ===========================================================================
-- PLATFORM · P001_people_and_access_log.sql — people, and the access log
--
-- Written 27 September 2026, on Tahir's rulings the same day
-- (docs/platform/PLATFORM-DESIGN.md):
--   1. A person is separate from a login. platform_people holds the human;
--      auth_users stays the login, untouched.
--   2. An access log from day 1: append-only, never edited or deleted.
--   3. Company is recorded for information only; grants stay company-wide.
--
-- WHAT IT DOES
--   * Creates platform_people: 1 row per human. account_id links to at most
--     1 login (auth_users.id, which never changes). A person with no login
--     (a worker, a Board member) has account_id NULL.
--   * Creates platform_access_log, with 2 triggers that refuse any UPDATE or
--     DELETE, so the history cannot be rewritten.
--   * Fills 1 person for every existing login, named as the login is named.
--
-- WHAT IT DOES NOT DO
--   * It does not ALTER, UPDATE or DELETE anything in auth_users or
--     user_module_roles. O2S reads those exactly as before.
--   * It does not switch anyone off. auth_users.active is not touched.
--
-- SAFE TO RUN TWICE. CREATE TABLE IF NOT EXISTS, DROP TRIGGER IF EXISTS,
-- and the fill only adds people for logins that have none yet.
--
-- HOW TO RUN (LOCAL): in phpMyAdmin select the van_platform database FIRST
-- (not information_schema), then paste this whole file into the SQL tab.
-- For production use P001_people_and_access_log.PRODUCTION.sql, which names
-- the database on every table, because HostGator's SQL tab stays on
-- information_schema.
--
-- Applied: LOCAL — not yet. PRODUCTION — not yet; by hand, later, when
-- Tahir chooses (CLAUDE.md standing rule).
-- ===========================================================================

-- BEFORE: every login, and whether it is switched on. Expect active = 1 for
-- every row. If any O2S login shows 0, stop and tell Claude before going on.
SELECT username, name, role AS o2s_role, active FROM jodilkah_vanop_db.auth_users ORDER BY username;

CREATE TABLE IF NOT EXISTS jodilkah_vanop_db.platform_people (
  person_id   INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  account_id  INT          NULL,
  full_name   VARCHAR(150) NOT NULL,
  title       VARCHAR(120) NULL,
  department  VARCHAR(80)  NULL,
  company     VARCHAR(80)  NULL,
  whatsapp    VARCHAR(20)  NULL,
  email       VARCHAR(191) NULL,
  status      ENUM('active','left') NOT NULL DEFAULT 'active',
  joined_on   DATE         NULL,
  left_on     DATE         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_platform_people_account (account_id),
  CONSTRAINT fk_platform_people_account FOREIGN KEY (account_id)
    REFERENCES jodilkah_vanop_db.auth_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS jodilkah_vanop_db.platform_access_log (
  log_id      BIGINT       NOT NULL AUTO_INCREMENT PRIMARY KEY,
  at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor       VARCHAR(191) NOT NULL,
  action      VARCHAR(40)  NOT NULL,
  subject     VARCHAR(191) NOT NULL,
  module      VARCHAR(32)  NULL,
  before_val  TEXT         NULL,
  after_val   TEXT         NULL,
  via         VARCHAR(40)  NULL,
  KEY ix_platform_access_log_subject (subject),
  KEY ix_platform_access_log_at (at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TRIGGER IF EXISTS jodilkah_vanop_db.platform_access_log_no_update;
DROP TRIGGER IF EXISTS jodilkah_vanop_db.platform_access_log_no_delete;

CREATE TRIGGER jodilkah_vanop_db.platform_access_log_no_update BEFORE UPDATE ON jodilkah_vanop_db.platform_access_log
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'platform_access_log is append-only: a record of who changed access cannot be changed.';

CREATE TRIGGER jodilkah_vanop_db.platform_access_log_no_delete BEFORE DELETE ON jodilkah_vanop_db.platform_access_log
FOR EACH ROW SIGNAL SQLSTATE '45000'
  SET MESSAGE_TEXT = 'platform_access_log is append-only: a record of who changed access cannot be removed.';

-- 1 person for every login that has none yet.
INSERT INTO jodilkah_vanop_db.platform_people (account_id, full_name)
SELECT a.id, LEFT(COALESCE(NULLIF(TRIM(a.name), ''), a.username), 150)
  FROM jodilkah_vanop_db.auth_users a
 WHERE NOT EXISTS (SELECT 1 FROM jodilkah_vanop_db.platform_people p WHERE p.account_id = a.id);

-- The migration itself is the first entry in the log (only once).
INSERT INTO jodilkah_vanop_db.platform_access_log (actor, action, subject, after_val, via)
SELECT 'system', 'migration.p001', 'platform', 'platform_people and platform_access_log created; people filled from auth_users', 'migration'
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM jodilkah_vanop_db.platform_access_log WHERE action = 'migration.p001');

-- AFTER: expect logins = people_with_login, and no login without a person.
SELECT (SELECT COUNT(*) FROM jodilkah_vanop_db.auth_users)                                   AS logins,
       (SELECT COUNT(*) FROM jodilkah_vanop_db.platform_people WHERE account_id IS NOT NULL) AS people_with_login,
       (SELECT COUNT(*) FROM jodilkah_vanop_db.auth_users a WHERE NOT EXISTS
          (SELECT 1 FROM jodilkah_vanop_db.platform_people p WHERE p.account_id = a.id))     AS logins_without_person,
       (SELECT COUNT(*) FROM jodilkah_vanop_db.auth_users WHERE active = 0)                  AS switched_off;
