-- SELECT-only catalog evidence. Absence of findings is not a blanket runtime approval.
SELECT current_database() AS database_name, current_user AS execution_role,
       session_user AS session_role;

SELECT r.oid IS NOT NULL AS role_exists, r.rolname, r.rolcanlogin,
       r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls,
       r.rolconfig IS NOT NULL AS role_settings_present,
       has_schema_privilege(r.oid, 'public', 'USAGE') AS public_usage,
       has_schema_privilege(r.oid, 'public', 'CREATE') AS public_create,
       has_database_privilege(r.oid, current_database(), 'CREATE') AS database_create,
       r.oid = d.datdba AS owns_database,
       EXISTS (SELECT 1 FROM pg_catalog.pg_shdepend s
               WHERE s.refclassid = 'pg_catalog.pg_authid'::regclass
                 AND s.refobjid = r.oid AND s.deptype = 'o') AS owns_any_object
FROM (SELECT 1) anchor
LEFT JOIN pg_catalog.pg_roles r ON r.rolname = 'ceipol_app'
JOIN pg_catalog.pg_database d ON d.datname = current_database();

-- UNION terminates cycles; includes potentially reachable SET ROLE paths.
WITH RECURSIVE reachable(oid) AS (
    SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'ceipol_app'
    UNION
    SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN reachable x ON m.member = x.oid
)
SELECT r.rolname AS reachable_role, r.rolsuper, r.rolcreatedb, r.rolcreaterole,
       r.rolreplication, r.rolbypassrls,
       has_database_privilege(r.oid, current_database(), 'CREATE') AS database_create,
       has_schema_privilege(r.oid, 'public', 'CREATE') AS public_create
FROM reachable x JOIN pg_catalog.pg_roles r ON r.oid = x.oid;

SELECT parent.rolname AS granted_role, member.rolname AS member_role, m.admin_option
FROM pg_catalog.pg_auth_members m
JOIN pg_catalog.pg_roles parent ON parent.oid = m.roleid
JOIN pg_catalog.pg_roles member ON member.oid = m.member
WHERE parent.rolname = 'ceipol_app' OR member.rolname = 'ceipol_app';

WITH RECURSIVE reachable(oid) AS (
    SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'ceipol_app'
    UNION
    SELECT m.roleid FROM pg_catalog.pg_auth_members m JOIN reachable x ON m.member = x.oid
)
SELECT r.rolname, n.nspname, c.relname, c.relkind,
       has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
       has_table_privilege(r.oid,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS table_write_or_ddl,
       has_any_column_privilege(r.oid,c.oid,'INSERT,UPDATE,REFERENCES') AS column_write_or_reference,
       c.relowner = r.oid AS owns_relation
FROM reachable x JOIN pg_catalog.pg_roles r ON r.oid = x.oid
CROSS JOIN pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema')
  AND n.nspname NOT LIKE 'pg_toast%';

SELECT n.nspname, c.relname,
       has_sequence_privilege(r.oid,c.oid,'USAGE,UPDATE') AS sequence_write_capability
FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE r.rolname = 'ceipol_app' AND c.relkind = 'S';

SELECT d.defaclobjtype, d.defaclnamespace, a.grantee, a.privilege_type, a.is_grantable
FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE a.grantee = 0 OR a.grantee = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = 'ceipol_app');

-- Review executable SECURITY DEFINER functions separately; catalogs cannot prove body safety.
SELECT n.nspname, p.proname, p.oid AS function_oid
FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE r.rolname = 'ceipol_app' AND p.prosecdef
  AND has_function_privilege(r.oid,p.oid,'EXECUTE');

SELECT s.dbid, s.classid, s.objid, s.objsubid, s.deptype
FROM pg_catalog.pg_shdepend s JOIN pg_catalog.pg_roles r ON r.oid = s.refobjid
WHERE r.rolname = 'ceipol_app' AND s.refclassid = 'pg_catalog.pg_authid'::regclass;
