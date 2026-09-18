-- E2E-006
-- DRIVE INGESTION TABLES - CONTROLLED POSTGRESQL MIGRATION
-- Apply with a migration role before enabling Drive ingestion runtime.

BEGIN;

CREATE TABLE public.drive_ingestion_log (
    file_id varchar(255) PRIMARY KEY,
    file_name varchar(255) NOT NULL,
    status varchar(50) NOT NULL,
    timestamp timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source varchar(50) DEFAULT 'drive',
    logical_category varchar(100),
    error_message text,
    metadata jsonb
);

CREATE TABLE public.drive_ingested_intelligence (
    file_id varchar(255) PRIMARY KEY
        REFERENCES public.drive_ingestion_log(file_id)
        ON DELETE CASCADE,
    file_name varchar(255) NOT NULL,
    logical_category varchar(100) NOT NULL,
    extracted_text text,
    entities jsonb,
    risk_level varchar(50),
    summary text,
    correlation_suggestions jsonb,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
