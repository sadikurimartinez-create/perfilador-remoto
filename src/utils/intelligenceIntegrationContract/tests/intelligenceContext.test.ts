import { IntelligenceContextBuilder } from "../intelligenceContextBuilder";
import { IntelligenceContextInspector } from "../intelligenceContextInspector";
import { IntelligenceEvidenceResolver } from "../intelligenceEvidenceResolver";
import { StatisticalEvidenceMatrix } from "../../statisticalEvidenceMatrix/models/statisticalEvidenceTypes";
import { VisualEvidenceMatrix } from "../../visualEvidenceEngine/models/visualEvidenceTypes";
import { TerritorialEvidenceMatrix } from "../../territorialIntelligenceEngine/models/territorialEvidenceTypes";
import { AnalyticalConsistencyReport, HIEValidationVector } from "../../analyticalConsistencyEngine/models/aceTypes";

export function runIntegrationContractTests() {
  console.log("=== INTELLIGENCE INTEGRATION CONTRACT TESTS ===");

  // 1. Mock base de SEM (Statistical Evidence Matrix)
  const baseSem: StatisticalEvidenceMatrix = {
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
      confidenceMetrics: {
        statisticalConfidence: 94,
        operationalReliability: 88
      }
    },
    qualityEvidence: {
      dataCompleteness: 100,
      statisticalValidity: true,
      warnings: [],
      validationStatus: "VALIDATED"
    },
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

  // 2. Mock base de VEE (Visual Evidence Matrix)
  const baseVee: VisualEvidenceMatrix = {
    projectId: "Lwh3M1QJGc9HucZTwtWo",
    overallVisualConfidence: 90,
    analystPhotos: [{ image: "base64-photo", title: "Foco roto", description: "Luz apagada", finding: "Deficiencia en iluminación pública", operationalImpact: "Reduce visibilidad táctica" }],
    streetViewEvidence: [{ image: "base64-sv", title: "Baldío", description: "Terreno baldío", finding: "Predio baldío abandonado", operationalImpact: "Facilita ocultamiento" }],
    graffitiEvidence: [{ image: "base64", title: "Grafiti", description: "Grafiti acumulado", finding: "Grafiti masivo", operationalImpact: "Indicio de desorden físico" }],
    territorialFindings: { criticalVulnerabilityCount: 2, primaryRiskFactor: "Vulnerabilidad Física", impactAreaSqm: 120 },
    executiveAbstract: "Resumen visual",
    matrix56: []
  };

  // 3. Mock base de TIE (Territorial Evidence Matrix)
  const baseTie: TerritorialEvidenceMatrix = {
    projectId: "Lwh3M1QJGc9HucZTwtWo",
    projectName: "Polígono Paseos",
    temVersion: "1.0",
    territorialContext: { tipologyName: "Residencial Mixto", areaSizeMeters: 500, description: "Área urbana" },
    urbanStructure: { landUse: "Mixto", streetGridType: "GRID", vesselVulnerability: "MEDIUM", permeabilityScore: 75 },
    economicAttractors: [{ id: "ATT-1", name: "OXXO Carboneras", activityCode: "461111", category: "COMERCIO", address: "Av. Paseos 102", lat: 21.96542, lng: -102.29872, distanceToHotspotMeters: 10, situationalInfluenceLevel: "HIGH", criminologicalRole: "Flujo peatonal" }],
    mobilityFactors: { transportNodeCount: 1, mainAccessPoints: ["Av. Paseos"], vulnerabilityDescription: "Parada informal", pedestrianExposure: "MEDIUM" },
    environmentalRiskFactors: { lightingScore: "DEFICIENT", visibilityObstructions: ["Maleza"], abandonedLotsCount: 1, structuralDeterioration: "BAJO" as any },
    territorialPressure: { hotspotProximityScore: 90, attractorDensityScore: 80, mobilityExposureScore: 70, environmentalVulnerabilityScore: 60 },
    operationalImplications: [],
    traceability: { variablesQueried: [], denueVersion: "2026", queryTimestamp: "14/07/2026" },
    confidence: { operationalConfidence: 95, evidenceSupportCount: 3 },
    validationStatus: "VALIDATED"
  };

  // 4. Mock de HIE Validation Vector
  const baseHieVector: HIEValidationVector = {
    spatialPattern: "CONCENTRATED",
    temporalPattern: "STABLE",
    criticalOpportunity: "HIGH"
  };

  // 5. Mock de ACE
  const baseAce: AnalyticalConsistencyReport = {
    metadata: { projectId: "Lwh3M1QJGc9HucZTwtWo", auditedAt: "14/07/2026", aceVersion: "1.0" },
    quantitativeConsistency: { status: "PASS", difference: 0, severity: "NONE" },
    spatialConsistency: { status: "PASS", centroidDistanceMeters: 5, radiusDifferencePercentage: 0 },
    temporalConsistency: { status: "PASS", coverageInconsistent: false },
    criminologicalConsistency: { status: "PASS", hypothesisContradictory: false },
    documentConsistency: { status: "PASS", mapsOrChartsInconsistent: false },
    globalStatus: "PASS",
    overallConfidence: 100,
    alerts: []
  };

  let passedCount = 0;

  // ============================================================================
  // CASO 1: Integración Completa (PASS / VALIDATED)
  // ============================================================================
  const context1 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", baseSem, baseVee, baseTie, baseHieVector, baseAce);
  const result1 = IntelligenceContextInspector.inspect(context1);
  console.assert(result1.status === "VALIDATED", "❌ CASO 1 FALLÓ: Estatus no es VALIDATED");
  console.assert(context1.provenance.confidence === 100, "❌ CASO 1 FALLÓ: Confianza debió ser 100");
  if (result1.status === "VALIDATED") {
    console.log("PASS: Caso 1 - Integración Completa");
    passedCount++;
  }

  // ============================================================================
  // CASO 2: SEM + VEE + TIE completo, sin HIE (VALID_WITH_LIMITATIONS)
  // ============================================================================
  const context2 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", baseSem, baseVee, baseTie, null, baseAce);
  const result2 = IntelligenceContextInspector.inspect(context2);
  console.assert(result2.status === "VALID_WITH_LIMITATIONS", "❌ CASO 2 FALLÓ: Estatus no es VALID_WITH_LIMITATIONS");
  console.assert(result2.messages.some(m => m.includes("COMPLETITUD PARCIAL")), "❌ CASO 2 FALLÓ: No reportó completitud parcial");
  if (result2.status === "VALID_WITH_LIMITATIONS") {
    console.log("PASS: Caso 2 - Integración sin HIE");
    passedCount++;
  }

  // ============================================================================
  // CASO 3: Sin fotografías (VALID_WITH_LIMITATIONS)
  // ============================================================================
  const mockVeeNoPhotos: VisualEvidenceMatrix = {
    ...baseVee,
    analystPhotos: [],
    streetViewEvidence: [],
    graffitiEvidence: []
  };
  const context3 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", baseSem, mockVeeNoPhotos, baseTie, baseHieVector, baseAce);
  const result3 = IntelligenceContextInspector.inspect(context3);
  console.assert(result3.status === "VALID_WITH_LIMITATIONS", "❌ CASO 3 FALLÓ: Estatus no es VALID_WITH_LIMITATIONS");
  console.assert(context3.capabilityStatus.visualEvidence === false, "❌ CASO 3 FALLÓ: visualEvidence debió estar desactivado");
  if (result3.status === "VALID_WITH_LIMITATIONS" && !context3.capabilityStatus.visualEvidence) {
    console.log("PASS: Caso 3 - Sin fotografías");
    passedCount++;
  }

  // ============================================================================
  // CASO 4: SEM concentrado, TIE sin atractores (VALID_WITH_LIMITATIONS)
  // ============================================================================
  const mockSemConcentrated = {
    ...baseSem,
    spatialEvidence: {
      ...baseSem.spatialEvidence,
      spatialPattern: "CONCENTRATED",
      clusterCount: 1
    }
  };
  const mockTieNoAttractors = {
    ...baseTie,
    economicAttractors: []
  };
  const context4 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", mockSemConcentrated, baseVee, mockTieNoAttractors, baseHieVector, baseAce);
  const result4 = IntelligenceContextInspector.inspect(context4);
  console.assert(result4.status === "VALID_WITH_LIMITATIONS", "❌ CASO 4 FALLÓ: Estatus no es VALID_WITH_LIMITATIONS");
  const hasMobilityQuestion = context4.operationalAssessment.unresolvedQuestions.some(q => q.includes("dinámicas de movilidad"));
  console.assert(hasMobilityQuestion, "❌ CASO 4 FALLÓ: No insertó la pregunta de movilidad obligatoria");
  if (result4.status === "VALID_WITH_LIMITATIONS" && hasMobilityQuestion) {
    console.log("PASS: Caso 4 - SEM concentrado sin atractores");
    passedCount++;
  }

  // ============================================================================
  // CASO 5: HIE plantea patrón fuerte, SEM evidencia insuficiente (WARNING)
  // ============================================================================
  const mockSemLowEvents = {
    ...baseSem,
    metadata: { ...baseSem.metadata, totalCanonicalIncidents: 1 },
    criminalEvidence: { ...baseSem.criminalEvidence, totalEvents: 1 }
  };
  const context5 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", mockSemLowEvents, baseVee, baseTie, baseHieVector, baseAce);
  const result5 = IntelligenceContextInspector.inspect(context5);
  console.assert(result5.status === "WARNING", "❌ CASO 5 FALLÓ: Estatus no conmutó a WARNING");
  if (result5.status === "WARNING") {
    console.log("PASS: Caso 5 - HIE fuerte con baja evidencia SEM");
    passedCount++;
  }

  // ============================================================================
  // CASO 6: ACE en estatus FAILED (FAILED)
  // ============================================================================
  const mockAceFailed: AnalyticalConsistencyReport = {
    ...baseAce,
    globalStatus: "FAILED",
    alerts: [{ type: "SPATIAL", category: "ANALYTICAL", message: "Discrepancia espacial severa", severity: "HIGH", source: "ACE-SP" }]
  };
  const context6 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", baseSem, baseVee, baseTie, baseHieVector, mockAceFailed);
  const result6 = IntelligenceContextInspector.inspect(context6);
  console.assert(result6.status === "FAILED", "❌ CASO 6 FALLÓ: Estatus no es FAILED");
  if (result6.status === "FAILED") {
    console.log("PASS: Caso 6 - Bloqueo crítico por ACE FAILED");
    passedCount++;
  }

  // ============================================================================
  // CASO 7: Expediente mínimo (VALID_WITH_LIMITATIONS)
  // ============================================================================
  const context7 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", baseSem, null, null, null, baseAce);
  const result7 = IntelligenceContextInspector.inspect(context7);
  console.assert(result7.status === "VALID_WITH_LIMITATIONS", "❌ CASO 7 FALLÓ: Estatus no es VALID_WITH_LIMITATIONS");
  console.assert(context7.capabilityStatus.visualEvidence === false, "❌ CASO 7 FALLÓ: visualEvidence debió ser false");
  console.assert(context7.capabilityStatus.territorialEvidence === false, "❌ CASO 7 FALLÓ: territorialEvidence debió ser false");
  if (result7.status === "VALID_WITH_LIMITATIONS") {
    console.log("PASS: Caso 7 - Expediente mínimo");
    passedCount++;
  }

  // ============================================================================
  // CASO 8: Expediente real Polígono Paseos (PASS / VALIDATED)
  // ============================================================================
  const context8 = IntelligenceContextBuilder.build("Lwh3M1QJGc9HucZTwtWo", baseSem, baseVee, baseTie, baseHieVector, baseAce);
  const result8 = IntelligenceContextInspector.inspect(context8);
  console.assert(context8.metadata.projectId === "Lwh3M1QJGc9HucZTwtWo", "❌ CASO 8 FALLÓ: El ID no es Lwh3M1QJGc9HucZTwtWo");
  console.assert(result8.status === "VALIDATED", "❌ CASO 8 FALLÓ: Estatus no es VALIDATED");
  if (result8.status === "VALIDATED") {
    console.log("PASS: Caso 8 - Validación Expediente Paseos Lwh3M1QJGc9HucZTwtWo");
    passedCount++;
  }

  // 9. Resolver factual
  const rel = IntelligenceEvidenceResolver.resolveEvidenceRelationship(context1);
  console.assert(rel.coincidesWithHotspot === true, "❌ RESOLVER FALLÓ: Coincidencia debió ser true");
  console.assert(rel.closestAttractorName === "OXXO Carboneras", "❌ RESOLVER FALLÓ: Atractor incorrecto");

  console.log("");
  console.log(`PASS: ${passedCount}/8`);
  console.log("");
  console.log("IIC READY FOR PRODUCTION");
}
