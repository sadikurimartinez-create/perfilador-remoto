-- ADR-022.8K
-- 003 DOWN - RESTORE PRE-DEDUPLICATION STATE
-- REVIEW ONLY

BEGIN;

DO $$
DECLARE
    backup_count bigint;
    relink_backup_count bigint;
BEGIN
    SELECT COUNT(*)
    INTO backup_count
    FROM public.crime_incidence_reconciliation_backup
    WHERE migration_key = 'ADR-022.8K-003';

    SELECT COUNT(*)
    INTO relink_backup_count
    FROM public.crime_incidence_dataset_record_relink_backup;

    IF backup_count <> 1 THEN
        RAISE EXCEPTION
            'ADR0228K_003_DOWN: backup count %',
            backup_count;
    END IF;

    IF relink_backup_count <> 1 THEN
        RAISE EXCEPTION
            'ADR0228K_003_DOWN: relink backup count %',
            relink_backup_count;
    END IF;
END
$$;

ALTER TABLE public.incidencia_estadistica
    DROP CONSTRAINT IF EXISTS
    incidencia_estadistica_source_fingerprint_uq;

INSERT INTO public.incidencia_estadistica (
    id,
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
    removed_id,
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
FROM public.crime_incidence_reconciliation_backup
WHERE migration_key = 'ADR-022.8K-003';

UPDATE public.crime_incidence_dataset_records r
SET incidence_id = b.original_incidence_id
FROM public.crime_incidence_dataset_record_relink_backup b
WHERE r.id = b.dataset_record_id;

DO $$
DECLARE
    incidence_count bigint;
    unique_fp_count bigint;
    duplicate_groups bigint;
    lineage_count bigint;
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
        HAVING COUNT(*) = 2
    ) q;

    SELECT COUNT(*)
    INTO lineage_count
    FROM public.crime_incidence_dataset_records;

    IF incidence_count <> 1427 THEN
        RAISE EXCEPTION
            'ADR0228K_003_DOWN_POSTCHECK: incidence count %',
            incidence_count;
    END IF;

    IF unique_fp_count <> 1426 THEN
        RAISE EXCEPTION
            'ADR0228K_003_DOWN_POSTCHECK: unique fingerprint count %',
            unique_fp_count;
    END IF;

    IF duplicate_groups <> 1 THEN
        RAISE EXCEPTION
            'ADR0228K_003_DOWN_POSTCHECK: duplicate groups %',
            duplicate_groups;
    END IF;

    IF lineage_count <> 1427 THEN
        RAISE EXCEPTION
            'ADR0228K_003_DOWN_POSTCHECK: lineage count %',
            lineage_count;
    END IF;
END
$$;

DROP TABLE public.crime_incidence_dataset_record_relink_backup;
DROP TABLE public.crime_incidence_reconciliation_backup;

COMMIT;
