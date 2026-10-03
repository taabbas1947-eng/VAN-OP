-- ===========================================================================
-- PLATFORM · RECONCILE-2026-09-25.sql — the 2 role stores, made to agree
--
-- Written 25 September 2026, on Tahir's rulings the same day (the access
-- model: the platform is the only writer of who holds which role).
--
-- Applied: LOCAL van_platform 25 Sept 2026. PRODUCTION: by hand, later, per
-- the standing rule in CLAUDE.md. Run PART 1 first on any database; it
-- writes nothing and tells you whether PART 2 is still needed there.
--
-- Nothing here creates or drops a table or column. The platform-admin row
-- (module 'platform', role 'admin') is seeded by server.js at boot, not here.
-- ===========================================================================

-- PART 1 · the report (read-only). An empty result means "no disagreement".

-- A. Has an O2S role in auth_users, but no O2S row on the platform
SELECT u.username, u.name, u.role AS o2s_role_in_auth_users
  FROM auth_users u
  LEFT JOIN user_module_roles m ON m.username = u.username AND m.module = 'o2s'
 WHERE u.role IS NOT NULL AND u.role <> '' AND m.username IS NULL;

-- B. Both stores have an O2S role, and they differ
SELECT u.username, u.role AS auth_users_says, m.role AS platform_says
  FROM auth_users u
  JOIN user_module_roles m ON m.username = u.username AND m.module = 'o2s'
 WHERE u.role <> m.role;

-- C. The same 2 questions for PD
SELECT u.username, u.pd_role AS pd_in_auth_users, m.role AS platform_says
  FROM auth_users u
  LEFT JOIN user_module_roles m ON m.username = u.username AND m.module = 'pd'
 WHERE (u.pd_role IS NOT NULL AND m.username IS NULL)
    OR (u.pd_role IS NOT NULL AND m.role IS NOT NULL AND u.pd_role <> m.role);

-- D. Platform rows with no account behind them
SELECT m.username, m.module, m.role
  FROM user_module_roles m
  LEFT JOIN auth_users u ON u.username = m.username
 WHERE u.username IS NULL;

-- E. Everyone, side by side
SELECT u.username, u.name, u.active,
       u.role AS o2s_column, mo.role AS o2s_platform, mo.is_admin AS o2s_admin,
       u.pd_role AS pd_column, mp.role AS pd_platform, mpa.role AS platform_admin
  FROM auth_users u
  LEFT JOIN user_module_roles mo  ON mo.username  = u.username AND mo.module  = 'o2s'
  LEFT JOIN user_module_roles mp  ON mp.username  = u.username AND mp.module  = 'pd'
  LEFT JOIN user_module_roles mpa ON mpa.username = u.username AND mpa.module = 'platform'
 ORDER BY u.username;


-- PART 2 · the corrections Tahir ruled on 25 September, from the 11 Sept dump.
-- Run only where PART 1 still shows the row.

-- B: ismaeel is the Finance Desk Officer (Tahir, 25 Sept). auth_users already
--    says so; the platform row said Finance.
UPDATE user_module_roles SET role = 'Finance Desk Officer'
 WHERE username = 'ismaeel' AND module = 'o2s' AND role = 'Finance';

-- D: 'ali' and 'majid' are rows with no account behind them (the accounts are
--    ali.raza and abdul.majid, which have their own correct rows). Muhammad Ali
--    and Muhammad Irfan have no account yet and are created through Manage
--    access, not by SQL.
DELETE FROM user_module_roles
 WHERE username IN ('ali', 'majid')
   AND username NOT IN (SELECT username FROM auth_users);
