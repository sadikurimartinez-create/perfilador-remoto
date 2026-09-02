-- ADR-022.8K
-- MULTIDATASET CRIME INCIDENCE PROVENANCE + SOURCE_FINGERPRINT_V1
-- REVIEW ONLY - DO NOT EXECUTE UNTIL EXPLICITLY AUTHORIZED
--
-- PURPOSE:
-- Prepare incidencia_estadistica for multiple governed datasets:
-- historical 2020+, current datasets and future updates.
--
-- IMPORTANT:
-- This migration contains NO dataset-specific cardinality such as 1427 rows.
-- Dataset-specific validation belongs in subsequent migrations.

BEGIN;

-- ============================================================
-- 1. DATASET REGISTRY
-- ============================================================

CREATE TABLE public.crime_incidence_datasets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    dataset_name text NOT NULL,
    dataset_version text NOT NULL,
    source_organization text NOT NULL,

    temporal_start date NOT NULL,
    temporal_end date NOT NULL,

    provenance_status text NOT NULL DEFAULT 'REGISTERED',

    imported_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT crime_incidence_datasets_temporal_chk
        CHECK (temporal_start <= temporal_end),

    CONSTRAINT crime_incidence_datasets_identity_uq
        UNIQUE (
            dataset_name,
            dataset_version,
            source_organization
        )
);

-- ============================================================
-- 2. DATASET RECORD LINEAGE
-- ============================================================
--
-- One canonical incidence may appear in more than one governed
-- institutional dataset without being physically duplicated.
--
-- source_fingerprint identifies the exact substantive source row.
-- incidence_id identifies the canonical persisted incidence.

CREATE TABLE public.crime_incidence_dataset_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    dataset_id uuid NOT NULL
        REFERENCES public.crime_incidence_datasets(id)
        ON DELETE CASCADE,

    incidence_id uuid NOT NULL
        REFERENCES public.incidencia_estadistica(id)
        ON DELETE RESTRICT,

    source_fingerprint varchar(64) NOT NULL,

    source_fingerprint_version varchar(32) NOT NULL,

    source_row_locator text NOT NULL,

    linked_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT crime_incidence_dataset_records_fingerprint_chk
        CHECK (
            source_fingerprint ~ '^[a-f0-9]{64}$'
        ),

    CONSTRAINT crime_incidence_dataset_records_dataset_row_uq
        UNIQUE (
            dataset_id,
            source_row_locator
        )
);

CREATE INDEX crime_incidence_dataset_records_incidence_idx
    ON public.crime_incidence_dataset_records (
        incidence_id
    );

CREATE INDEX crime_incidence_dataset_records_fingerprint_idx
    ON public.crime_incidence_dataset_records (
        source_fingerprint
    );

-- ============================================================
-- 3. ADDITIVE LINEAGE COLUMNS
-- ============================================================

ALTER TABLE public.incidencia_estadistica
    ADD COLUMN dataset_id uuid;

ALTER TABLE public.incidencia_estadistica
    ADD COLUMN source_fingerprint varchar(64);

ALTER TABLE public.incidencia_estadistica
    ADD COLUMN source_fingerprint_version varchar(32);

-- ============================================================
-- 3. REFERENTIAL GOVERNANCE
-- ============================================================

ALTER TABLE public.incidencia_estadistica
    ADD CONSTRAINT incidencia_estadistica_dataset_fk
    FOREIGN KEY (dataset_id)
    REFERENCES public.crime_incidence_datasets(id);

-- ============================================================
-- 4. FINGERPRINT FORMAT GOVERNANCE
-- ============================================================

ALTER TABLE public.incidencia_estadistica
    ADD CONSTRAINT incidencia_estadistica_source_fingerprint_format_chk
    CHECK (
        source_fingerprint IS NULL
        OR source_fingerprint ~ '^[a-f0-9]{64}$'
    );

ALTER TABLE public.incidencia_estadistica
    ADD CONSTRAINT incidencia_estadistica_source_fingerprint_pair_chk
    CHECK (
        (
            source_fingerprint IS NULL
            AND source_fingerprint_version IS NULL
        )
        OR
        (
            source_fingerprint IS NOT NULL
            AND source_fingerprint_version IS NOT NULL
        )
    );

-- ============================================================
-- 5. INTENTIONALLY DEFERRED
-- ============================================================
--
-- NO historical UPDATE
-- NO historical DELETE
-- NO NOT NULL on dataset_id
-- NO NOT NULL on source_fingerprint
-- NO UNIQUE(source_fingerprint)
-- NO ON CONFLICT behavior
--
-- These controls are enabled only after validated historical
-- reconciliation and controlled backfill.

COMMIT;