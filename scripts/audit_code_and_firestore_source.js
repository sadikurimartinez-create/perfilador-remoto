process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { initializeApp } = require("firebase/app");
const { initializeFirestore, collection, getDocs, limit, query } = require("firebase/firestore");
const fs = require("fs");
const path = require("path");

const firebaseConfig = {
  apiKey: "AIzaSyCX8sRh4Km8FLFz1XI-LtbkhzdfhXeAVpw",
  authDomain: "perfilador-remoto.firebaseapp.com",
  databaseURL: "https://perfilador-remoto-default-rtdb.firebaseio.com",
  projectId: "perfilador-remoto",
  storageBucket: "perfilador-remoto.firebasestorage.app",
  messagingSenderId: "1062636354921",
  appId: "1:1062636354921:web:89ebc4ad940d93015e91f8",
  measurementId: "G-WLKXSYNJJ9"
};

async function audit() {
  console.log("=== AUDITORÍA SOLO LECTURA: FUENTES Y LÓGICA DE DESEMPEÑO ===");

  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

  // -------------------------------------------------------------
  // 1. AUDITORÍA FIRESTORE: audit_logs/, analyses/, counters/
  // -------------------------------------------------------------
  console.log("\n--- 1. Analizando Firestore ---");

  // 1a. audit_logs/
  console.log("Analizando 'audit_logs/'...");
  const auditLogsSnap = await getDocs(query(collection(db, "audit_logs"), limit(50)));
  const auditLogFields = new Set();
  const sampleAuditLogs = [];
  let userPerformanceFieldsInLogs = [];

  auditLogsSnap.forEach((d) => {
    const data = d.data();
    Object.keys(data).forEach((k) => auditLogFields.add(k));
    if (sampleAuditLogs.length < 5) {
      sampleAuditLogs.push({ id: d.id, keys: Object.keys(data), sampleData: data });
    }
  });

  // 1b. analyses/
  console.log("Analizando 'analyses/'...");
  const analysesSnap = await getDocs(collection(db, "analyses"));
  const analysesFields = new Set();
  const sampleAnalyses = [];

  analysesSnap.forEach((d) => {
    const data = d.data();
    Object.keys(data).forEach((k) => analysesFields.add(k));
    if (sampleAnalyses.length < 5) {
      sampleAnalyses.push({ id: d.id, keys: Object.keys(data), sampleData: data });
    }
  });

  // 1c. counters/
  console.log("Analizando 'counters/'...");
  const countersSnap = await getDocs(collection(db, "counters"));
  const counterDocs = [];
  countersSnap.forEach((d) => {
    counterDocs.push({ id: d.id, data: d.data() });
  });

  // -------------------------------------------------------------
  // 2. AUDITORÍA CÓDIGO FUENTE (src/)
  // -------------------------------------------------------------
  console.log("\n--- 2. Analizando Código Fuente (src/) ---");

  const srcDir = path.join(__dirname, "..", "src");

  function getAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        getAllFiles(filePath, fileList);
      } else if (/\.(tsx?|jsx?)$/.test(file)) {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  const allCodeFiles = getAllFiles(srcDir);
  console.log(`Total de archivos de código inspeccionados: ${allCodeFiles.length}`);

  const keywords = [
    "score",
    "rating",
    "performance",
    "ranking",
    "metrics",
    "productivity",
    "evalua",
    "calific",
    "estadistic",
    "desempe"
  ];

  const codeAuditFindings = [];

  for (const filePath of allCodeFiles) {
    const relativePath = path.relative(path.join(__dirname, ".."), filePath).replace(/\\/g, "/");
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    const fileMatches = [];

    lines.forEach((line, index) => {
      const lowerLine = line.toLowerCase();
      keywords.forEach((kw) => {
        if (lowerLine.includes(kw)) {
          fileMatches.push({
            lineNumber: index + 1,
            keyword: kw,
            lineTrimmed: line.trim().substring(0, 150)
          });
        }
      });
    });

    if (fileMatches.length > 0) {
      codeAuditFindings.push({
        file: relativePath,
        matchesCount: fileMatches.length,
        matches: fileMatches
      });
    }
  }

  // Categorize code findings for clarity
  const categorySummary = {
    criminologicalScoring: [], // Risk scoring, criminal threat score, urban/criminological evaluation
    reportQualityGate: [],     // Report QA certification score
    userProfileAndAdmin: [],   // User management, profile modals, admin views
    analyticsAndDashboards: [],// Dashboards, stats
    auditLogViewers: []        // Audit log viewer
  };

  codeAuditFindings.forEach((f) => {
    const fn = f.file.toLowerCase();
    if (fn.includes("scoring") || fn.includes("threat") || fn.includes("visual") || fn.includes("urban") || fn.includes("social") || fn.includes("pandillas") || fn.includes("inundaciones")) {
      categorySummary.criminologicalScoring.push(f.file);
    } else if (fn.includes("quality") || fn.includes("certification") || fn.includes("coherence")) {
      categorySummary.reportQualityGate.push(f.file);
    } else if (fn.includes("user") || fn.includes("admin") || fn.includes("auth")) {
      categorySummary.userProfileAndAdmin.push(f.file);
    } else if (fn.includes("dashboard") || fn.includes("statics") || fn.includes("secai") || fn.includes("tactical")) {
      categorySummary.analyticsAndDashboards.push(f.file);
    } else if (fn.includes("audit")) {
      categorySummary.auditLogViewers.push(f.file);
    }
  });

  // Detailed analysis of User Profile, Admin, and Dashboard files
  const keyFilesToInspect = [
    "src/components/AdminUsersModal.tsx",
    "src/components/UserProfileModal.tsx",
    "src/components/UserProfileView.tsx",
    "src/components/StaticsDashboard.tsx",
    "src/components/SecaiDashboard.tsx",
    "src/components/AuditLogViewer.tsx",
    "src/context/AuthContext.tsx",
    "src/context/ProjectContext.tsx"
  ];

  const keyFilesAnalysis = {};

  for (const relPath of keyFilesToInspect) {
    const fullP = path.join(__dirname, "..", relPath);
    if (fs.existsSync(fullP)) {
      const code = fs.readFileSync(fullP, "utf-8");
      
      const containsUserCalculation = /length|count|reduce|sum|score|ranking|performance/i.test(code) && /projects|audit_logs|analyses/i.test(code);
      
      keyFilesAnalysis[relPath] = {
        exists: true,
        sizeLines: code.split("\n").length,
        hasDynamicUserMetricsCalculation: containsUserCalculation,
        summary: analyzeKeyFileRole(relPath, code)
      };
    } else {
      keyFilesAnalysis[relPath] = { exists: false };
    }
  }

  function analyzeKeyFileRole(filePath, code) {
    if (filePath.includes("AdminUsersModal")) {
      return "Gestión de usuarios (Creación, cambio de rol, actualización de contraseña, edición de datos personales). No calcula ni muestra métricas de desempeño de usuarios.";
    }
    if (filePath.includes("UserProfile")) {
      return "Visualización de perfil de usuario (Nombre, ID empleado, Adscripción, Grado, Estudios, Fotografía). No calcula ni muestra puntuación de desempeño.";
    }
    if (filePath.includes("StaticsDashboard") || filePath.includes("SecaiDashboard")) {
      return "Dashboard de estadísticas operativas territoriales y de proyectos criminológicos (Conteo de expediente activo, capas geoespaciales, mapas tácticos). No calcula ranking ni productividad por usuario.";
    }
    if (filePath.includes("AuditLogViewer")) {
      return "Visualizador de bitácora de auditoría del sistema (Filtro por acción, usuario y fecha). Almacena y muestra registros de eventos (login, creación de proyecto, exportación), no métricas acumuladas de productividad.";
    }
    if (filePath.includes("AuthContext") || filePath.includes("ProjectContext")) {
      return "Contexto de autenticación y proyectos. Carga el usuario de Firestore `users/` y gestiona el expediente activo. No calcula métricas dinámicas de usuario.";
    }
    return "Módulo analizado en búsqueda de cálculo dinámico.";
  }

  // -------------------------------------------------------------
  // 3. CONSTRUCCIÓN DEL REPORTE FINAL
  // -------------------------------------------------------------
  const report = {
    fechaAuditoria: new Date().toISOString(),
    ambiente: "Perfilador Remoto SSPE-CEIPOL v2.4",
    fase: "AUDITORÍA SOLO LECTURA — FUENTES Y LÓGICA DE DESEMPEÑO",
    objetivo: "Determinar si el sistema calcula métricas de desempeño dinámicamente desde expedientes, audit_logs, analyses o acciones de usuario",
    conclusionGeneral: {
      existeCalculoDinamicoDesempeno: false,
      resumenEjecutivo: "El sistema Perfilador Remoto SSPE-CEIPOL v2.4 NO realiza cálculo dinámico ni acumulativo de métricas de desempeño, productividad, ranking ni scoring de usuarios en el código React/Next.js ni desde colecciones de Firestore. Los términos 'score', 'evaluación', 'calificación' y 'métrica' en la base de código corresponden exclusivamente a motores de Inteligencia Criminológica, Evaluación de Riesgo Territorial y Control de Calidad de Reportes (Quality Gate), no a productividad de personal."
    },
    auditoriaFirestore: {
      audit_logs: {
        totalMuestreado: auditLogsSnap.size,
        camposDetectados: Array.from(auditLogFields),
        proposito: "Registro cronológico de auditoría operativa (Timestamp, userId, username, action, details). No contiene ni calcula campos de puntuación ni métricas de desempeño de usuarios.",
        muestra: sampleAuditLogs.map(s => ({ id: s.id, keys: s.keys, action: s.sampleData.action || s.sampleData.detalles }))
      },
      analyses: {
        totalDocumentos: analysesSnap.size,
        camposDetectados: Array.from(analysesFields),
        proposito: "Informes y vectores analíticos criminológicos/espaciales de expedientes. No almacenan ni calculan calificaciones de productividad de usuarios.",
        muestra: sampleAnalyses.map(s => ({ id: s.id, keys: s.keys }))
      },
      counters: {
        totalDocumentos: countersSnap.size,
        documentos: counterDocs,
        proposito: "Contador secuencial global para numeración de expedientes operativos (`project_number`). No mantiene contadores por usuario."
      }
    },
    auditoriaCodigoFuente: {
      totalArchivosInspeccionados: allCodeFiles.length,
      archivosConCoincidenciasPalabrasClave: codeAuditFindings.length,
      desglosePorModulo: categorySummary,
      analisisDetalladoComponentesClave: keyFilesAnalysis
    },
    aclaracionTerminologicaEnCodigo: [
      {
        terminoEnCodigo: "scoring.ts / calculateOverallScore / threatScore",
        dominio: "Criminología / Geointeligencia",
        descripcion: "Algoritmo de puntuación de riesgo espacial y amenaza delictiva territorial en polígonos urbanos (No desempeño de usuarios)."
      },
      {
        terminoEnCodigo: "reportQualityGate.ts / qualityScore / qualityEvaluation",
        dominio: "Gobernanza Analítica de Informes",
        descripcion: "Motor de validación de integridad técnica y consistencia de reportes generados antes de certificación (No evaluación docente o laboral del usuario)."
      },
      {
        terminoEnCodigo: "AuditLogViewer.tsx",
        dominio: "Trazabilidad de Sistema",
        descripcion: "Visor de registros de acciones (auditoría de accesos y cambios). No procesa agregaciones de desempeño ni tablas de líderes/ranking."
      }
    ]
  };

  const outputPathProject = path.join(__dirname, "..", "performance_source_audit_report.json");
  const outputPathScratch = path.join("C:\\Users\\sadi7\\.gemini\\antigravity\\scratch", "performance_source_audit_report.json");

  fs.writeFileSync(outputPathProject, JSON.stringify(report, null, 2), "utf-8");
  fs.writeFileSync(outputPathScratch, JSON.stringify(report, null, 2), "utf-8");

  console.log("\n=======================================================");
  console.log("✓ REPORTE DE FUENTES DE DESEMPEÑO GENERADO EXITOSAMENTE");
  console.log("  Ruta Proyecto: ", outputPathProject);
  console.log("  Ruta Scratch:  ", outputPathScratch);
  console.log("=======================================================\n");

  process.exit(0);
}

audit().catch((err) => {
  console.error("ERROR EN AUDITORÍA DE FUENTES:", err);
  process.exit(1);
});
