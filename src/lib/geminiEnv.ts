const g = typeof process !== "undefined" ? process.env : ({} as NodeJS.ProcessEnv);

// Variables para Vertex AI
export const GCP_PROJECT_ID = typeof g.GCP_PROJECT_ID === "string" && g.GCP_PROJECT_ID.trim() !== "" ? g.GCP_PROJECT_ID.trim() : "perfil-remoto";
export const GCP_LOCATION = typeof g.GCP_LOCATION === "string" && g.GCP_LOCATION.trim() ? g.GCP_LOCATION.trim() : "us-central1";

// Credenciales inyectadas directamente para Vercel (sin archivo físico)
export const GCP_CLIENT_EMAIL = (g.GCP_CLIENT_EMAIL || "").replace(/^"|"$/g, "").trim();
export const GCP_PRIVATE_KEY = (g.GCP_PRIVATE_KEY || "").replace(/^"|"$/g, "").replace(/\\n/g, "\n").trim();

/** Modelo por defecto si no se define GEMINI_MODEL en el entorno. */
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

export const GEMINI_MODEL =
  (typeof g.GEMINI_MODEL === "string" && g.GEMINI_MODEL.trim().length > 0
    ? g.GEMINI_MODEL.trim().replace(/^models\//, '')
    : DEFAULT_GEMINI_MODEL).replace(/^models\//, '');

/** Modelo secundario gobernado para failover REST P4-H. */
const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.7-flash";

export const GEMINI_FALLBACK_MODEL =
  (typeof g.GEMINI_FALLBACK_MODEL === "string" && g.GEMINI_FALLBACK_MODEL.trim().length > 0
    ? g.GEMINI_FALLBACK_MODEL.trim().replace(/^models\//, '')
    : DEFAULT_GEMINI_FALLBACK_MODEL).replace(/^models\//, '');
