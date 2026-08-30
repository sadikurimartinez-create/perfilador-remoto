export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { fuseGangsAndBuildGraph, matchPandillasDatasetRows } from "@/modules/pandillas/pandillas.fusion";
import { GangEntity } from "@/modules/pandillas/pandillas.mapper";
import { validateGeoIntegrity } from "@/utils/geoIntegrityEngine";

async function callGeminiRestApi(prompt: string, modelName: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini REST API returned ${response.status}: ${errText}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text returned from Gemini REST API.");
  return text;
}

function sourceCoordinatesFromMatchedRows(
  rows: { Lat?: string | number; Lng?: string | number; Calle?: string; No?: string; Colonia?: string }[]
): { lat: number; lng: number; descripcion: string }[] {
  return rows.flatMap((row) => {
    const lat = typeof row.Lat === "number" ? row.Lat : Number(row.Lat);
    const lng = typeof row.Lng === "number" ? row.Lng : Number(row.Lng);
    const validation = validateGeoIntegrity({ latitude: lat, longitude: lng, source: "SOURCE_RECORD" });

    if (validation.latitude === null || validation.longitude === null || !validation.reportableAsObservedGeoint) {
      return [];
    }

    return [{
      lat: validation.latitude,
      lng: validation.longitude,
      descripcion: `${row.Calle || ""} ${row.No || ""}, Col. ${row.Colonia || ""}, Aguascalientes`.trim(),
    }];
  });
}

function overwriteAiSpatialOutputWithSourceCoordinates(parsedResult: any, seedAddresses: any[]): any {
  const geolocalizacion = sourceCoordinatesFromMatchedRows(seedAddresses);
  return {
    ...parsedResult,
    mapa: {
      ...(parsedResult?.mapa || {}),
      geolocalizacion,
      areasCalientes: geolocalizacion.map((point) => ({
        lat: point.lat,
        lng: point.lng,
        radioMetros: 0,
        intensidad: 0,
        sourceIntegrityStatus: "OBSERVED_SOURCE_RECORD",
      })),
    },
    sourceIntegrity: {
      ...(parsedResult?.sourceIntegrity || {}),
      geolocationPolicy: geolocalizacion.length > 0 ? "SOURCE_COORDINATES_ONLY" : "GEO_UNAVAILABLE",
      aiGeneratedCoordinatesDiscarded: true,
    },
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      nombre = "",
      zonaInfluencia = "",
      antagonicas = [],
      integrantes = [],
      grafitiInfo = {},
      archivosAnexos = [],
      contextoUsuario = ""
    } = body;

    const manualGang: GangEntity = {
      nombre,
      zonaInfluencia,
      antagonicas,
      integrantes,
      grafitiInfo,
      archivosAnexos,
      estatus: body.estatus || "Activa"
    };

    // 1. CARGAR Y PARSEAR EL DATASET LOCAL DESDE EXCEL (INVENTARIO PANDILLAS.xlsx)
    const csvRows: any[] = [];
    let xlsxPath = path.join(process.cwd(), "INVENTARIO PANDILLAS.xlsx");
    
    try {
      let fileBuffer;
      try {
        fileBuffer = await fs.readFile(xlsxPath);
      } catch (e) {
        // Local Windows absolute path fallback
        xlsxPath = "C:\\Users\\sadi7\\OneDrive\\Desktop\\ECOSISTEMA SAI\\PERFIL REMOTO\\INVENTARIO PANDILLAS.xlsx";
        fileBuffer = await fs.readFile(xlsxPath);
      }
      
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawAoA = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      // Data rows start from index 2 (row 0 is main headers, row 1 is sub-headers)
      for (let i = 2; i < rawAoA.length; i++) {
        const row = rawAoA[i];
        if (!row || row.length === 0) continue;
        
        csvRows.push({
          AreaInfluencia: String(row[0] || "").trim(),
          Pandilla: String(row[1] || "").trim(),
          Posicion: String(row[2] || "").trim(),
          Nombre: `${String(row[3] || "").trim()} ${String(row[4] || "").trim()}`.trim(),
          ApPaterno: String(row[5] || "").trim(),
          ApMaterno: String(row[6] || "").trim(),
          Alias: `${String(row[7] || "").trim()} ${String(row[8] || "").trim()}`.trim(),
          Ingresos: String(row[9] || "").trim(),
          Detenido: String(row[10] || "").trim(),
          Delito: [row[11], row[12], row[13], row[14]].filter(Boolean).map(d => String(d).trim()).join(", ") || "",
          Observaciones: String(row[15] || "").trim(),
          Calle: String(row[16] || "").trim(),
          No: String(row[17] || "").trim(),
          Colonia: String(row[18] || "").trim(),
          Municipio: "Aguascalientes",
          Estado: "Aguascalientes",
          Lat: row[26] !== undefined ? String(row[26]).trim() : "",
          Lng: row[27] !== undefined ? String(row[27]).trim() : ""
        });
      }
      console.log(`[API Pandillas] XLSX cargado con éxito. Total registros: ${csvRows.length}`);
    } catch (err) {
      console.warn("[API Pandillas] No se pudo leer el archivo XLSX. Continuando con datos vacíos.", err);
    }

    // 2. MATCH GEOGRÁFICO Y CORRELACIÓN DE DOMICILIOS
    // Primero intentamos emparejar por el nombre de la pandilla
    const matchesCsv = matchPandillasDatasetRows(csvRows, nombre, zonaInfluencia);

    // Limitar matches para no saturar contexto de IA (máximo 40 registros altamente representativos)
    const seedAddresses = matchesCsv.slice(0, 40);

    const todayStr = new Date().toLocaleDateString("es-MX");

    const systemPrompt = `
Eres un Arquitecto de Inteligencia Criminal y Analista OSINT de élite adscrito al Centro de Estudios y Política Criminal (CEIPOL) de Aguascalientes.
Tu tarea es analizar una pandilla o clica criminal mediante un barrido inteligente multifuente:
1. Comparación con el Dataset Local (Domicilios Pandillas.csv) inyectado como semilla de conocimiento.
2. Búsqueda en internet en tiempo real (OSINT Google Search) para correlacionar con noticias criminales, arrestos policiales, conflictos de pandillas, grafitis o marcas territoriales registradas en Aguascalientes.
3. Consolidación de identidades, jerarquías y resolución de alias.

Debes devolver ÚNICA Y EXCLUSIVAMENTE un objeto JSON válido que responda EXACTAMENTE a la siguiente estructura TS:
\`\`\`json
{
  "ficha": {
    "nombre": "Nombre principal unificado de la pandilla",
    "zona": "Sectores y colonias que domina",
    "integrantes": [
      { "nombre": "Nombre real (si se sabe)", "alias": "Alias/Apodo", "rol": "Líder, Gatillero, Puntero, Reclutador, etc." }
    ],
    "estructuraJerarquica": "Piramidal | Horizontal | Celular | Desorganizada",
    "descripcionEstructura": "Explicación táctica detallada en 2-3 líneas",
    "nivelRiesgo": "Bajo | Medio | Alto | Crítico",
    "resumenInteligencia": "Diagnóstico táctico completo y severo del grupo, sus tácticas, modus operandi e historial",
    "crossCheckJuridico": "Evaluación jurídica preliminar en base al Código Penal de Aguascalientes y Ley de Delincuencia Organizada"
  },
  "mapa": {
    "geolocalizacion": [
      { "lat": 21.88, "lng": -102.29, "descripcion": "Descripción del punto de influencia detectado" }
    ],
    "areasCalientes": [
      { "lat": 21.88, "lng": -102.29, "radioMetros": 200, "intensidad": 0.8 }
    ],
    "expansionTerritorial": "Contenida | Expansión Activa | Expansión Crítica"
  },
  "grafo": {
    "nodos": [
      { "id": "ID_NODO", "label": "Etiqueta visible", "tipo": "pandilla | integrante | simbolo | zona", "grupo": "Nombre de la pandilla si pertenece", "risk": "Bajo|Medio|Alto|Crítico" }
    ],
    "enlaces": [
      { "source": "NODO_ORIGEN", "target": "NODO_DESTINO", "relacion": "conflicto | alianza | pertenece | actividad" }
    ]
  },
  "alertas": [
    { "tipo": "incidente | territorio | actor | conflicto", "severidad": "Baja | Media | Alta | Crítica", "mensaje": "Texto de la alerta analítica", "fecha": "Fecha" }
  ]
}
\`\`\`

REGLAS DE GOBERNANZA GEOESPACIAL:
- NO generes ni inventes coordenadas. La IA no está autorizada a crear puntos geográficos por colonia, narrativa o contexto.
- Si los datos semilla no contienen Lat/Lng verificables, devuelve geolocalizacion: [] y areasCalientes: [].
- Las áreas de calor sólo pueden derivarse de coordenadas fuente verificables y deben conservar la limitación de procedencia.

REGLAS DE GRAFO:
- El nodo central debe ser la Pandilla principal analizada.
- Crea enlaces tipo "pertenece" para los integrantes.
- Crea enlaces tipo "conflicto" con sus pandillas antagónicas.
- Crea enlaces tipo "actividad" con sus zonas de influencia y grafitis.
- Evita caracteres especiales en las IDs de los nodos para que el grafo renderice limpiamente.

NO agregues bloques de código Markdown como \`\`\`json. Devuelve solo la cadena JSON de texto plano que comienza con { y termina con }.
`;

    const userMessage = `
--- SOLICITUD DE ANÁLISIS DE CAMPO ---
Fecha de Operación: ${todayStr}

- Datos del Formulario Manual:
* Nombre de la Pandilla: ${nombre || "Desconocido/Por identificar"}
* Zona de Influencia Declarada: ${zonaInfluencia || "Sin zona delimitada"}
* Pandillas Antagónicas Ingresadas: ${antagonicas.join(", ") || "Ninguna registrada"}
* Integrantes Ingresados: ${JSON.stringify(integrantes)}
* Grafiti de Identificación: ${JSON.stringify(grafitiInfo)}
* Contexto y Notas del Investigador: ${contextoUsuario || "Sin anotaciones complementarias"}

- Datos Semilla Localizados en el Dataset (Domicilios Pandillas.csv) para esta zona/búsqueda:
${JSON.stringify(seedAddresses, null, 2)}

- Archivos Anexos Contextualizados:
${archivosAnexos.map((f: any) => `- Archivo: ${f.nombre} (${f.tipo}) | Contexto: ${f.contexto || "No analizado"}`).join("\n") || "Sin archivos anexos."}

--- TAREA ---
Ejecuta un barrido inteligente OSINT mediante Google Search sobre la pandilla "${nombre}" y las colonias/zonas "${zonaInfluencia}" en Aguascalientes. Correlaciona estos hallazgos con las direcciones semilla locales. Consolida todo en un objeto JSON unificado bajo la estructura solicitada. Sé riguroso y exhaustivo en tu análisis táctico.
`;

    const fullPrompt = systemPrompt + "\n\n" + userMessage;
    const useVertexAI = !!GCP_PRIVATE_KEY && GCP_PRIVATE_KEY.trim() !== "";
    
    let parsedResult: any = null;
    let isAiGenerated = false;

    if (useVertexAI) {
      try {
        const authOptions = {
          credentials: {
            client_email: GCP_CLIENT_EMAIL,
            private_key: GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
          },
        };
        const vertexAI = new VertexAI({ project: GCP_PROJECT_ID, location: GCP_LOCATION, googleAuthOptions: authOptions });
        const model = vertexAI.getGenerativeModel({
          model: GEMINI_MODEL,
          tools: [{ googleSearch: {} } as any],
        });
        
        const result = await model.generateContent({
          contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
          }
        });
        const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log("[API Pandillas] Respuesta cruda de Vertex AI recibida.");
        const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
        parsedResult = JSON.parse(cleanJson);
        isAiGenerated = true;
      } catch (vertexErr: any) {
        console.warn("[API Pandillas] Vertex AI generation failed, falling back to REST API:", vertexErr.message);
      }
    }

    if (!isAiGenerated) {
      const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
      if (apiKey) {
        try {
          console.log("[API Pandillas] Calling Gemini REST API...");
          const responseText = await callGeminiRestApi(fullPrompt, GEMINI_MODEL, apiKey);
          const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
          parsedResult = JSON.parse(cleanJson);
          isAiGenerated = true;
        } catch (restErr: any) {
          console.error("[API Pandillas] Gemini REST API fallback failed:", restErr.message);
        }
      }
    }

    if (isAiGenerated && parsedResult) {
      return NextResponse.json({ ...overwriteAiSpatialOutputWithSourceCoordinates(parsedResult, seedAddresses), isAiGenerated: true });
    } else {
      console.warn("[API Pandillas] Both Vertex AI and REST API failed. Using local deterministic model fallback.");
      const deterministicResult = fuseGangsAndBuildGraph(manualGang, [], csvRows);
      return NextResponse.json({
        ...deterministicResult,
        isAiGenerated: false,
        warning: "Fallo de servicios de IA. Usando fusión determinista local."
      });
    }

  } catch (error: any) {
    console.error("[API Pandillas] Error general en el endpoint:", error);
    return NextResponse.json(
      { error: "Error interno al procesar el análisis de pandillas.", details: error.message },
      { status: 500 }
    );
  }
}
