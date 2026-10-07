-- Separate human-approved administrative rollback only. Never discard dependencies.
BEGIN;
DO $rollback$
DECLARE runtime_oid oid;
BEGIN
    IF current_user = 'ceipol_app' OR session_user = 'ceipol_app'
       OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles
                      WHERE rolname = current_user AND (rolsuper OR rolcreaterole)) THEN
        RAISE EXCEPTION 'RUNTIME_ROLE_ADMIN_REQUIRED';
    END IF;
    SELECT oid INTO runtime_oid FROM pg_catalog.pg_roles WHERE rolname = 'ceipol_app';
    IF NOT FOUND THEN RAISE EXCEPTION 'RUNTIME_ROLE_MISSING'; END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members
               WHERE member = runtime_oid OR roleid = runtime_oid OR grantor = runtime_oid) THEN
        RAISE EXCEPTION 'RUNTIME_ROLE_MEMBERSHIP_DEPENDENCY';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_db_role_setting WHERE setrole = runtime_oid) THEN
        RAISE EXCEPTION 'RUNTIME_ROLE_SETTINGS_DEPENDENCY';
    END IF;
    -- The only removable dependency is the non-grantable public USAGE from UP.
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_namespace n
        CROSS JOIN LATERAL aclexplode(n.nspacl) a
        WHERE n.nspname = 'public' AND a.grantee = runtime_oid
          AND (a.privilege_type <> 'USAGE' OR a.is_grantable)
    ) OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_shdepend s
        WHERE s.refclassid = 'pg_catalog.pg_authid'::regclass AND s.refobjid = runtime_oid
          AND NOT (s.dbid = (SELECT oid FROM pg_catalog.pg_database WHERE datname = current_database())
                   AND s.classid = 'pg_catalog.pg_namespace'::regclass
                   AND s.objid = (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname = 'public')
                   AND s.objsubid = 0 AND s.deptype = 'a')
    ) THEN
        RAISE EXCEPTION 'RUNTIME_ROLE_DEPENDENCIES_PRESENT: owners/grants/policies must be reviewed separately';
    END IF;
    REVOKE USAGE ON SCHEMA public FROM ceipol_app;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_shdepend
               WHERE refclassid = 'pg_catalog.pg_authid'::regclass AND refobjid = runtime_oid) THEN
        RAISE EXCEPTION 'RUNTIME_ROLE_RESIDUAL_DEPENDENCY';
    END IF;
    -- PostgreSQL's dependency checks remain the final guard, including other databases.
    DROP ROLE ceipol_app;
END
$rollback$;
COMMIT;
