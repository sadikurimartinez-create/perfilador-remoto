-- SCINCE PRODUCTIVO / INEGI TERRITORIAL
-- Additive storage for official INEGI geography and census datasets.

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.inegi_territorial_dataset (
    dataset_id text PRIMARY KEY,
    provider_id text NOT NULL CHECK (provider_id = 'INEGI'),
    product_name text NOT NULL,
    reference_year integer NOT NULL CHECK (reference_year >= 1900),
    version text NOT NULL,
    state_code varchar(2) NOT NULL CHECK (state_code ~ '^[0-9]{2}$'),
    geography_source_url text NOT NULL CHECK (geography_source_url LIKE 'https://www.inegi.org.mx/%'),
    geography_sha256 char(64) NOT NULL CHECK (geography_sha256 ~ '^[0-9a-f]{64}$'),
    census_source_url text NOT NULL CHECK (census_source_url LIKE 'https://www.inegi.org.mx/%'),
    census_sha256 char(64) NOT NULL CHECK (census_sha256 ~ '^[0-9a-f]{64}$'),
    imported_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamptz,
    status text NOT NULL CHECK (status IN ('IMPORTING', 'READY', 'FAILED')),
    geography_feature_count integer NOT NULL DEFAULT 0 CHECK (geography_feature_count >= 0),
    demographic_record_count integer NOT NULL DEFAULT 0 CHECK (demographic_record_count >= 0),
    import_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (state_code, geography_sha256, census_sha256),
    CHECK (status <> 'READY' OR (
        geography_feature_count > 0
        AND demographic_record_count > 0
        AND completed_at IS NOT NULL
    ))
);

CREATE TABLE IF NOT EXISTS public.inegi_territorial_geography (
    geography_id bigserial PRIMARY KEY,
    dataset_id text NOT NULL REFERENCES public.inegi_territorial_dataset(dataset_id) ON DELETE RESTRICT,
    geographic_level text NOT NULL CHECK (geographic_level IN ('ESTADO', 'MUNICIPIO', 'LOCALIDAD', 'AGEB', 'MANZANA')),
    cve_ent varchar(2) NOT NULL CHECK (cve_ent ~ '^[0-9]{2}$'),
    cve_mun varchar(3) CHECK (cve_mun IS NULL OR cve_mun ~ '^[0-9]{3}$'),
    cve_loc varchar(4) CHECK (cve_loc IS NULL OR cve_loc ~ '^[0-9]{4}$'),
    cve_ageb varchar(4) CHECK (cve_ageb IS NULL OR cve_ageb ~ '^[0-9A-Z]{4}$'),
    cve_mza varchar(3) CHECK (cve_mza IS NULL OR cve_mza ~ '^[0-9]{3}$'),
    geographic_name text,
    source_cvegeo text NOT NULL,
    geom geometry(MultiPolygon, 4326) NOT NULL,
    UNIQUE (dataset_id, geographic_level, source_cvegeo),
    CHECK (
        (geographic_level = 'ESTADO' AND cve_mun IS NULL AND cve_loc IS NULL AND cve_ageb IS NULL AND cve_mza IS NULL)
        OR (geographic_level = 'MUNICIPIO' AND cve_mun IS NOT NULL AND cve_loc IS NULL AND cve_ageb IS NULL AND cve_mza IS NULL)
        OR (geographic_level = 'LOCALIDAD' AND cve_mun IS NOT NULL AND cve_loc IS NOT NULL AND cve_ageb IS NULL AND cve_mza IS NULL)
        OR (geographic_level = 'AGEB' AND cve_mun IS NOT NULL AND cve_loc IS NOT NULL AND cve_ageb IS NOT NULL AND cve_mza IS NULL)
        OR (geographic_level = 'MANZANA' AND cve_mun IS NOT NULL AND cve_loc IS NOT NULL AND cve_ageb IS NOT NULL AND cve_mza IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.inegi_territorial_demographics (
    dataset_id text NOT NULL REFERENCES public.inegi_territorial_dataset(dataset_id) ON DELETE RESTRICT,
    geographic_level text NOT NULL CHECK (geographic_level IN ('AGEB', 'MANZANA')),
    cve_ent varchar(2) NOT NULL CHECK (cve_ent ~ '^[0-9]{2}$'),
    cve_mun varchar(3) NOT NULL CHECK (cve_mun ~ '^[0-9]{3}$'),
    cve_loc varchar(4) NOT NULL CHECK (cve_loc ~ '^[0-9]{4}$'),
    cve_ageb varchar(4) NOT NULL CHECK (cve_ageb ~ '^[0-9A-Z]{4}$'),
    cve_mza varchar(3) CHECK (cve_mza IS NULL OR cve_mza ~ '^[0-9]{3}$'),
    pobtot integer CHECK (pobtot IS NULL OR pobtot >= 0),
    vivtot integer CHECK (vivtot IS NULL OR vivtot >= 0),
    vivpar_hab integer CHECK (vivpar_hab IS NULL OR vivpar_hab >= 0),
    vivpar_deshab integer CHECK (vivpar_deshab IS NULL OR vivpar_deshab >= 0),
    source_row_key text NOT NULL,
    source_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (dataset_id, geographic_level, source_row_key),
    CHECK (
        (geographic_level = 'AGEB' AND cve_mza IS NULL)
        OR (geographic_level = 'MANZANA' AND cve_mza IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_inegi_territorial_geography_geom
    ON public.inegi_territorial_geography USING gist (geom);
CREATE INDEX IF NOT EXISTS idx_inegi_territorial_geography_lookup
    ON public.inegi_territorial_geography
    (dataset_id, geographic_level, cve_ent, cve_mun, cve_loc, cve_ageb, cve_mza);
CREATE INDEX IF NOT EXISTS idx_inegi_territorial_geography_dataset_level
    ON public.inegi_territorial_geography (dataset_id, geographic_level);
CREATE INDEX IF NOT EXISTS idx_inegi_territorial_geography_municipality
    ON public.inegi_territorial_geography (dataset_id, cve_ent, cve_mun);
CREATE INDEX IF NOT EXISTS idx_inegi_territorial_geography_locality
    ON public.inegi_territorial_geography (dataset_id, cve_ent, cve_mun, cve_loc);
CREATE INDEX IF NOT EXISTS idx_inegi_territorial_geography_ageb
    ON public.inegi_territorial_geography (dataset_id, cve_ent, cve_mun, cve_loc, cve_ageb);
CREATE INDEX IF NOT EXISTS idx_inegi_territorial_demographics_lookup
    ON public.inegi_territorial_demographics
    (dataset_id, geographic_level, cve_ent, cve_mun, cve_loc, cve_ageb, cve_mza);
CREATE INDEX IF NOT EXISTS idx_inegi_territorial_demographics_dataset_level
    ON public.inegi_territorial_demographics (dataset_id, geographic_level);
CREATE INDEX IF NOT EXISTS idx_inegi_territorial_dataset_ready
    ON public.inegi_territorial_dataset (state_code, status, imported_at DESC);

COMMIT;
