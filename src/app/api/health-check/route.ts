import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { searchPlacesAround } from "@/lib/googlePlaces";
import { searchDenueAround } from "@/lib/denueInegi";
import { getPool } from "@/lib/db";
import { ApiOrchestrator } from "@/lib/providers/orchestrator";

type ServiceStatus = {
  id: string;
  name: string;
  status: "ok" | "error";
  latencyMs: number | null;
  errorMessage?: string;
};

export async function GET() {
  const services: ServiceStatus[] = [];

  // Coordenadas arbitrarias en Aguascalientes
  const testLat = 21.8818;
  const testLng = -102.2950;

  // Google Places (usa GOOGLE_MAPS_API_KEY vía searchPlacesAround)
  {
    const started = Date.now();
    try {
      await searchPlacesAround(testLat, testLng, 10);
      services.push({
        id: "places",
        name: "Google Places API",
        status: "ok",
        latencyMs: Date.now() - started,
      });
    } catch (error) {
      services.push({
        id: "places",
        name: "Google Places API",
        status: "error",
        latencyMs: Date.now() - started,
        errorMessage:
          error instanceof Error ? error.message : "Error desconocido en Places",
      });
    }
  }

  // Google Geocoding
  {
    const started = Date.now();
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      services.push({
        id: "geocoding",
        name: "Google Geocoding API",
        status: "error",
        latencyMs: null,
        errorMessage: "Falta GOOGLE_MAPS_API_KEY en variables de entorno.",
      });
    } else {
      try {
        const url = new URL(
          "https://maps.googleapis.com/maps/api/geocode/json"
        );
        url.searchParams.set("latlng", `${testLat},${testLng}`);
        url.searchParams.set("key", key);
        const res = await fetch(url.toString());
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        services.push({
          id: "geocoding",
          name: "Google Geocoding API",
          status: "ok",
          latencyMs: Date.now() - started,
        });
      } catch (error) {
        services.push({
          id: "geocoding",
          name: "Google Geocoding API",
          status: "error",
          latencyMs: Date.now() - started,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Error desconocido en Geocoding",
        });
      }
    }
  }

  // Google Cloud Vision (ping simple)
  {
    const started = Date.now();
    const key = process.env.GOOGLE_CLOUD_VISION_API_KEY;
    if (!key) {
      services.push({
        id: "vision",
        name: "Google Cloud Vision API",
        status: "error",
        latencyMs: null,
        errorMessage: "Falta GOOGLE_CLOUD_VISION_API_KEY en variables de entorno.",
      });
    } else {
      try {
        const url =
          "https://vision.googleapis.com/v1/images:annotate?key=" + key;
        // Imagen mínima en base64 (1x1 PNG transparente)
        const tinyImage =
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YgBpssAAAAASUVORK5CYII=";
        const body = {
          requests: [
            {
              image: { content: tinyImage },
              features: [{ type: "LABEL_DETECTION", maxResults: 1 }],
            },
          ],
        };
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(
            "[health-check] Vision API error detallado:",
            res.status,
            text
          );
          throw new Error(`HTTP ${res.status}`);
        }
        services.push({
          id: "vision",
          name: "Google Cloud Vision API",
          status: "ok",
          latencyMs: Date.now() - started,
        });
      } catch (error) {
        services.push({
          id: "vision",
          name: "Google Cloud Vision API",
          status: "error",
          latencyMs: Date.now() - started,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Error desconocido en Vision",
        });
      }
    }
  }

  // Vertex AI (Gemini)
  {
    const started = Date.now();
    if (!GCP_PROJECT_ID) {
      services.push({
        id: "gemini",
        name: "Vertex AI (Gemini)",
        status: "error",
        latencyMs: null,
        errorMessage: "Falta GCP_PROJECT_ID en variables de entorno para Vertex AI.",
      });
    } else {
      try {
        const authOptions = GCP_PRIVATE_KEY
          ? {
              credentials: {
                client_email: GCP_CLIENT_EMAIL,
                private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
              },
            }
          : undefined;

        const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION, googleAuthOptions: authOptions });
        const model = vertexAI.getGenerativeModel({ model: GEMINI_MODEL });
        await model.generateContent("ping");
        services.push({
          id: "gemini",
          name: "Vertex AI (Gemini)",
          status: "ok",
          latencyMs: Date.now() - started,
        });
      } catch (error) {
        console.error("[health-check] Vertex AI error detallado:", error);
        services.push({
          id: "gemini",
          name: "Vertex AI (Gemini)",
          status: "error",
          latencyMs: Date.now() - started,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Error desconocido en Vertex AI",
        });
      }
    }
  }

  // INEGI DENUE
  {
    const started = Date.now();
    const token = process.env.INEGI_DENUE_TOKEN;
    if (!token) {
      services.push({
        id: "denue",
        name: "INEGI DENUE API",
        status: "error",
        latencyMs: null,
        errorMessage: "Falta INEGI_DENUE_TOKEN en variables de entorno.",
      });
    } else {
      try {
        await searchDenueAround(testLat, testLng, 10);
        services.push({
          id: "denue",
          name: "INEGI DENUE API",
          status: "ok",
          latencyMs: Date.now() - started,
        });
      } catch (error) {
        services.push({
          id: "denue",
          name: "INEGI DENUE API",
          status: "error",
          latencyMs: Date.now() - started,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Error desconocido en DENUE",
        });
      }
    }
  }

  // PostgreSQL / PostGIS
  {
    const started = Date.now();
    try {
      await getPool().query("SELECT ST_AsText(ST_MakePoint(0, 0))");
      services.push({
        id: "postgres",
        name: "PostgreSQL / PostGIS",
        status: "ok",
        latencyMs: Date.now() - started,
      });
    } catch (error) {
      services.push({
        id: "postgres",
        name: "PostgreSQL / PostGIS",
        status: "error",
        latencyMs: Date.now() - started,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Error desconocido en PostgreSQL/PostGIS",
      });
    }
  }

  // Orquestador de Proveedores - Diagnósticos Unificados
  const providersReport: any[] = [];
  {
    try {
      const orchestrator = new ApiOrchestrator();
      const providerChecks = await orchestrator.runHealthChecks();
      
      Object.entries(providerChecks).forEach(([id, check]) => {
        // Enforce backward compatibility for standard services list
        services.push({
          id: `provider-${id}`,
          name: `Proveedor Unificado: ${id.toUpperCase()}`,
          status: check.isHealthy ? "ok" : "error",
          latencyMs: check.latencyMs !== undefined ? check.latencyMs : null,
          errorMessage: check.isHealthy ? undefined : (check.details || "Discapacitado o sin conexión")
        });

        // Enforce expanded reporting fields for all 13 providers as requested
        providersReport.push({
          proveedor: id,
          estado: check.isHealthy ? "ok" : "error",
          tiempo_de_respuesta: `${check.latencyMs !== undefined ? check.latencyMs : 0}ms`,
          autenticacion: check.authenticationStatus || (check.isHealthy ? "valid" : "invalid"),
          expiracion_del_token: check.tokenExpiration || null,
          disponibilidad: check.availability !== undefined ? check.availability : (check.isHealthy ? 100 : 0),
          numero_de_registros: check.recordsCount || 0
        });
      });
    } catch (error: any) {
      services.push({
        id: "orchestrator",
        name: "Orquestador de APIs (Fallo)",
        status: "error",
        latencyMs: null,
        errorMessage: error.message || String(error)
      });
    }
  }

  return NextResponse.json(
    {
      timestamp: new Date().toISOString(),
      services,
      providers: providersReport
    },
    { status: 200 }
  );
}
