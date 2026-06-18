import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_GCP_PROJECT_ID || "";
const GCP_CLIENT_EMAIL = process.env.GCP_CLIENT_EMAIL || "";
const GCP_PRIVATE_KEY = process.env.GCP_PRIVATE_KEY ? process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n') : "";

export const analyzeAndLogToBigQuery = async (targetName: string, webResults: any[], aiAnalysis: any) => {
  if (!GCP_PROJECT_ID || !GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY) return;

  try {
    const auth = new GoogleAuth({
      credentials: { client_email: GCP_CLIENT_EMAIL, private_key: GCP_PRIVATE_KEY },
      projectId: GCP_PROJECT_ID,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const token = tokenResponse.token || "";

    const entitiesToLog: any[] = [];

    // 1. Análisis de Texto Pro: Natural Language API
    // Procesamos cada resultado de búsqueda (textos relacionados con Aguascalientes)
    for (const res of webResults) {
      const text = res.snippet || res.title;
      if (!text) continue;

      try {
        const nlpUrl = `https://language.googleapis.com/v1/documents:analyzeEntities`;
        const nlpRes = await axios.post(nlpUrl, {
          document: { type: "PLAIN_TEXT", content: text },
          encodingType: "UTF8"
        }, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        const entities = nlpRes.data.entities || [];
        entities.forEach((ent: any) => {
          // Extraemos automáticamente Personas, Organizaciones y Ubicaciones
          if (ent.type === 'PERSON' || ent.type === 'ORGANIZATION' || ent.type === 'LOCATION') {
            entitiesToLog.push({
              nombre_objetivo: targetName,
              entidad_detectada: ent.name,
              tipo_entidad: ent.type,
              fuente_url: res.link || "N/A",
              fecha_hallazgo: new Date().toISOString(),
              resumen_ia: text.substring(0, 500)
            });
          }
        });
      } catch (e) {
        console.error("[NLP API] Error analizando fragmento de texto:", e);
      }
    }

    // 2. Extraer vínculos y antecedentes directos detectados por el modelo analítico (Gemini/Vertex)
    if (aiAnalysis) {
      const addAiEntity = (list: string[], type: string) => {
        (list || []).forEach(name => {
          entitiesToLog.push({ nombre_objetivo: targetName, entidad_detectada: name, tipo_entidad: type, fuente_url: "Análisis IA Vertex", fecha_hallazgo: new Date().toISOString(), resumen_ia: aiAnalysis.perfilRiesgo || "Detectado por Inteligencia Artificial" });
        });
      };
      addAiEntity(aiAnalysis.vinculos, "PERSON (VÍNCULO IA)");
      addAiEntity(aiAnalysis.organizacionesVinculadas, "ORGANIZATION (VÍNCULO IA)");
      addAiEntity(aiAnalysis.antecedentesPoliciales, "ANTECEDENTE/EVENTO");
    }

    if (entitiesToLog.length === 0) return;

    // 3. Base de Datos Histórica: Inserción en BigQuery
    // -----------------------------------------------------------------------------------------
    // COMENTARIO: Esta base de datos servirá para detectar patrones de reincidencia y 
    // redes criminales en el estado, cruzando entidades, organizaciones y ubicaciones recurrentes.
    // -----------------------------------------------------------------------------------------
    const datasetId = "inteligencia_osint_cecosai";
    const tableId = "hallazgos_perfilador";
    const bqUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${GCP_PROJECT_ID}/datasets/${datasetId}/tables/${tableId}/insertAll`;

    const bqPayload = {
      skipInvalidRows: true,
      ignoreUnknownValues: true,
      rows: entitiesToLog.map(ent => ({ json: ent }))
    };

    await axios.post(bqUrl, bqPayload, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });

    console.log(`[BIGQUERY] ✅ ${entitiesToLog.length} entidades y vínculos guardados en ${datasetId}.${tableId}`);

  } catch (error: any) {
    console.error("[NLP & BIGQUERY] ❌ Error general:", error.response?.data || error.message);
  }
};