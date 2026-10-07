-- Administrative provisioning only. No password, ownership transfer, or table grants.
BEGIN;
DO $provision$
DECLARE
    runtime pg_catalog.pg_roles%ROWTYPE;
BEGIN
    IF current_user = 'ceipol_app' OR session_user = 'ceipol_app' THEN
        RAISE EXCEPTION 'RUNTIME_ROLE_ADMIN_REQUIRED';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles
                   WHERE rolname = current_user AND (rolsuper OR rolcreaterole)) THEN
        RAISE EXCEPTION 'RUNTIME_ROLE_ADMIN_REQUIRED: approved role administration capability required';
    END IF;
    SELECT * INTO runtime FROM pg_catalog.pg_roles WHERE rolname = 'ceipol_app';
    IF FOUND THEN
        IF NOT runtime.rolcanlogin OR runtime.rolsuper OR runtime.rolcreatedb
           OR runtime.rolcreaterole OR runtime.rolreplication OR runtime.rolbypassrls
           OR runtime.rolconfig IS NOT NULL THEN
            RAISE EXCEPTION 'RUNTIME_ROLE_INCOMPATIBLE: review existing attributes/settings separately';
        END IF;
    ELSE
        CREATE ROLE ceipol_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
            NOREPLICATION NOBYPASSRLS;
        SELECT * INTO runtime FROM pg_catalog.pg_roles WHERE rolname = 'ceipol_app';
    END IF;
    -- Conservative: reject every membership, including NOINHERIT/SET ROLE paths.
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members
               WHERE member = runtime.oid OR roleid = runtime.oid) THEN
        RAISE EXCEPTION 'RUNTIME_ROLE_MEMBERSHIP_PRESENT';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_shdepend
               WHERE refclassid = 'pg_catalog.pg_authid'::regclass
                 AND refobjid = runtime.oid AND deptype = 'o') THEN
        RAISE EXCEPTION 'RUNTIME_ROLE_OWNERSHIP_PRESENT';
    END IF;
    EXECUTE format('REVOKE CREATE ON DATABASE %I FROM ceipol_app', current_database());
    REVOKE CREATE ON SCHEMA public FROM ceipol_app;
    GRANT USAGE ON SCHEMA public TO ceipol_app;
    -- Direct REVOKE cannot remove rights inherited from PUBLIC. Never change PUBLIC here.
    IF has_database_privilege(runtime.oid, current_database(), 'CREATE')
       OR has_schema_privilege(runtime.oid, 'public', 'CREATE') THEN
        RAISE EXCEPTION 'RUNTIME_ROLE_EFFECTIVE_CREATE_PRESENT: PUBLIC/inherited ACL requires separate remediation';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','f')
          AND (has_table_privilege(runtime.oid, c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
               OR has_any_column_privilege(runtime.oid, c.oid, 'INSERT,UPDATE,REFERENCES'))
    ) OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c WHERE c.relkind = 'S'
          AND has_sequence_privilege(runtime.oid, c.oid, 'USAGE,UPDATE')
    ) OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_default_acl d
        CROSS JOIN LATERAL aclexplode(d.defaclacl) a
        WHERE a.grantee IN (0, runtime.oid)
          AND (a.is_grantable OR a.privilege_type IN
               ('SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','USAGE'))
    ) THEN
        RAISE EXCEPTION 'RUNTIME_ROLE_UNGOVERNED_PRIVILEGES: writes or broad default grants require separate review';
    END IF;
END
$provision$;
COMMIT;
