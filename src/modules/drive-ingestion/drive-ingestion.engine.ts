import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { DriveIngestionService, DriveFileRecord } from "./drive-ingestion.service";
import { getPool } from "@/lib/db";

export interface ExtractedIntelligence {
  fileId: string;
  fileName: string;
  logicalCategory: string;
  extractedText: string;
  summary: string;
  riskLevel: string;
  entities: {
    names: string[];
    aliases: string[];
    organizations: string[];
    locations: Array<{
      name: string;
      lat: number | null;
      lng: number | null;
      description: string;
    }>;
    phoneNumbers: string[];
    plates: string[];
    additionalAttributes: Record<string, any>;
  };
  correlationSuggestions: Array<{
    targetType: string; // 'pandilla' | 'persona' | 'zona' | 'vehiculo'
    targetName: string;
    reason: string;
  }>;
}

/**
 * DriveIngestionEngine orchestrates the secure downloading, parsing with Vertex AI (Gemini Multimodal),
 * intelligence extraction, and DB archiving of ingestable files.
 */
export class DriveIngestionEngine {
  /**
   * Safe initialization of PostgreSQL Tables for storing processed intelligence.
   */
  public static async ensureTablesExists(): Promise<void> {
    await DriveIngestionService.ensureTrackingTableExists();
    const pool = getPool();
    const queryStr = `
      CREATE TABLE IF NOT EXISTS drive_ingested_intelligence (
        file_id VARCHAR(255) PRIMARY KEY REFERENCES drive_ingestion_log(file_id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        logical_category VARCHAR(100) NOT NULL,
        extracted_text TEXT,
        entities JSONB,
        risk_level VARCHAR(50),
        summary TEXT,
        correlation_suggestions JSONB,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `;
    try {
      await pool.query(queryStr);
      console.log("[DriveIngestionEngine] Tabla drive_ingested_intelligence verificada/creada.");
    } catch (err) {
      console.error("[DriveIngestionEngine] Error al crear la tabla drive_ingested_intelligence:", err);
      throw err;
    }
  }

  /**
   * Runs the full secure ingestion pipeline.
   * Scans Google Drive, filters duplicates, downloads files securely, processes via AI, and saves intelligence.
   */
  public static async runPipeline(): Promise<{
    scannedCount: number;
    ingestedCount: number;
    failedCount: number;
    details: Array<{ fileId: string; fileName: string; status: string; category: string; error?: string }>;
  }> {
    await this.ensureTablesExists();

    const details: any[] = [];
    let scannedCount = 0;
    let ingestedCount = 0;
    let failedCount = 0;

    try {
      // 1. List all safe files in Google Drive folder
      const allFiles = await DriveIngestionService.listIngestableFiles();
      scannedCount = allFiles.length;

      console.log(`[DriveIngestionEngine] Se detectaron ${scannedCount} archivos elegibles en la carpeta configurada.`);

      // 2. Filter files to process only new, pending, or failed ones
      for (const file of allFiles) {
        const currentLog = await DriveIngestionService.getFileStatus(file.id);

        if (currentLog && currentLog.status === "processed") {
          // Skip already processed files (duplicate control)
          continue;
        }

        console.log(`[DriveIngestionEngine] Procesando archivo nuevo/pendiente: "${file.name}" (ID: ${file.id}) en la categoría [${file.logicalCategory}]`);

        try {
          // Mark as pending immediately to avoid race conditions or dual triggers
          await DriveIngestionService.setFileStatus(file.id, file.name, "pending", file.logicalCategory);

          // 3. Process individual file through the AI analysis pipeline
          await this.processSingleFile(file);

          ingestedCount++;
          details.push({
            fileId: file.id,
            fileName: file.name,
            status: "processed",
            category: file.logicalCategory,
          });
        } catch (err: any) {
          failedCount++;
          console.error(`❌ [DriveIngestionEngine] Error procesando archivo "${file.name}":`, err);
          
          // Register failure securely in logs without exposing tokens or keys
          await DriveIngestionService.setFileStatus(
            file.id,
            file.name,
            "failed",
            file.logicalCategory,
            err.message || "Error desconocido de procesamiento"
          );

          details.push({
            fileId: file.id,
            fileName: file.name,
            status: "failed",
            category: file.logicalCategory,
            error: err.message || "Error interno de procesamiento",
          });
        }
      }
    } catch (globalErr: any) {
      console.error("[DriveIngestionEngine] Error crítico global en la ejecución del pipeline:", globalErr);
      throw globalErr;
    }

    return {
      scannedCount,
      ingestedCount,
      failedCount,
      details,
    };
  }

  /**
   * Processes a single Drive file: downloads, passes to Gemini, extracts entities, and saves.
   */
  private static async processSingleFile(file: DriveFileRecord): Promise<void> {
    // 1. Secure download with strict geofencing check
    const { buffer, fileMeta } = await DriveIngestionService.downloadFileContent(file.id);

    // 2. Invoke Vertex AI Gemini for Multimodal Extraction
    if (!GCP_PROJECT_ID) {
      throw new Error("No se puede ejecutar procesamiento de IA porque GCP_PROJECT_ID no está configurado.");
    }

    const authOptions = GCP_PRIVATE_KEY
      ? {
          credentials: {
            client_email: GCP_CLIENT_EMAIL,
            private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
          },
        }
      : undefined;

    const vertexAI = new VertexAI({
      project: GCP_PROJECT_ID,
      location: GCP_LOCATION,
      googleAuthOptions: authOptions,
    });

    const model = vertexAI.getGenerativeModel({
      model: GEMINI_MODEL,
    });

    const systemPrompt = `
      Eres un Arquitecto de Datos y Agente de Inteligencia de Elite adscrito al Centro de Estudios y Política Criminal (CEIPOL).
      Tu misión es analizar el archivo multimedia inyectado y realizar un barrido completo de inteligencia OSINT y GEOINT.

      DEBES REALIZAR LAS SIGUIENTES OPERACIONES:
      1. OCR / Transcripción Completa: Extrae todo el texto visible (en imágenes/PDF) o transcribe el audio/video si es contenido multimedia.
      2. Extracción de Entidades Tácticas:
         - Nombres de personas sospechosas o de interés.
         - Alias, apodos o distintivos.
         - Organizaciones, bandas, clicas o pandillas mencionadas.
         - Ubicaciones geográficas, colonias, cruces de calles, fraccionamientos en Aguascalientes, México.
         - Números de teléfono.
         - Placas de vehículos, números de serie, marcas y modelos de autos.
      3. Estimación GEOINT en Aguascalientes:
         - Si se mencionan calles o colonias, busca aproximar coordenadas geográficas válidas para Aguascalientes (cerca de lat: 21.88, lng: -102.29).
         - Si no hay suficiente detalle, pon lat: null, lng: null.
      4. Clasificación Lógica y Resumen Táctico:
         - Clasifica el nivel de riesgo: Bajo, Medio, Alto o Crítico.
         - Genera un resumen analítico severo sobre el contenido.
      5. Sugerencias de Correlación:
         - Sugiere asociaciones de este archivo con pandillas conocidas, zonas de conflicto o sospechosos recurrentes en el estado.

      DEBES responder ÚNICA Y EXCLUSIVAMENTE con un objeto JSON válido con la siguiente estructura (Sin bloques markdown, sin texto adicional):
      {
        "extractedText": "Texto completo extraído o transcripción",
        "summary": "Resumen táctico del archivo",
        "riskLevel": "Bajo | Medio | Alto | Crítico",
        "entities": {
          "names": ["Nombre 1", "Nombre 2"],
          "aliases": ["Alias 1", "Alias 2"],
          "organizations": ["Organizacion 1"],
          "locations": [
            { "name": "Colonia/Calle...", "lat": 21.8821, "lng": -102.2932, "description": "Por qué es relevante esta ubicación" }
          ],
          "phoneNumbers": ["449..."],
          "plates": ["Placa/Vehículo..."],
          "additionalAttributes": {}
        },
        "correlationSuggestions": [
          { "targetType": "pandilla | persona | zona | vehiculo", "targetName": "Nombre objetivo", "reason": "Razón analítica de correlación" }
        ]
      }
    `;

    // Package file content for Vertex AI inline upload
    const filePart = {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: fileMeta.mimeType,
      },
    };

    console.log(`[DriveIngestionEngine] Enviando "${fileMeta.name}" (${fileMeta.mimeType}) a Gemini para análisis...`);

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemPrompt }, filePart] }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
    
    let parsedIntelligence: any;
    try {
      parsedIntelligence = JSON.parse(cleanJson);
    } catch (parseErr) {
      console.error("[DriveIngestionEngine] Error parseando respuesta JSON de Gemini. Respuesta cruda:", responseText);
      throw new Error("La IA no devolvió un JSON válido para la extracción de inteligencia.");
    }

    // 3. Save intelligence securely to database
    const pool = getPool();
    const queryStr = `
      INSERT INTO drive_ingested_intelligence (
        file_id, file_name, logical_category, extracted_text, entities, risk_level, summary, correlation_suggestions
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (file_id) DO UPDATE
      SET extracted_text = EXCLUDED.extracted_text,
          entities = EXCLUDED.entities,
          risk_level = EXCLUDED.risk_level,
          summary = EXCLUDED.summary,
          correlation_suggestions = EXCLUDED.correlation_suggestions;
    `;

    await pool.query(queryStr, [
      fileMeta.id,
      fileMeta.name,
      fileMeta.logicalCategory,
      parsedIntelligence.extractedText || "",
      JSON.stringify(parsedIntelligence.entities || {}),
      parsedIntelligence.riskLevel || "Medio",
      parsedIntelligence.summary || "",
      JSON.stringify(parsedIntelligence.correlationSuggestions || []),
    ]);

    // 4. Update the tracking status log to 'processed'
    await DriveIngestionService.setFileStatus(
      fileMeta.id,
      fileMeta.name,
      "processed",
      fileMeta.logicalCategory,
      undefined,
      {
        processedAt: new Date().toISOString(),
        entitiesExtracted: Object.keys(parsedIntelligence.entities || {}).length,
      }
    );

    console.log(`✅ [DriveIngestionEngine] Archivo "${fileMeta.name}" procesado e indexado con éxito.`);
  }

  /**
   * Retrieves all ingested intelligence records for mapping, analytics or correlation modules.
   */
  public static async getIngestedIntelligence(category?: string): Promise<ExtractedIntelligence[]> {
    await this.ensureTablesExists();
    const pool = getPool();
    let queryStr = "SELECT file_id, file_name, logical_category, extracted_text, entities, risk_level, summary, correlation_suggestions FROM drive_ingested_intelligence";
    const params: string[] = [];

    if (category) {
      queryStr += " WHERE logical_category = $1";
      params.push(category);
    }

    queryStr += " ORDER BY created_at DESC";

    const res = await pool.query(queryStr, params);

    return res.rows.map((row) => ({
      fileId: row.file_id,
      fileName: row.file_name,
      logicalCategory: row.logical_category,
      extractedText: row.extracted_text,
      summary: row.summary,
      riskLevel: row.risk_level,
      entities: typeof row.entities === "string" ? JSON.parse(row.entities) : row.entities,
      correlationSuggestions: typeof row.correlation_suggestions === "string" ? JSON.parse(row.correlation_suggestions) : row.correlation_suggestions,
    }));
  }
}
