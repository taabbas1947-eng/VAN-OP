-- ===========================================================================
-- PLATFORM · P002-CHECK.sql — run BEFORE P002_remove_pd.sql, on its own.
-- Read-only. Shows what P002 deletes for good, so it is seen before it goes (review, 17 Oct 2026).
-- Make the backup export first; it is the only copy of these rows afterwards.
-- ===========================================================================
SELECT (SELECT COUNT(*) FROM pd_dropbox)        AS dropbox_messages,
       (SELECT COUNT(*) FROM pd_library_items)  AS library_items,
       (SELECT COUNT(*) FROM pd_materials)      AS pd_materials,
       (SELECT COUNT(*) FROM pd_delivery_contexts) AS delivery_contexts,
       (SELECT COUNT(*) FROM pd_audit_log)      AS pd_audit_rows,
       (SELECT COUNT(*) FROM user_module_roles WHERE module='pd') AS pd_role_grants,
       (SELECT COUNT(*) FROM user_module_roles WHERE module='pd' AND is_admin=1) AS pd_admins;
-- Who holds a PD role now (these are written to the access history by P002):
SELECT username, role, is_admin FROM user_module_roles WHERE module='pd' ORDER BY username;
