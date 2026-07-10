process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const express = require('express');
const { GoogleAuth } = require('google-auth-library');

// 1. CONFIGURACIÓN DE NÚCLEO (GCP & Agent Builder Engine Config)
const PROJECT_ID = process.env.PGP_DISCOVERY_PROJECT_ID || "proyecto-cecosai-nuevo";
const LOCATION = process.env.PGP_DISCOVERY_LOCATION || "global";
const ENGINE_ID = process.env.PGP_DISCOVERY_ENGINE_ID || "perfilador-remoto-buscador_1781793527559";
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || "./perfil-remoto-fa3fa74486fa.json";

let activeProjectId = PROJECT_ID; // Se auto-adaptará según el semáforo

// Búsqueda de credenciales válidas en raíz como fallback de seguridad
function getCredentialsPath() {
  if (fs.existsSync(CREDENTIALS_PATH)) {
    return path.resolve(CREDENTIALS_PATH);
  }
  const alternates = [
    './perfil-remoto-fa3fa74486fa.json',
    './perfil-remoto-94869497361e.json',
    '../perfil-remoto-fa3fa74486fa.json'
  ];
  for (const alt of alternates) {
    if (fs.existsSync(alt)) {
      console.log(`[Wigmore API] 🔑 Usando credenciales alternativas localizadas en: ${alt}`);
      return path.resolve(alt);
    }
  }
  return null;
}

// Obtener project_id del archivo JSON de credenciales
function getProjectIdFromCredentials() {
  const credPath = getCredentialsPath();
  if (credPath) {
    try {
      const data = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      if (data.project_id) {
        return data.project_id;
      }
    } catch (e) {
      console.error("[Wigmore API] Error leyendo project_id del JSON de credenciales:", e.message);
    }
  }
  return null;
}

// Obtener Token de Acceso de GCP mediante la Service Account
async function getAccessToken() {
  const credPath = getCredentialsPath();
  const authOptions = {
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  };
  if (credPath) {
    authOptions.keyFilename = credPath;
  } else {
    console.warn("[Wigmore API] ⚠️ No se detectó archivo de credenciales de Google Application. Se intentará usar ADC por defecto.");
  }
  const auth = new GoogleAuth(authOptions);
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

// 2. SISTEMA DE SEMÁFORO DE CONEXIÓN A VERTEX AI
let isVertexConnected = false;

async function checkVertexConnection() {
  try {
    const token = await getAccessToken();
    
    // Lista de proyectos a intentar (el configurado en claves y el nativo de la Service Account)
    const projectsToTry = [PROJECT_ID];
    const saProject = getProjectIdFromCredentials();
    if (saProject && saProject !== PROJECT_ID) {
      projectsToTry.push(saProject);
    }

    for (const proj of projectsToTry) {
      try {
        console.log(`[Wigmore API] 📡 Probando conexión con Discovery Engine (Búsqueda) en proyecto: ${proj}...`);
        const testUrl = `https://discoveryengine.googleapis.com/v1beta/projects/${proj}/locations/${LOCATION}/collections/default_collection/engines/${ENGINE_ID}/servingConfigs/default_search:search`;
        const response = await axios.post(testUrl, {
          query: "ping",
          pageSize: 1
        }, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status === 200) {
          isVertexConnected = true;
          activeProjectId = proj;
          console.log(`[Wigmore API] ✅ Conexión con Vertex AI exitosa en el proyecto: "${proj}". Semáforo: VERDE.`);
          return;
        }
      } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        console.warn(`[Wigmore API] ⚠️ Intento fallido en proyecto "${proj}": ${errMsg}`);
      }
    }

    isVertexConnected = false;
    console.error("[Wigmore API] ❌ Fallo definitivo en la conexión con Vertex AI en todos los proyectos probados. Semáforo: ROJO.");
  } catch (err) {
    isVertexConnected = false;
    console.error("[Wigmore API] ❌ Error crítico durante la autenticación de GCP:", err.message);
  }
}

// 3. OPTIMIZACIÓN DE COSTOS: CACHÉ DE 24 HORAS
const CACHE_DIR = path.resolve(__dirname, 'scratch');
const CACHE_FILE = path.join(CACHE_DIR, 'wigmore_cache.json');

function readCache() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("[Wigmore API] Error de lectura de caché:", err.message);
  }
  return {};
}

function writeCache(cacheData) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2), 'utf8');
  } catch (err) {
    console.error("[Wigmore API] Error de escritura de caché:", err.message);
  }
}

function getCachedResult(query) {
  const cache = readCache();
  const normalizedQuery = query.toLowerCase().trim();
  const entry = cache[normalizedQuery];
  if (entry) {
    const age = Date.now() - entry.timestamp;
    if (age < 24 * 60 * 60 * 1000) { // 24 horas
      console.log(`[Wigmore API] ⚡ Caché Hit para la consulta: "${query}" (Antigüedad: ${(age / 3600000).toFixed(2)} horas)`);
      return entry.result;
    }
  }
  return null;
}

function saveToCache(query, result) {
  const cache = readCache();
  const normalizedQuery = query.toLowerCase().trim();
  cache[normalizedQuery] = {
    timestamp: Date.now(),
    result
  };
  writeCache(cache);
}

// 4. EJECUTAR BÚSQUEDA GENERATIVA EN VERTEX AI SEARCH (DISCOVERY ENGINE)
async function executeDiscoveryEngineSearch(queryText) {
  const token = await getAccessToken();
  const searchUrl = `https://discoveryengine.googleapis.com/v1beta/projects/${activeProjectId}/locations/${LOCATION}/collections/default_collection/engines/${ENGINE_ID}/servingConfigs/default_search:search`;
  
  const payload = {
    query: queryText,
    pageSize: 10,
    queryExpansionSpec: { condition: "AUTO" },
    spellCorrectionSpec: { mode: "AUTO" },
    answerSpec: {
      answerGenerationSpec: {
        modelSpec: {
          modelDescription: "gemini-1.5-flash-001/answer_gen_v1.0"
        },
        promptSpec: {
          preamble: `Eres un Agente de Élite de Geointeligencia Criminal y Analista OSINT senior adscrito al CEIPOL en Aguascalientes. Analiza con alta rigurosidad y precisión la información obtenida. 
Prioridades analíticas obligatorias:
1. Buscar en registros oficiales .gob.mx y boletines del Supremo Tribunal de Justicia de Aguascalientes.
2. Identificar relaciones del investigado: familiares, socios de negocios, cómplices y alias.
3. Detectar antecedentes criminales, litigios civiles/penales y menciones en el Periódico Oficial del Estado de Aguascalientes.
4. Extraer vinculaciones corporativas, empresas asociadas y cargos directivos (apoderado, administrador único, gerente, socio).
Responde siempre citando las fuentes utilizando la numeración de los documentos devueltos.`
        },
        includeCitations: true
      }
    }
  };

  const response = await axios.post(searchUrl, payload, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

// 5. PROCESAMIENTO AUTOMÁTICO DE LAS HABILIDADES (SKILLS)
function processSkills(searchData, queryText) {
  const results = searchData.results || [];
  const answer = searchData.answer || {};
  const answerText = answer.answerText || "";
  
  const fuentesVerificadas = [];
  const seenUrls = new Set();
  
  // Skill_Rastreo_Aguascalientes: Extraer fuentes y priorizar dominios estatales y boletines
  if (answer.references && Array.isArray(answer.references)) {
    answer.references.forEach((ref, idx) => {
      const docName = ref.chunkInfo?.document || "";
      const contentExcerpt = ref.chunkInfo?.content?.slice(0, 150) || `Documento de Grounding ${idx + 1}`;
      let url = "#";
      
      // Detección de URLs en el esquema de documentos
      const uriMatch = docName.match(/uri:\s*([^\s]+)/i);
      if (uriMatch) {
        url = uriMatch[1];
      } else if (ref.chunkInfo?.document) {
        // Fallback de parseo de ruta
        url = ref.chunkInfo.document;
      }
      
      if (url !== "#" && !seenUrls.has(url)) {
        seenUrls.add(url);
        const isAgsOfficial = url.includes(".gob.mx") || url.includes("ags.gob") || url.includes("judicial") || url.includes("periodicooficial") || url.toLowerCase().includes("aguascalientes");
        fuentesVerificadas.push({
          id: String(idx + 1),
          title: contentExcerpt,
          url: url,
          aguascalientes_oficial: isAgsOfficial
        });
      }
    });
  }

  // Enriquecer fuentes desde los resultados orgánicos de la API
  results.forEach((item, idx) => {
    const docData = item.document?.derivedStructData || item.document?.structData || {};
    const url = docData.link || docData.url || item.document?.uri || "#";
    const title = docData.title || item.document?.title || `Búsqueda Web ${idx + 1}`;
    
    if (url !== "#" && !seenUrls.has(url)) {
      seenUrls.add(url);
      const isAgsOfficial = url.includes(".gob.mx") || url.includes("ags.gob") || url.includes("judicial") || url.includes("periodicooficial") || url.toLowerCase().includes("aguascalientes");
      fuentesVerificadas.push({
        id: String(fuentesVerificadas.length + 1),
        title: title,
        url: url,
        aguascalientes_oficial: isAgsOfficial
      });
    }
  });

  // Skill_Analisis_Vinculos: Extracción y estructuración en Grafo (Nodos y Enlaces)
  const nodos = [];
  const enlaces = [];
  const seenNodes = new Set();

  const mainNodeId = queryText.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  nodos.push({ id: mainNodeId, label: queryText, tipo: "sujeto", risk: "Medio" });
  seenNodes.add(mainNodeId);

  const fullTextToScan = (answerText + " " + results.map(r => r.document?.derivedStructData?.snippet || "").join(" "));
  const namePattern = /[A-Z][a-z\u00e0-\u00fc]+\s+[A-Z][a-z\u00e0-\u00fc]+(?:\s+[A-Z][a-z\u00e0-\u00fc]+)?/g;
  const rawNames = fullTextToScan.match(namePattern) || [];
  
  const vinculoKeywords = ["socio", "hermano", "cómplice", "esposo", "esposa", "familiar", "asociado", "apoderado", "colaborador"];
  const cleanNames = [...new Set(rawNames)].filter(n => {
    const lowerN = n.toLowerCase();
    const queryLower = queryText.toLowerCase();
    return !queryLower.includes(lowerN) && !lowerN.includes(queryLower) && n.length > 5 &&
           !["Aguascalientes", "México", "Fiscalía", "Gobierno", "Policía", "Supremo", "Tribunal", "Justicia", "Estado", "Boletin"].includes(n);
  });

  cleanNames.slice(0, 5).forEach((name) => {
    const nodeId = name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    let relationshipType = "asociado";
    
    const nameIdx = fullTextToScan.toLowerCase().indexOf(name.toLowerCase());
    if (nameIdx !== -1) {
      const segment = fullTextToScan.toLowerCase().slice(Math.max(0, nameIdx - 80), Math.min(fullTextToScan.length, nameIdx + 80));
      for (const kw of vinculoKeywords) {
        if (segment.includes(kw)) {
          relationshipType = kw;
          break;
        }
      }
    }

    if (!seenNodes.has(nodeId)) {
      nodos.push({
        id: nodeId,
        label: name,
        tipo: "contacto",
        relacion_detectada: relationshipType
      });
      seenNodes.add(nodeId);
      enlaces.push({
        source: mainNodeId,
        target: nodeId,
        relacion: relationshipType
      });
    }
  });

  // Skill_Deteccion_Antecedentes: Identificación de incidencia, procesos legales y boletines del Periódico Oficial
  const antecedentes = [];
  const antecedenteKeywords = [
    "balacera", "homicidio", "detenido", "arresto", "procesado", "acusado", "narcomenudeo", "droga", "cristal",
    "delito", "fraude", "demanda", "litigio", "boletín", "periódico oficial", "secuestro", "arma", "fentanilo"
  ];

  results.forEach(item => {
    const docData = item.document?.derivedStructData || {};
    const snippet = docData.snippet || "";
    const title = docData.title || "";
    const combined = (title + " " + snippet).toLowerCase();
    
    antecedenteKeywords.forEach(kw => {
      if (combined.includes(kw)) {
        const sentence = snippet.split(/[.!?]/).find(s => s.toLowerCase().includes(kw));
        if (sentence && sentence.trim().length > 12) {
          antecedentes.push({
            categoria: kw.toUpperCase(),
            detalle: sentence.trim(),
            fuente: docData.link || docData.url || item.document?.uri || "#"
          });
        }
      }
    });
  });

  // Skill_Extraccion_Corporativa: Extracción de cargos directivos y empresas vinculadas
  const empresas = [];
  const corpRegex = /\b([A-Z\u00d1\u00c1\u00c9\u00cd\u00d3\u00da][A-Za-z0-9\s,\.\-&]{3,40})\s+(S\.A\.\s+de\s+C\.V\.|S\.\s+de\s+R\.L\.|S\.A\.|S\.C\.|S\.A\.S\.)\b/g;
  let corpMatch;
  while ((corpMatch = corpRegex.exec(fullTextToScan)) !== null) {
    const empName = `${corpMatch[1]} ${corpMatch[2]}`.trim();
    if (!empresas.some(e => e.nombre === empName) && !empName.includes("Fiscalía") && !empName.includes("Gobierno")) {
      let role = "Socio/Vinculado";
      const index = fullTextToScan.indexOf(empName);
      if (index !== -1) {
        const windowText = fullTextToScan.toLowerCase().slice(Math.max(0, index - 80), Math.min(fullTextToScan.length, index + 80));
        if (windowText.includes("apoderado") || windowText.includes("representante")) role = "Apoderado Legal";
        else if (windowText.includes("administrador") || windowText.includes("unico")) role = "Administrador Único";
        else if (windowText.includes("socio") || windowText.includes("accionista")) role = "Socio Accionista";
        else if (windowText.includes("director") || windowText.includes("gerente")) role = "Director/Gerente";
      }
      empresas.push({
        nombre: empName,
        cargo: role
      });

      const empNodeId = empName.toUpperCase().replace(/[^A-Z0-9]/g, "_");
      if (!seenNodes.has(empNodeId)) {
        nodos.push({
          id: empNodeId,
          label: empName,
          tipo: "empresa"
        });
        seenNodes.add(empNodeId);
        enlaces.push({
          source: mainNodeId,
          target: empNodeId,
          relacion: role
        });
      }
    }
  }

  return {
    resumen_ejecutivo: answerText || "No se pudo sintetizar respuesta directa del RAG de Agent Builder, pero se analizaron semánticamente los resultados del barrido web.",
    lista_de_vinculos: {
      nodos,
      enlaces
    },
    antecedentes_detectados: antecedentes.slice(0, 8),
    fuentes_verificadas: fuentesVerificadas
  };
}

// 6. IMPLEMENTACIÓN DE EXPRESS API
const app = express();
app.use(express.json());

// Middlewares
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// Endpoint del estado de Semáforo
app.get("/status", async (req, res) => {
  await checkVertexConnection();
  res.json({
    success: true,
    semaphore: isVertexConnected ? "GREEN" : "RED",
    project_id: PROJECT_ID,
    engine_id: ENGINE_ID
  });
});

// Endpoint de Búsqueda de Geointeligencia Wigmore
app.post("/wigmore", async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, error: "Parámetro 'query' ausente en la petición." });
  }

  // Semáforo Check
  if (!isVertexConnected) {
    return res.status(503).json({
      success: false,
      error: "El semáforo de búsqueda está en ROJO. La conexión con Vertex AI Agent Builder falló."
    });
  }

  // Caché Check
  const cached = getCachedResult(query);
  if (cached) {
    return res.json({
      success: true,
      cached: true,
      data: cached
    });
  }

  try {
    console.log(`[Wigmore API] 🚀 Iniciando búsqueda para: "${query}"`);
    const searchData = await executeDiscoveryEngineSearch(query);
    const processed = processSkills(searchData, query);

    // Guardar en Caché
    saveToCache(query, processed);

    return res.json({
      success: true,
      cached: false,
      data: processed
    });
  } catch (err) {
    console.error("[Wigmore API] Error procesando búsqueda de inteligencia:", err);
    return res.status(500).json({
      success: false,
      error: "Error interno al ejecutar la búsqueda de geointeligencia.",
      details: err.response?.data || err.message
    });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, async () => {
  console.log(`[Wigmore API] 🚀 Servidor Wigmore levantado en http://localhost:${PORT}`);
  await checkVertexConnection();
});
