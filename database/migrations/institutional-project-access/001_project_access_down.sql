-- DESTRUCTIVE administrative rollback; separately approved execution only.
-- Any active OR revoked assignment prevents rollback. Never discard history.
BEGIN;
DO $rollback$
BEGIN
    IF current_user = 'ceipol_app' OR session_user = 'ceipol_app' THEN
        RAISE EXCEPTION 'PROJECT_ACCESS_ROLLBACK_ADMIN_REQUIRED';
    END IF;
    IF to_regclass('public.institutional_project_access') IS NULL THEN
        RAISE EXCEPTION 'PROJECT_ACCESS_ROLLBACK_TABLE_MISSING';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_class
        WHERE oid = to_regclass('public.institutional_project_access') AND relkind = 'r'
    ) THEN
        RAISE EXCEPTION 'PROJECT_ACCESS_ROLLBACK_UNEXPECTED_OBJECT';
    END IF;
    -- Held until COMMIT: prevents insertion between the emptiness check and DROP.
    LOCK TABLE public.institutional_project_access IN ACCESS EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM public.institutional_project_access) THEN
        RAISE EXCEPTION 'PROJECT_ACCESS_ROLLBACK_NONEMPTY: active or historical grants exist; rollback refused';
    END IF;
    -- Default RESTRICT also refuses external dependencies; no silent cascade.
    -- The table-owned partial index is removed by PostgreSQL with the table.
    DROP TABLE public.institutional_project_access RESTRICT;
END
$rollback$;
COMMIT;
