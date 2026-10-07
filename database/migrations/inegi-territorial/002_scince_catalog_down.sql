-- Conservative administrative rollback; execution requires separate approval.
-- Missing/unexpected objects, any data, or external dependencies abort rollback.
BEGIN;

-- Fail rather than silently treating rows hidden by RLS as an empty table.
SET LOCAL row_security = off;

DO $rollback$
DECLARE
    table_name text;
    has_rows boolean;
    target_tables constant text[] := ARRAY[
        'inegi_scince_observation_set',
        'inegi_scince_normalization_release',
        'inegi_scince_catalog'
    ];
BEGIN
    FOREACH table_name IN ARRAY target_tables LOOP
        IF to_regclass(format('public.%I', table_name)) IS NULL THEN
            RAISE EXCEPTION 'SCINCE_ROLLBACK_TABLE_MISSING: public.%', table_name;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_class
            WHERE oid = to_regclass(format('public.%I', table_name))
              AND relkind = 'r'
        ) THEN
            RAISE EXCEPTION 'SCINCE_ROLLBACK_UNEXPECTED_OBJECT: public.% must be an ordinary table', table_name;
        END IF;

        -- Held until COMMIT: prevents writes between emptiness checks and DROP.
        EXECUTE format('LOCK TABLE public.%I IN ACCESS EXCLUSIVE MODE', table_name);
        -- Recheck after acquiring the lock in case concurrent DDL replaced it.
        IF NOT EXISTS (
            SELECT 1 FROM pg_catalog.pg_class
            WHERE oid = to_regclass(format('public.%I', table_name))
              AND relkind = 'r'
        ) THEN
            RAISE EXCEPTION 'SCINCE_ROLLBACK_UNEXPECTED_OBJECT: public.% must be an ordinary table', table_name;
        END IF;
    END LOOP;

    -- Check every locked table before dropping any object.
    FOREACH table_name IN ARRAY target_tables LOOP
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', table_name)
            INTO has_rows;
        IF has_rows THEN
            RAISE EXCEPTION 'SCINCE_ROLLBACK_NONEMPTY: public.% contains data; rollback refused', table_name;
        END IF;
    END LOOP;

    -- Reverse FK dependency order; external dependencies cause a full rollback.
    DROP TABLE public.inegi_scince_observation_set RESTRICT;
    DROP TABLE public.inegi_scince_normalization_release RESTRICT;
    DROP TABLE public.inegi_scince_catalog RESTRICT;
END
$rollback$;

COMMIT;
