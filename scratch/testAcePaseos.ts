import * as fs from "fs";
import * as path from "path";
import { StatisticalIntelligenceEngineV2 } from "../src/utils/statisticalIntelligenceEngineV2/index";
import { StatisticalEvidenceMatrixManager } from "../src/utils/statisticalEvidenceMatrix/index";
import { AnalyticalConsistencyEngine } from "../src/utils/analyticalConsistencyEngine/index";

async function main() {
  console.log("=== INICIANDO INTEGRACIÓN E2E DE AUDITORÍA: ACE + PASEOS ===");

  const dataPath = path.join(__dirname, "paseos_project_data.json");
  if (!fs.existsSync(dataPath)) {
    console.error("Error: No se encontró el archivo de datos de Paseos.");
    process.exit(1);
  }

  const projectData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const rawIncidents = projectData.incidents || [];
  
  const centerLat = 21.80929;
  const centerLng = -102.26964;
  const radiusMeters = 1000;
  const projectId = "Lwh3M1QJGc9HucZTwtWo";

  // 1. Ejecutar el núcleo matemático SIE 2.0 Core
  const sieResult = StatisticalIntelligenceEngineV2.analyze(rawIncidents, centerLat, centerLng, radiusMeters);

  // 2. Ejecutar la capa SEM
  const { sem } = StatisticalEvidenceMatrixManager.process(
    projectId,
    rawIncidents,
    sieResult
  );

  // 3. Simular payload real consistente de los demás motores (CIE, HIE, TCE, Report)
  const payload: any = {
    projectId,
    tceContext: {
      centroid: { lat: 21.80929, lng: -102.26964 },
      radiusMeters: 1000,
      startDate: sem.temporalEvidence.temporalCoverage.startDate,
      endDate: sem.temporalEvidence.temporalCoverage.endDate
    },
    sieEventsCount: 1368,
    semContext: sem,
    cieContext: {
      centroid: { lat: 21.80929, lng: -102.26964 },
      radiusMeters: 1000,
      eventsCount: 1368,
      hotspotsCount: 3
    },
    hieContext: {
      validationVector: {
        spatialPattern: "CONCENTRATED", // Patrón alineado con la SEM de Paseos (entropía baja)
        temporalPattern: "STABLE",
        criticalOpportunity: "HIGH"
      }
    },
    reportContext: {
      mapCount: 1, // Al menos un mapa presente
      chartsCount: 2,
      startDate: sem.temporalEvidence.temporalCoverage.startDate,
      endDate: sem.temporalEvidence.temporalCoverage.endDate,
      eventsCount: 1368
    }
  };

  // 4. Ejecutar la auditoría de consistencia del ACE
  const report = AnalyticalConsistencyEngine.audit(payload, "EXPORT");

  console.log("\n==========================================================================");
  console.log("            REPORTE DE AUDITORÍA CRUZADA ACE - EXPEDIENTE PASEOS          ");
  console.log("==========================================================================");
  console.log(`Proyecto ID: ${projectId} | Fecha: ${report.metadata.auditedAt}`);
  console.log(`Estatus Global de Auditoría: ${report.globalStatus}`);
  console.log(`Nivel de Confianza de Auditoría: ${report.overallConfidence}%`);
  console.log(`Ejecuciones en historial: ${report.auditHistory?.length}`);

  const resultsTable = [
    {
      Dimensión: "Coherencia Cuantitativa",
      Estatus: report.quantitativeConsistency.status,
      Detalle: `Diferencia de delitos: ${report.quantitativeConsistency.difference} (0 esperado)`
    },
    {
      Dimensión: "Coherencia Espacial",
      Estatus: report.spatialConsistency.status,
      Detalle: `Desviación centroides: ${report.spatialConsistency.centroidDistanceMeters.toFixed(1)}m | Desviación radio: ${report.spatialConsistency.radiusDifferencePercentage.toFixed(1)}%`
    },
    {
      Dimensión: "Coherencia Temporal",
      Estatus: report.temporalConsistency.status,
      Detalle: `Inconsistencias: ${report.temporalConsistency.coverageInconsistent ? "Sí" : "No"}`
    },
    {
      Dimensión: "Coherencia Criminológica",
      Estatus: report.criminologicalConsistency.status,
      Detalle: `Contradicción: ${report.criminologicalConsistency.hypothesisContradictory ? "Sí" : "No"} (HIE vs SEM)`
    },
    {
      Dimensión: "Coherencia Documental",
      Estatus: report.documentConsistency.status,
      Detalle: `Inconsistencias de recursos: ${report.documentConsistency.mapsOrChartsInconsistent ? "Sí" : "No"}`
    }
  ];

  console.table(resultsTable);

  if (report.alerts.length > 0) {
    console.log("\nAlertas Emitidas por el Auditor:");
    report.alerts.forEach((a, i) => {
      console.log(`  [${i + 1}] [${a.type} | ${a.category} | ${a.severity}] - ${a.message} (Origen: ${a.source})`);
    });
  }

  // Comprobar bloqueo analítico
  if (report.globalStatus === "FAILED") {
    console.log("\n🔴 EXPORTACIÓN BLOQUEADA:");
    report.blockingReason?.forEach(r => {
      console.log(`  └─> Módulo: ${r.module} | Variable: ${r.variable} | Causa: ${r.message}`);
    });
  } else {
    console.log("\n🟢 DICTAMEN CERTIFICADO: Listo para exportación.");
  }

  // Guardar copia del reporte completo en JSON
  const outPath = path.join(__dirname, "paseos_ace_audit_report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nReporte completo de auditoría guardado en ${outPath}`);
}

main().catch(err => {
  console.error("Error en la prueba de Paseos con ACE:", err);
});
