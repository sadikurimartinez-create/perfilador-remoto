export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { VertexAI } from "@google-cloud/vertexai";
import { GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } from "@/lib/geminiEnv";
import { fuseGangsAndBuildGraph } from "@/modules/pandillas/pandillas.fusion";
import { GangEntity } from "@/modules/pandillas/pandillas.mapper";

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

    // 1. CARGAR Y PARSEAR EL DATASET LOCAL (Domiclios Pandillas.csv)
    let csvRows: { Calle: string; No: string; Colonia: string; Municipio: string; Estado: string; Lat?: string; Lng?: string }[] = [];
    const csvPath = "C:\\Users\\sadi7\\OneDrive\\Desktop\\ECOSISTEMA SAI\\PERFIL REMOTO\\Domiclios Pandillas.csv";
    
    try {
      const fileContent = await fs.readFile(csvPath, "utf8");
      csvRows = parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as any[];
      console.log(`[API Pandillas] CSV cargado con éxito. Total registros: ${csvRows.length}`);
    } catch (err) {
      console.warn("[API Pandillas] No se pudo leer el archivo CSV. Continuando con datos vacíos.", err);
    }

    // 2. MATCH GEOGRÁFICO Y CORRELACIÓN DE DOMICILIOS
    // Filtramos filas del CSV que coincidan léxicamente con la zona de influencia proporcionada
    const normalizedZone = (zonaInfluencia || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let matchesCsv = csvRows;
    if (normalizedZone) {
      matchesCsv = csvRows.filter(row => {
        const col = (row.Colonia || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const calle = (row.Calle || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return col.includes(normalizedZone) || normalizedZone.includes(col) || calle.includes(normalizedZone);
      });
      // Si no hay coincidencias específicas de zona, mantenemos una selección representativa para el motor de IA
      if (matchesCsv.length === 0) {
        matchesCsv = csvRows.slice(0, 15);
      }
    } else {
      // Si no se especificó zona, pasamos las primeras 20 como semilla general de direcciones delictivas
      matchesCsv = csvRows.slice(0, 20);
    }

    // Limitar matches para no saturar contexto de IA (máximo 40 registros altamente representativos)
    const seedAddresses = matchesCsv.slice(0, 40);

    // 3. DETECTAR SI LA IA ESTÁ DISPONIBLE
    if (!GCP_PROJECT_ID) {
      console.warn("[API Pandillas] Falta GCP_PROJECT_ID, usando motor determinista local.");
      const deterministicResult = fuseGangsAndBuildGraph(manualGang, [], csvRows);
      return NextResponse.json({ ...deterministicResult, isAiGenerated: false });
    }

    // 4. LLAMAR A GEMINI CON BÚSQUEDA EN GOOGLE (OSINT GROUNDING)
    try {
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

      // Equipamos al modelo con la herramienta de búsqueda de Google para hacer OSINT real
      const model = vertexAI.getGenerativeModel({
        model: GEMINI_MODEL,
        tools: [{ googleSearch: {} } as any],
      });

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

REGLAS DE GENERACIÓN DE COORDENADAS:
- Genera coordenadas geográficas reales en Aguascalientes, México (cerca de lat: 21.88, lng: -102.29) basándote en los domicilios semilla inyectados o las colonias detectadas en internet.
- NO dejes las coordenadas en blanco. Siempre crea puntos geográficos y áreas de calor para pintar el mapa.

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

      const result = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: systemPrompt + "\n\n" + userMessage }] }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      });

      const responseText = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      console.log("[API Pandillas] Respuesta cruda de Gemini recibida.");
      
      const cleanJson = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsedResult = JSON.parse(cleanJson);

      return NextResponse.json({ ...parsedResult, isAiGenerated: true });

    } catch (aiErr: any) {
      console.error("[API Pandillas] Error en la invocación de Gemini VertexAI:", aiErr);
      // Fallback a motor determinista local en caso de error de API o cuota
      const deterministicResult = fuseGangsAndBuildGraph(manualGang, [], csvRows);
      return NextResponse.json({
        ...deterministicResult,
        isAiGenerated: false,
        warning: "Fallo temporal de IA (usando motor de fusión local): " + aiErr.message
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
