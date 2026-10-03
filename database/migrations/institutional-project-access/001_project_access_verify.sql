-- Administrative preflight/postcheck; SELECT only, safe when table/role is absent.
-- Outputs are evidence, not an automatic PASS. See the governed runbook.
SELECT current_database() AS database_name, current_user AS execution_role,
       session_user AS session_role,
       to_regclass('public.institutional_project_access') AS authority_table;

SELECT r.rolname, r.rolsuper, r.rolcreaterole, r.rolcreatedb, r.rolbypassrls,
       has_schema_privilege(r.oid, 'public', 'USAGE') AS schema_usage,
       has_schema_privilege(r.oid, 'public', 'CREATE') AS schema_create,
       has_database_privilege(r.oid, current_database(), 'CREATE') AS database_create,
       c.relkind, pg_get_userbyid(c.relowner) AS table_owner,
       pg_has_role(r.oid, c.relowner, 'USAGE') AS inherits_owner,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS can_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS can_delete,
       has_table_privilege(r.oid, c.oid, 'TRUNCATE') AS can_truncate,
       has_table_privilege(r.oid, c.oid, 'REFERENCES') AS can_reference,
       has_table_privilege(r.oid, c.oid, 'TRIGGER') AS can_trigger
FROM pg_roles r
LEFT JOIN pg_class c ON c.oid = to_regclass('public.institutional_project_access')
WHERE r.rolname = 'ceipol_app';

-- Conservative membership closure also exposes NOINHERIT roles usable via SET ROLE.
SELECT member_role.rolname AS reachable_role, member_role.rolsuper,
       member_role.rolcreaterole, member_role.rolcreatedb,
       member_role.rolbypassrls, member_role.oid = c.relowner AS is_table_owner,
       has_schema_privilege(member_role.oid, 'public', 'CREATE') AS schema_create,
       has_database_privilege(member_role.oid, current_database(), 'CREATE') AS database_create,
       has_table_privilege(member_role.oid, c.oid, 'INSERT') AS can_insert,
       has_table_privilege(member_role.oid, c.oid, 'UPDATE') AS can_update,
       has_table_privilege(member_role.oid, c.oid, 'DELETE') AS can_delete,
       has_table_privilege(member_role.oid, c.oid, 'TRUNCATE') AS can_truncate,
       has_table_privilege(member_role.oid, c.oid, 'REFERENCES') AS can_reference,
       has_table_privilege(member_role.oid, c.oid, 'TRIGGER') AS can_trigger
FROM pg_roles runtime_role
JOIN pg_roles member_role ON pg_has_role(runtime_role.oid, member_role.oid, 'MEMBER')
LEFT JOIN pg_class c ON c.oid = to_regclass('public.institutional_project_access')
WHERE runtime_role.rolname = 'ceipol_app';

SELECT a.attname AS column_name, format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull AS not_null, pg_get_expr(d.adbin, d.adrelid) AS column_default
FROM pg_attribute a
LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE a.attrelid = to_regclass('public.institutional_project_access')
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY a.attnum;

SELECT conname, contype, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conrelid = to_regclass('public.institutional_project_access')
ORDER BY conname;

SELECT indexrelid::regclass AS index_name, indisvalid, indisready,
       pg_get_indexdef(indexrelid) AS definition,
       pg_get_expr(indpred, indrelid) AS predicate
FROM pg_index WHERE indrelid = to_regclass('public.institutional_project_access');

SELECT CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END AS grantee,
       acl.privilege_type, acl.is_grantable
FROM pg_class c
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
WHERE c.oid = to_regclass('public.institutional_project_access')
ORDER BY grantee, privilege_type;

-- Column ACLs can confer writes even when table-level grants look restricted.
SELECT a.attname AS column_name,
       CASE WHEN acl.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(acl.grantee) END AS grantee,
       acl.privilege_type, acl.is_grantable
FROM pg_attribute a
CROSS JOIN LATERAL aclexplode(a.attacl) acl
WHERE a.attrelid = to_regclass('public.institutional_project_access') AND a.attnum > 0;
