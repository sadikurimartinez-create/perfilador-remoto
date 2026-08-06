process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { initializeApp } = require("firebase/app");
const { initializeFirestore, collection, getDocs } = require("firebase/firestore");
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

const TARGET_KEYWORDS = [
  "score",
  "rating",
  "ranking",
  "performance",
  "performancescore",
  "evaluation",
  "evaluaciones",
  "calificacion",
  "puntos",
  "points",
  "productivity",
  "metrics",
  "stats",
  "completedprojects",
  "approvedprojects",
  "rejectedprojects",
  "activity",
  "history",
  "level",
  "experience",
  "evaluations",
  "performancehistory",
  "rankinghistory",
  "projectscount",
  "totalprojects",
  "count"
];

function isPerformanceField(key) {
  const lowerKey = key.toLowerCase();
  return TARGET_KEYWORDS.some((kw) => lowerKey.includes(kw));
}

async function audit() {
  console.log("=== INICIANDO FASE 1: AUDITORÍA SOLO LECTURA (SSL Bypass & Long Polling) ===");

  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true
  });

  const collectionsToAudit = [
    "users",
    "audit_logs",
    "counters",
    "analyses",
    "projects",
    "evaluations",
    "performance",
    "metrics",
    "logs",
    "stats",
    "history",
    "reports",
    "activity"
  ];

  // 1. Audit `users` collection
  console.log("Consultando colección 'users'...");
  const usersSnap = await getDocs(collection(db, "users"));
  console.log(`✓ Documentos encontrados en 'users': ${usersSnap.size}`);

  const userAudits = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;
    const data = userDoc.data();

    const email = data.email || data.correo || data.username || "N/A";
    const role = data.role || data.rol || "N/A";

    const allKeys = Object.keys(data);
    const performanceFieldsFound = {};
    const metadataFields = {};

    for (const [key, value] of Object.entries(data)) {
      if (isPerformanceField(key)) {
        performanceFieldsFound[key] = value;
      } else {
        metadataFields[key] = value;
      }
    }

    // Attempt to check potential subcollections under user doc
    const possibleSubcollections = [
      "evaluations",
      "performanceHistory",
      "rankingHistory",
      "activity",
      "logs",
      "metrics"
    ];

    const subcollectionAudits = {};

    for (const subName of possibleSubcollections) {
      try {
        const subSnap = await getDocs(collection(db, "users", uid, subName));
        if (!subSnap.empty) {
          const subDocs = [];
          subSnap.forEach((sd) => subDocs.push({ id: sd.id, data: sd.data() }));
          subcollectionAudits[subName] = {
            docCount: subSnap.size,
            docs: subDocs
          };
        }
      } catch (e) {
        // subcollection doesn't exist or no permission
      }
    }

    userAudits.push({
      uid,
      email,
      role,
      todosLosCamposDocumento: allKeys,
      camposDesempenoEncontrados: performanceFieldsFound,
      valoresActualesDesempeno: performanceFieldsFound,
      otrosCamposDocumento: metadataFields,
      subcolecciones: subcollectionAudits,
      dataCompletaDocumento: data
    });
  }

  // 2. Audit other related collections
  const relatedCollectionsAudit = {};

  for (const colName of collectionsToAudit) {
    if (colName === "users") continue;

    console.log(`Consultando colección '${colName}'...`);
    try {
      const snap = await getDocs(collection(db, colName));
      const docsSummary = [];

      snap.forEach((d) => {
        const dData = d.data();
        const perfFields = {};
        for (const [k, v] of Object.entries(dData)) {
          if (isPerformanceField(k)) {
            perfFields[k] = v;
          }
        }
        docsSummary.push({
          id: d.id,
          camposDesempenoEncontrados: perfFields,
          todosLosCampos: Object.keys(dData),
          dataCompleta: dData
        });
      });

      relatedCollectionsAudit[colName] = {
        existe: true,
        totalDocumentos: snap.size,
        documentos: docsSummary
      };
      console.log(`  ✓ Colección '${colName}': ${snap.size} documentos`);
    } catch (e) {
      relatedCollectionsAudit[colName] = {
        existe: false,
        totalDocumentos: 0,
        mensaje: "Colección no existe o no tiene documentos"
      };
      console.log(`  - Colección '${colName}': no existe o vacía`);
    }
  }

  const inventoryReport = {
    fechaAuditoria: new Date().toISOString(),
    ambiente: "Perfilador Remoto SSPE-CEIPOL v2.4",
    fase: "FASE 1 — AUDITORÍA SOLO LECTURA",
    resumen: {
      totalUsuariosEncontrados: usersSnap.size,
      coleccionesAuditadas: collectionsToAudit
    },
    usuarios: userAudits,
    otrasColeccionesAuditadas: relatedCollectionsAudit
  };

  const outputPathProject = path.join(__dirname, "..", "user_performance_inventory.json");
  const outputPathScratch = path.join("C:\\Users\\sadi7\\.gemini\\antigravity\\scratch", "user_performance_inventory.json");

  fs.writeFileSync(outputPathProject, JSON.stringify(inventoryReport, null, 2), "utf-8");
  fs.writeFileSync(outputPathScratch, JSON.stringify(inventoryReport, null, 2), "utf-8");

  console.log("\n=======================================================");
  console.log("✓ REPORTE DE AUDITORÍA FASE 1 GENERADO EXITOSAMENTE");
  console.log("  Ruta Proyecto: ", outputPathProject);
  console.log("  Ruta Scratch:  ", outputPathScratch);
  console.log("=======================================================\n");

  process.exit(0);
}

audit().catch((err) => {
  console.error("ERROR GRAVE EN AUDITORÍA:", err);
  process.exit(1);
});
