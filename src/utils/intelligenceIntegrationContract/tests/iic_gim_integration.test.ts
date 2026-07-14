import { IntelligenceContextBuilder } from "../intelligenceContextBuilder";
import { StatisticalEvidenceMatrix } from "../../statisticalEvidenceMatrix/models/statisticalEvidenceTypes";
import { VisualEvidenceMatrix } from "../../visualEvidenceEngine/models/visualEvidenceTypes";
import { TerritorialEvidenceMatrix } from "../../territorialIntelligenceEngine/models/territorialEvidenceTypes";
import { AnalyticalConsistencyReport, HIEValidationVector } from "../../analyticalConsistencyEngine/models/aceTypes";
import { GangEvidenceMatrix } from "../../gangIntelligenceEngine/models/gangIntelligenceTypes";

export function runIicGimIntegrationTests() {
  console.log("=== INICIANDO PRUEBAS DE INTEGRACIÓN IIC + GIM (ADR-008.5 / PHASE 6) ===");

  // --- MOCK FUENTES DE EVIDENCIA ---
  const mockSem: StatisticalEvidenceMatrix = {
    metadata: {
      projectId: "Lwh3M1QJGc9HucZTwtWo",
      analysisDate: "14/07/2026",
      sieVersion: "2.0",
      semVersion: "1.0",
      totalCanonicalIncidents: 12,
      analysisRadiusMeters: 500,
      centerLat: 21.96541,
      centerLng: -102.29871
    },
    criminalEvidence: {
      totalEvents: 12,
      crimeTypes: [{ type: "Robo de Vehículo", count: 8 }],
      dominantCrime: "Robo de Vehículo",
      concentrationScore: 66
    },
    temporalEvidence: {
      trendDirection: "increase",
      trendSlope: 0.4,
      seasonalityIndex: 12,
      criticalPeriods: ["Noche"],
      anomalies: [],
      temporalCoverage: { startDate: "01/01/2026", endDate: "01/07/2026" }
    },
    spatialEvidence: {
      hotspots: [{ id: "HS-001", center: { lat: 21.96545, lng: -102.29875 }, events: 8, densityScore: 90 }],
      clusterCount: 1,
      centerOfGravity: { lat: 21.96545, lng: -102.29875 },
      dispersionMeters: 120,
      entropy: 0.4,
      spatialPattern: "CONCENTRATED"
    },
    predictiveEvidence: {
      poissonProbability: 0.85,
      nearRepeatRisk: 0.70,
      modelFit: true,
      confidenceMetrics: { statisticalConfidence: 94, operationalReliability: 88 }
    },
    qualityEvidence: { dataCompleteness: 100, statisticalValidity: true, warnings: [], validationStatus: "VALIDATED" },
    limitations: [],
    variableTraceability: {
      totalEvents: { source: "SIE-SSM", engine: "Statistical Engine", version: "2.0", timestamp: "14/07/2026" },
      hotspots: { source: "SIE-SSM", engine: "Statistical Engine", version: "2.0", timestamp: "14/07/2026" },
      poissonRisk: { source: "SIE-SSM", engine: "Statistical Engine", version: "2.0", timestamp: "14/07/2026" },
      trend: { source: "SIE-SSM", engine: "Statistical Engine", version: "2.0", timestamp: "14/07/2026" }
    },
    intelligenceReadiness: { availableForHIE: true, availableForCIE: true, availableForReport: true },
    traceability: { source: "historicalIncidents", sieVersion: "2.0", semVersion: "1.0", methodsUsed: [], generatedAt: "14/07/2026" }
  };

  const mockVee: VisualEvidenceMatrix = {
    projectId: "Lwh3M1QJGc9HucZTwtWo",
    overallVisualConfidence: 90,
    analystPhotos: [{ image: "photo-data", title: "Indicios", description: "Graffiti", finding: "Marcas", operationalImpact: "Presencia" }],
    streetViewEvidence: [{ image: "sv-data", title: "Baldío", description: "Abandono", finding: "Vulnerabilidad", operationalImpact: "Ocultamiento" }],
    graffitiEvidence: [{ image: "graf-data", title: "Rivalidad", description: "Graffiti", finding: "Fronteras", operationalImpact: "Territorialidad" }],
    territorialFindings: { criticalVulnerabilityCount: 1, primaryRiskFactor: "Vulnerabilidad Física", impactAreaSqm: 50 },
    executiveAbstract: "Abstract visual",
    matrix56: []
  };

  const mockTie: TerritorialEvidenceMatrix = {
    projectId: "Lwh3M1QJGc9HucZTwtWo",
    projectName: "Polígono Paseos",
    temVersion: "1.0",
    territorialContext: { tipologyName: "Urbana", areaSizeMeters: 500, description: "Área densa" },
    urbanStructure: { landUse: "Residencial", streetGridType: "GRID", vesselVulnerability: "MEDIUM", permeabilityScore: 80 },
    economicAttractors: [{ id: "ATT-1", name: "OXXO Paseos", activityCode: "461111", category: "COMERCIO", address: "Calle 1", lat: 21.96541, lng: -102.29871, distanceToHotspotMeters: 5, situationalInfluenceLevel: "HIGH", criminologicalRole: "Flujo" }],
    mobilityFactors: { transportNodeCount: 0, mainAccessPoints: ["Calle 1"], vulnerabilityDescription: "Parada informal", pedestrianExposure: "LOW" },
    environmentalRiskFactors: { lightingScore: "DEFICIENT", visibilityObstructions: [], abandonedLotsCount: 0, structuralDeterioration: "BAJO" as any },
    territorialPressure: { hotspotProximityScore: 50, attractorDensityScore: 50, mobilityExposureScore: 50, environmentalVulnerabilityScore: 50 },
    operationalImplications: [],
    traceability: { variablesQueried: [], denueVersion: "2026", queryTimestamp: "14/07/2026" },
    confidence: { operationalConfidence: 90, evidenceSupportCount: 2 },
    validationStatus: "VALIDATED"
  };

  const mockHie: HIEValidationVector = {
    spatialPattern: "CONCENTRATED",
    temporalPattern: "STABLE",
    criticalOpportunity: "HIGH"
  };

  const mockAce: AnalyticalConsistencyReport = {
    metadata: { projectId: "Lwh3M1QJGc9HucZTwtWo", auditedAt: "14/07/2026", aceVersion: "1.0" },
    quantitativeConsistency: { status: "PASS", difference: 0, severity: "NONE" },
    spatialConsistency: { status: "PASS", centroidDistanceMeters: 1, radiusDifferencePercentage: 0 },
    temporalConsistency: { status: "PASS", coverageInconsistent: false },
    criminologicalConsistency: { status: "PASS", hypothesisContradictory: false },
    documentConsistency: { status: "PASS", mapsOrChartsInconsistent: false },
    globalStatus: "PASS",
    overallConfidence: 95,
    alerts: []
  };

  // --- MOCK GEM (GANG EVIDENCE MATRIX) ---
  const validGem: GangEvidenceMatrix = {
    metadata: {
      module: "GIM",
      version: "1.0.0",
      generatedAt: "2026-07-14T09:15:00Z",
      schemaVersion: "ADR-008.2"
    },
    presenceEvidence: {
      status: "CONFIRMED",
      confidence: "HIGH",
      matchedGroups: ["Facción 13"],
      findingsCount: 1,
      remarks: "Presencia corroborada por indicios de campo"
    },
    territorialInfluence: [
      {
        gangName: "Facción 13",
        subgroups: [],
        activityLevel: "LOW",
        influenceType: "SYMBOLIC",
        approximateCoordinates: { lat: 21.96541, lng: -102.29871 }
      }
    ],
    graffitiEvidence: [],
    osintEvidence: {
      eventsFound: 0,
      events: []
    },
    traceabilityLog: [],
    status: "READY"
  };

  const invalidGem: GangEvidenceMatrix = {
    ...validGem,
    status: "NOT_READY"
  };

  let passedTests = 0;

  // ============================================================================
  // TEST-IIC-001: Expediente histórico sin GIM (Parámetro pasado como null)
  // ============================================================================
  console.log("\nEjecutando TEST-IIC-001...");
  const ctx001 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", mockSem, mockVee, mockTie, mockHie, mockAce, null, null);
  
  const pass001 = 
    ctx001.evidenceSources.GIM === null &&
    ctx001.capabilityStatus.gangIntelligence === false &&
    ctx001.intelligenceModules.gang === false;

  console.assert(pass001, "❌ TEST-IIC-001 FALLÓ");
  if (pass001) {
    console.log("🟢 TEST-IIC-001 APROBADO: Expediente histórico sin GIM es completamente compatible.");
    passedTests++;
  }

  // ============================================================================
  // TEST-IIC-002: Expediente nuevo con GEM válida (Módulo activo)
  // ============================================================================
  console.log("\nEjecutando TEST-IIC-002...");
  const ctx002 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", mockSem, mockVee, mockTie, mockHie, mockAce, null, validGem);

  const pass002 = 
    !!ctx002.evidenceSources.GIM &&
    ctx002.evidenceSources.GIM.status === "READY" &&
    ctx002.capabilityStatus.gangIntelligence === true &&
    ctx002.intelligenceModules.gang === true;

  console.assert(pass002, "❌ TEST-IIC-002 FALLÓ");
  if (pass002) {
    console.log("🟢 TEST-IIC-002 APROBADO: Expediente nuevo asimila la GEM y activa gangIntelligence.");
    passedTests++;
  }

  // ============================================================================
  // TEST-IIC-003: GEM con estatus NOT_READY (Capacidad limitada / desactivada)
  // ============================================================================
  console.log("\nEjecutando TEST-IIC-003...");
  const ctx003 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", mockSem, mockVee, mockTie, mockHie, mockAce, null, invalidGem);

  const pass003 = 
    !!ctx003.evidenceSources.GIM &&
    ctx003.evidenceSources.GIM.status === "NOT_READY" &&
    ctx003.capabilityStatus.gangIntelligence === false &&
    ctx003.intelligenceModules.gang === false;

  console.assert(pass003, "❌ TEST-IIC-003 FALLÓ");
  if (pass003) {
    console.log("🟢 TEST-IIC-003 APROBADO: GEM con estatus NOT_READY degrada y desactiva gangIntelligence.");
    passedTests++;
  }

  // ============================================================================
  // TEST-IIC-004: GIM ausente del flujo (Omisión del parámetro en build)
  // ============================================================================
  console.log("\nEjecutando TEST-IIC-004...");
  const ctx004 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", mockSem, mockVee, mockTie, mockHie, mockAce);

  const pass004 = 
    ctx004.evidenceSources.GIM === null &&
    ctx004.capabilityStatus.gangIntelligence === false &&
    ctx004.intelligenceModules.gang === false;

  console.assert(pass004, "❌ TEST-IIC-004 FALLÓ");
  if (pass004) {
    console.log("🟢 TEST-IIC-004 APROBADO: Omisión opcional del parámetro compila y preserva compatibilidad histórica.");
    passedTests++;
  }

  // ============================================================================
  // TEST-IIC-005: ACE FAILED con GIM válido (Bloqueo correcto a NOT_READY)
  // ============================================================================
  console.log("\nEjecutando TEST-IIC-005...");
  const mockAceFailed: AnalyticalConsistencyReport = { ...mockAce, globalStatus: "FAILED" };
  const ctx005 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", mockSem, mockVee, mockTie, mockHie, mockAceFailed, null, validGem);

  const pass005 = ctx005.analysisReadiness === "NOT_READY";

  console.assert(pass005, "❌ TEST-IIC-005 FALLÓ");
  if (pass005) {
    console.log("🟢 TEST-IIC-005 APROBADO: Consistencia analítica desaprobada (ACE FAILED) bloquea el expediente a NOT_READY.");
    passedTests++;
  }

  // ============================================================================
  // TEST-IIC-006: HIE funcionando sin GIM
  // ============================================================================
  console.log("\nEjecutando TEST-IIC-006...");
  const ctx006 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", mockSem, mockVee, mockTie, mockHie, mockAce, null, null);

  const pass006 = 
    ctx006.evidenceSources.HIE !== null &&
    ctx006.evidenceSources.HIE.spatialPattern === "CONCENTRATED" &&
    ctx006.evidenceSources.GIM === null;

  console.assert(pass006, "❌ TEST-IIC-006 FALLÓ");
  if (pass006) {
    console.log("🟢 TEST-IIC-006 APROBADO: El motor de hipótesis (HIE) funciona correctamente sin regresión.");
    passedTests++;
  }

  console.log("\n=== RESUMEN DE INTEGRACIÓN IIC + GIM ===");
  console.log(`Pruebas Pasadas: ${passedTests}/6`);
  console.log("=========================================\n");

  if (passedTests === 6) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Permitir ejecución directa del archivo
if (process.argv[1] && process.argv[1].endsWith("iic_gim_integration.test.ts")) {
  runIicGimIntegrationTests();
}
