-- ADR-022.8K
-- 002 DOWN - REMOVE 2025 BACKFILL AND PHYSICAL LINEAGE
-- REVIEW ONLY

BEGIN;

DO $$
DECLARE
    target_dataset_id uuid;
    lineage_count bigint;
BEGIN
    SELECT id
    INTO target_dataset_id
    FROM public.crime_incidence_datasets
    WHERE dataset_name = 'Incidencia Delictiva 911 - Robo a Negocio - Aguascalientes'
      AND dataset_version = '2025-C5I-911-v1'
      AND source_organization = 'C5i de la Secretaría de Seguridad Pública del Estado de Aguascalientes';

    IF target_dataset_id IS NULL THEN
        RAISE EXCEPTION
            'ADR0228K_002_DOWN: target dataset missing';
    END IF;

    SELECT COUNT(*)
    INTO lineage_count
    FROM public.crime_incidence_dataset_records
    WHERE dataset_id = target_dataset_id;

    IF lineage_count <> 1427 THEN
        RAISE EXCEPTION
            'ADR0228K_002_DOWN: expected 1427 lineage rows, found %',
            lineage_count;
    END IF;
END
$$;

DELETE FROM public.crime_incidence_dataset_records r
USING public.crime_incidence_datasets d
WHERE r.dataset_id = d.id
  AND d.dataset_name = 'Incidencia Delictiva 911 - Robo a Negocio - Aguascalientes'
  AND d.dataset_version = '2025-C5I-911-v1'
  AND d.source_organization = 'C5i de la Secretaría de Seguridad Pública del Estado de Aguascalientes';

UPDATE public.incidencia_estadistica i
SET
    dataset_id = NULL,
    source_fingerprint = NULL,
    source_fingerprint_version = NULL
FROM public.crime_incidence_datasets d
WHERE i.dataset_id = d.id
  AND d.dataset_name = 'Incidencia Delictiva 911 - Robo a Negocio - Aguascalientes'
  AND d.dataset_version = '2025-C5I-911-v1'
  AND d.source_organization = 'C5i de la Secretaría de Seguridad Pública del Estado de Aguascalientes';

DELETE FROM public.crime_incidence_datasets
WHERE dataset_name = 'Incidencia Delictiva 911 - Robo a Negocio - Aguascalientes'
  AND dataset_version = '2025-C5I-911-v1'
  AND source_organization = 'C5i de la Secretaría de Seguridad Pública del Estado de Aguascalientes';

DO $$
DECLARE
    governed_count bigint;
    lineage_count bigint;
BEGIN
    SELECT COUNT(*)
    INTO governed_count
    FROM public.incidencia_estadistica
    WHERE dataset_id IS NOT NULL
       OR source_fingerprint IS NOT NULL
       OR source_fingerprint_version IS NOT NULL;

    SELECT COUNT(*)
    INTO lineage_count
    FROM public.crime_incidence_dataset_records;

    IF governed_count <> 0 OR lineage_count <> 0 THEN
        RAISE EXCEPTION
            'ADR0228K_002_DOWN_POSTCHECK: governed %, lineage %',
            governed_count,
            lineage_count;
    END IF;
END
$$;

COMMIT;
