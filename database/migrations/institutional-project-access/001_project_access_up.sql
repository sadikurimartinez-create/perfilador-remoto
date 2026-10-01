-- Administrative migration only. Never copy mutable Firestore createdBy into this authority.
BEGIN;
CREATE TABLE public.institutional_project_access (
    project_id text NOT NULL CHECK (length(btrim(project_id)) > 0 AND project_id = btrim(project_id)),
    institutional_user_id text NOT NULL CHECK (length(btrim(institutional_user_id)) > 0),
    relation text NOT NULL DEFAULT 'ASSIGNED' CHECK (relation = 'ASSIGNED'),
    allowed_actions text[] NOT NULL CHECK (
        cardinality(allowed_actions) > 0 AND array_position(allowed_actions, NULL) IS NULL
        AND allowed_actions <@ ARRAY['READ', 'WRITE', 'ANALYZE_SCINCE', 'GENERATE_REPORT']::text[]
    ),
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by text NOT NULL CHECK (length(btrim(created_by)) > 0),
    revoked_at timestamptz,
    revoked_by text,
    CHECK ((revoked_at IS NULL AND revoked_by IS NULL) OR
           (revoked_at IS NOT NULL AND revoked_at >= created_at AND revoked_by IS NOT NULL AND length(btrim(revoked_by)) > 0)),
    PRIMARY KEY (project_id, institutional_user_id)
);
-- Text identity preserves compatibility with the existing string/number user ID contract.
-- Administrative assignment must verify users.id; runtime never inserts or reconciles grants.
CREATE INDEX idx_institutional_project_access_active_user
    ON public.institutional_project_access (institutional_user_id, project_id) WHERE revoked_at IS NULL;
REVOKE ALL ON public.institutional_project_access FROM PUBLIC;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ceipol_app') THEN
        REVOKE ALL ON public.institutional_project_access FROM ceipol_app;
        GRANT SELECT ON public.institutional_project_access TO ceipol_app;
    END IF;
END $$;
COMMIT;
