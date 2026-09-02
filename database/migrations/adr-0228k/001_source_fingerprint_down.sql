-- ADR-022.8K
-- REVERSAL OF MULTIDATASET ADDITIVE SCHEMA PHASE
-- REVIEW ONLY
--
-- WARNING:
-- This rollback is appropriate only before production data
-- depends on the newly introduced lineage columns.

BEGIN;

ALTER TABLE public.incidencia_estadistica
    DROP CONSTRAINT IF EXISTS
    incidencia_estadistica_source_fingerprint_pair_chk;

ALTER TABLE public.incidencia_estadistica
    DROP CONSTRAINT IF EXISTS
    incidencia_estadistica_source_fingerprint_format_chk;

ALTER TABLE public.incidencia_estadistica
    DROP CONSTRAINT IF EXISTS
    incidencia_estadistica_dataset_fk;

DROP TABLE IF EXISTS
    public.crime_incidence_dataset_records;

ALTER TABLE public.incidencia_estadistica
    DROP COLUMN IF EXISTS source_fingerprint_version;

ALTER TABLE public.incidencia_estadistica
    DROP COLUMN IF EXISTS source_fingerprint;

ALTER TABLE public.incidencia_estadistica
    DROP COLUMN IF EXISTS dataset_id;

DROP TABLE IF EXISTS public.crime_incidence_datasets;

COMMIT;