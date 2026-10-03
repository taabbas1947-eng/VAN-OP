-- ===========================================================================
-- PLATFORM · P001-CHECK.sql — read-only check, before and after P001
--
-- Changes nothing. Run it on local (van_platform selected) before applying
-- P001 and again after, and compare. For production, put
-- jodilkah_vanop_db. in front of every table name.
--
-- What to look for:
--   1. Every login is switched on (active = 1). Any 0 means stop and ask.
--   2. The O2S role on the login and the O2S role on the platform agree.
--   3. After P001: every login has a person (has_person = 1).
-- ===========================================================================

SELECT a.username,
       a.name,
       a.role                                                         AS o2s_role_on_login,
       (SELECT r.role FROM user_module_roles r
         WHERE r.username = a.username AND r.module = 'o2s')          AS o2s_role_on_platform,
       (SELECT r.role FROM user_module_roles r
         WHERE r.username = a.username AND r.module = 'pd')           AS pd_role_on_platform,
       a.active,
       CASE WHEN COALESCE(a.role, '') = COALESCE((SELECT r.role FROM user_module_roles r
                 WHERE r.username = a.username AND r.module = 'o2s'), '')
            THEN 'same' ELSE 'DIFFERENT' END                          AS o2s_roles_agree
  FROM auth_users a
 ORDER BY a.username;

-- After P001 only (before it, this line reports that the table does not exist):
SELECT a.username,
       EXISTS (SELECT 1 FROM platform_people p WHERE p.account_id = a.id) AS has_person
  FROM auth_users a
 ORDER BY a.username;
