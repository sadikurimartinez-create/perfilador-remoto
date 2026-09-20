-- Destructive rollback. Apply only under an explicitly approved rollback procedure.

BEGIN;

DROP TABLE IF EXISTS public.inegi_territorial_demographics;
DROP TABLE IF EXISTS public.inegi_territorial_geography;
DROP TABLE IF EXISTS public.inegi_territorial_dataset;

COMMIT;
