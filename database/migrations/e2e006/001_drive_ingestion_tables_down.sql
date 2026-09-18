-- E2E-006
-- ROLLBACK FOR DRIVE INGESTION TABLES
-- Destructive: use only under an explicitly approved rollback procedure.

BEGIN;

DROP TABLE public.drive_ingested_intelligence;
DROP TABLE public.drive_ingestion_log;

COMMIT;
