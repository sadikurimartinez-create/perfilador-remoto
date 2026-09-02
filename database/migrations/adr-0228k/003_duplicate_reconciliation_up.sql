-- ADR-022.8K
-- 003 - CANONICAL DEDUPLICATION + REVERSIBLE FORENSIC BACKUP
-- REVIEW ONLY - DO NOT EXECUTE UNTIL AUTHORIZED

BEGIN;

DO $$
DECLARE
    incidence_count bigint;
    lineage_count bigint;
    duplicate_groups bigint;
    duplicate_rows bigint;
BEGIN
    SELECT COUNT(*)
    INTO incidence_count
    FROM public.incidencia_estadistica;

    SELECT COUNT(*)
    INTO lineage_count
    FROM public.crime_incidence_dataset_records;

    SELECT COUNT(*)
    INTO duplicate_groups
    FROM (
        SELECT source_fingerprint
        FROM public.incidencia_estadistica
        WHERE source_fingerprint IS NOT NULL
        GROUP BY source_fingerprint
        HAVING COUNT(*) > 1
    ) q;

    SELECT COALESCE(SUM(copies),0)
    INTO duplicate_rows
    FROM (
        SELECT COUNT(*) AS copies
        FROM public.incidencia_estadistica
        WHERE source_fingerprint IS NOT NULL
        GROUP BY source_fingerprint
        HAVING COUNT(*) > 1
    ) q;

    IF incidence_count <> 1427 THEN
        RAISE EXCEPTION
            'ADR0228K_003_PRECHECK: incidence count %',
            incidence_count;
    END IF;

    IF lineage_count <> 1427 THEN
        RAISE EXCEPTION
            'ADR0228K_003_PRECHECK: lineage count %',
            lineage_count;
    END IF;

    IF duplicate_groups <> 1 OR duplicate_rows <> 2 THEN
        RAISE EXCEPTION
            'ADR0228K_003_PRECHECK: duplicate groups %, rows %',
            duplicate_groups,
            duplicate_rows;
    END IF;
END
$$;

CREATE TABLE public.crime_incidence_reconciliation_backup (
    migration_key text PRIMARY KEY,
    removed_id uuid NOT NULL,
    keeper_id uuid NOT NULL,

    incidente text NOT NULL,
    fecha date NOT NULL,
    hora time NOT NULL,
    rango_horario text,
    nom_asen text,
    fuente_archivo text,
    created_at timestamptz NOT NULL,
    geometria geography(Point,4326) NOT NULL,

    dataset_id uuid,
    source_fingerprint varchar(64),
    source_fingerprint_version varchar(32),

    backed_up_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crime_incidence_dataset_record_relink_backup (
    dataset_record_id uuid PRIMARY KEY,
    original_incidence_id uuid NOT NULL,
    keeper_incidence_id uuid NOT NULL
);

WITH ranked AS (
    SELECT
        i.*,
        FIRST_VALUE(i.id) OVER (
            PARTITION BY i.source_fingerprint
            ORDER BY i.created_at ASC, i.id ASC
        ) AS keeper_id,
        ROW_NUMBER() OVER (
            PARTITION BY i.source_fingerprint
            ORDER BY i.created_at ASC, i.id ASC
        ) AS rn
    FROM public.incidencia_estadistica i
    WHERE i.source_fingerprint IN (
        SELECT source_fingerprint
        FROM public.incidencia_estadistica
        GROUP BY source_fingerprint
        HAVING COUNT(*) = 2
    )
)
INSERT INTO public.crime_incidence_reconciliation_backup (
    migration_key,
    removed_id,
    keeper_id,
    incidente,
    fecha,
    hora,
    rango_horario,
    nom_asen,
    fuente_archivo,
    created_at,
    geometria,
    dataset_id,
    source_fingerprint,
    source_fingerprint_version
)
SELECT
    'ADR-022.8K-003',
    id,
    keeper_id,
    incidente,
    fecha,
    hora,
    rango_horario,
    nom_asen,
    fuente_archivo,
    created_at,
    geometria,
    dataset_id,
    source_fingerprint,
    source_fingerprint_version
FROM ranked
WHERE rn = 2;

INSERT INTO public.crime_incidence_dataset_record_relink_backup (
    dataset_record_id,
    original_incidence_id,
    keeper_incidence_id
)
SELECT
    r.id,
    r.incidence_id,
    b.keeper_id
FROM public.crime_incidence_dataset_records r
CROSS JOIN public.crime_incidence_reconciliation_backup b
WHERE b.migration_key = 'ADR-022.8K-003'
  AND r.incidence_id = b.removed_id;

UPDATE public.crime_incidence_dataset_records r
SET incidence_id = b.keeper_id
FROM public.crime_incidence_reconciliation_backup b
WHERE b.migration_key = 'ADR-022.8K-003'
  AND r.incidence_id = b.removed_id;

DELETE FROM public.incidencia_estadistica i
USING public.crime_incidence_reconciliation_backup b
WHERE b.migration_key = 'ADR-022.8K-003'
  AND i.id = b.removed_id;

ALTER TABLE public.incidencia_estadistica
    ADD CONSTRAINT incidencia_estadistica_source_fingerprint_uq
    UNIQUE (source_fingerprint);

DO $$
DECLARE
    incidence_count bigint;
    unique_fp_count bigint;
    duplicate_groups bigint;
    lineage_count bigint;
    backup_count bigint;
    relink_backup_count bigint;
BEGIN
    SELECT COUNT(*)
    INTO incidence_count
    FROM public.incidencia_estadistica;

    SELECT COUNT(DISTINCT source_fingerprint)
    INTO unique_fp_count
    FROM public.incidencia_estadistica;

    SELECT COUNT(*)
    INTO duplicate_groups
    FROM (
        SELECT source_fingerprint
        FROM public.incidencia_estadistica
        GROUP BY source_fingerprint
        HAVING COUNT(*) > 1
    ) q;

    SELECT COUNT(*)
    INTO lineage_count
    FROM public.crime_incidence_dataset_records;

    SELECT COUNT(*)
    INTO backup_count
    FROM public.crime_incidence_reconciliation_backup
    WHERE migration_key = 'ADR-022.8K-003';

    SELECT COUNT(*)
    INTO relink_backup_count
    FROM public.crime_incidence_dataset_record_relink_backup;

    IF incidence_count <> 1426 THEN
        RAISE EXCEPTION
            'ADR0228K_003_POSTCHECK: incidence count %',
            incidence_count;
    END IF;

    IF unique_fp_count <> 1426 THEN
        RAISE EXCEPTION
            'ADR0228K_003_POSTCHECK: unique fingerprint count %',
            unique_fp_count;
    END IF;

    IF duplicate_groups <> 0 THEN
        RAISE EXCEPTION
            'ADR0228K_003_POSTCHECK: duplicate groups %',
            duplicate_groups;
    END IF;

    IF lineage_count <> 1427 THEN
        RAISE EXCEPTION
            'ADR0228K_003_POSTCHECK: lineage count %',
            lineage_count;
    END IF;

    IF backup_count <> 1 THEN
        RAISE EXCEPTION
            'ADR0228K_003_POSTCHECK: backup count %',
            backup_count;
    END IF;

    IF relink_backup_count <> 1 THEN
        RAISE EXCEPTION
            'ADR0228K_003_POSTCHECK: relink backup count %',
            relink_backup_count;
    END IF;
END
$$;

COMMIT;
