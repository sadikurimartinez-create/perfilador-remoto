-- Additive only. Execute separately under an approved administrative migration procedure.
BEGIN;
CREATE TABLE public.inegi_scince_catalog (
  catalog_version text PRIMARY KEY,
  catalog_fingerprint text NOT NULL CHECK (catalog_fingerprint ~ '^[0-9a-f]{64}$'),
  reference_year integer NOT NULL CHECK (reference_year = 2020),
  catalog jsonb NOT NULL CHECK (jsonb_typeof(catalog) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.inegi_scince_normalization_release (
  release_id text PRIMARY KEY,
  dataset_id text NOT NULL REFERENCES public.inegi_territorial_dataset(dataset_id) ON DELETE RESTRICT,
  catalog_version text NOT NULL REFERENCES public.inegi_scince_catalog(catalog_version) ON DELETE RESTRICT,
  normalization_version text NOT NULL,
  observation_set_fingerprint text NOT NULL CHECK (observation_set_fingerprint ~ '^[0-9a-f]{64}$'),
  status text NOT NULL CHECK (status IN ('IMPORTING','READY')),
  row_count integer NOT NULL CHECK (row_count > 0),
  metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_id,catalog_version,normalization_version,observation_set_fingerprint),
  UNIQUE (release_id,dataset_id)
);
-- One source unit per row. Typed observations and exact source cells remain separate JSONB structures.
CREATE TABLE public.inegi_scince_observation_set (
  release_id text NOT NULL,
  dataset_id text NOT NULL,
  geographic_level text NOT NULL CHECK (geographic_level IN ('AGEB','MANZANA')),
  source_row_key text NOT NULL,
  observations jsonb NOT NULL CHECK (jsonb_typeof(observations) = 'array' AND jsonb_array_length(observations) = 230),
  raw_source jsonb NOT NULL CHECK (jsonb_typeof(raw_source) = 'object'),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (release_id,geographic_level,source_row_key),
  FOREIGN KEY (release_id,dataset_id) REFERENCES public.inegi_scince_normalization_release(release_id,dataset_id) ON DELETE RESTRICT,
  FOREIGN KEY (dataset_id,geographic_level,source_row_key)
    REFERENCES public.inegi_territorial_demographics(dataset_id,geographic_level,source_row_key) ON DELETE RESTRICT
);
CREATE INDEX idx_scince_release_ready ON public.inegi_scince_normalization_release(dataset_id,created_at DESC,release_id DESC) WHERE status='READY';
-- No grants here. Ordinary runtime needs SELECT only, provisioned separately by release governance.
COMMIT;
