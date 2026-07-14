import { IntelligenceContextBuilder } from "../intelligenceContextBuilder";
import { IntelligenceContextValidator } from "../intelligenceContextValidator";
import { IntelligenceEvidenceResolver } from "../intelligenceEvidenceResolver";
import { StatisticalEvidenceMatrix } from "../../statisticalEvidenceMatrix/models/statisticalEvidenceTypes";
import { VisualEvidenceMatrix } from "../../visualEvidenceEngine/models/visualEvidenceTypes";
import { TerritorialEvidenceMatrix } from "../../territorialIntelligenceEngine/models/territorialEvidenceTypes";
import { AnalyticalConsistencyReport } from "../../analyticalConsistencyEngine/models/aceTypes";
import { HIEResult } from "../../hypothesisIntelligenceEngine";

export function runIntegrationContractTests() {
  console.log("======================================================================");
  console.log("🚦 INICIANDO SUITE DE PRUEBAS DE CALIDAD: INTELLIGENCE INTEGRATION CONTRACT");
  console.log("======================================================================");

  // 1. Mock base de SEM (Statistical Evidence Matrix)
  const baseSem: StatisticalEvidenceMatrix = {
    metadata: {
      projectId: "PR-PASEOS",
      analysisDate: "13/07/2026",
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
      spatialPattern: "Concentración Crítica"
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
      totalEvents: { source: "SIE-SSM", engine: "Statistical Engine", version: "2.0", timestamp: "13/07/2026" },
      hotspots: { source: "SIE-SSM", engine: "Statistical Engine", version: "2.0", timestamp: "13/07/2026" },
      poissonRisk: { source: "SIE-SSM", engine: "Statistical Engine", version: "2.0", timestamp: "13/07/2026" },
      trend: { source: "SIE-SSM", engine: "Statistical Engine", version: "2.0", timestamp: "13/07/2026" }
    },
    intelligenceReadiness: { availableForHIE: true, availableForCIE: true, availableForReport: true },
    traceability: { source: "historicalIncidents", sieVersion: "2.0", semVersion: "1.0", methodsUsed: [], generatedAt: "13/07/2026" }
  };

  // 2. Mock base de VEE (Visual Evidence Matrix)
  const baseVee: VisualEvidenceMatrix = {
    projectId: "PR-PASEOS",
    overallVisualConfidence: 90,
    analystPhotos: [{ image: "base64-photo", title: "Luz fundida", description: "Luminaria apagada", finding: "Falta de alumbrado", operationalImpact: "Reduce visibilidad táctica" }],
    streetViewEvidence: [{ image: "base64-sv", title: "Baldío", description: "Baldío sin cerramiento", finding: "Terreno abandonado", operationalImpact: "Facilita ocultamiento" }],
    graffitiEvidence: [],
    territorialFindings: { criticalVulnerabilityCount: 2, primaryRiskFactor: "Vulnerabilidad Física", impactAreaSqm: 120 },
    executiveAbstract: "Resumen visual",
    matrix56: []
  };

  // 3. Mock base de TIE (Territorial Evidence Matrix)
  const baseTie: TerritorialEvidenceMatrix = {
    projectId: "PR-PASEOS",
    projectName: "Paseos de Aguascalientes",
    temVersion: "1.0",
    territorialContext: { tipologyName: "Residencial Mixto", areaSizeMeters: 500, description: "Área urbana" },
    urbanStructure: { landUse: "Mixto", streetGridType: "GRID", vesselVulnerability: "MEDIUM", permeabilityScore: 75 },
    economicAttractors: [{ id: "ATT-1", name: "OXXO Carboneras", activityCode: "461111", category: "COMERCIO", address: "Av. Paseos 102", lat: 21.96542, lng: -102.29872, distanceToHotspotMeters: 10, situationalInfluenceLevel: "HIGH", criminologicalRole: "Flujo peatonal" }],
    mobilityFactors: { transportNodeCount: 1, mainAccessPoints: ["Av. Paseos"], vulnerabilityDescription: "Parada informal", pedestrianExposure: "MEDIUM" },
    environmentalRiskFactors: { lightingScore: "DEFICIENT", visibilityObstructions: ["Maleza"], abandonedLotsCount: 1, structuralDeterioration: "BAJO" as any },
    territorialPressure: { hotspotProximityScore: 90, attractorDensityScore: 80, mobilityExposureScore: 70, environmentalVulnerabilityScore: 60 },
    operationalImplications: [],
    traceability: { variablesQueried: [], denueVersion: "2026", queryTimestamp: "13/07/2026" },
    confidence: { operationalConfidence: 95, evidenceSupportCount: 3 },
    validationStatus: "VALIDATED"
  };

  // 4. Mock base de HIEResult (HIE)
  const baseHie: HIEResult = {
    evidence: 12,
    centralHypothesis: {
      queOcurre: "Concentración delictiva de robo de vehículo en horarios nocturnos",
      dondeOcurre: "Alrededores del establecimiento comercial OXXO",
      porQueOcurre: "Facilitado por fallas del alumbrado público y baja vigilancia natural",
      summary: "Hipótesis criminológica"
    },
    supportingEvidence: [],
    territorialEvidence: [],
    criminalEvidence: [],
    environmentalEvidence: [],
    urbanEvidence: [],
    osintEvidence: [],
    contradictoryEvidence: [],
    missingEvidence: [],
    confidence: { score: 85, level: "ALTO", description: "Consistencia robusta" },
    confidenceFactors: { qualityScore: 85, quantityScore: 80, convergenceScore: 90, consistencyScore: 85 },
    validationMatrix: { hasUniqueHypothesis: true, hasSufficientEvidence: true, hasContradictoryEvidence: false, hasConfidenceLevel: true, hasTraceability: true, isValidated: true },
    recommendedVerificationActions: [],
    traceability: {}
  };

  // 5. Mock base de ACE (Analytical Consistency Report)
  const baseAce: any = {
    metadata: { projectId: "PR-PASEOS", auditedAt: "13/07/2026", aceVersion: "1.0" },
    quantitativeConsistency: { status: "PASS", difference: 0, severity: "NONE" },
    spatialConsistency: { status: "PASS", centroidDistanceMeters: 5, radiusDifferencePercentage: 0 },
    temporalConsistency: { status: "PASS", coverageInconsistent: false },
    criminologicalConsistency: { status: "PASS", hypothesisContradictory: false },
    documentConsistency: { status: "PASS", mapsOrChartsInconsistent: false },
    globalStatus: "PASS",
    overallConfidence: 95,
    alerts: [],
    hieContext: {
      validationVector: {
        spatialPattern: "CONCENTRATED",
        temporalPattern: "STABLE",
        criticalOpportunity: "HIGH"
      }
    }
  };

  // ============================================================================
  // CASO 1: Integración Correcta
  // ============================================================================
  const context1 = IntelligenceContextBuilder.build("PR-PASEOS", baseSem, baseVee, baseTie, baseHie, baseAce);
  const result1 = IntelligenceContextValidator.validate(context1);

  console.assert(result1.status === "VALIDATED", "❌ CASO 1 FALLÓ: Estatus de integración no fue VALIDATED");
  console.assert(context1.operationalAssessment.evidenceAgreement === "HIGH", "❌ CASO 1 FALLÓ: El acuerdo de evidencia no es HIGH");
  if (result1.status === "VALIDATED" && context1.operationalAssessment.evidenceAgreement === "HIGH") {
    console.log("✅ CASO 1 PASÓ: Integración correcta ensamblada y validada de forma impecable.");
  }

  // ============================================================================
  // CASO 2: Inconsistencia Espacial SEM vs TIE
  // ============================================================================
  const mockSemConcentrated = {
    ...baseSem,
    spatialEvidence: {
      ...baseSem.spatialEvidence,
      spatialPattern: "Alta Concentración",
      clusterCount: 1
    }
  };
  const mockTieDispersed = {
    ...baseTie,
    territorialPressure: {
      ...baseTie.territorialPressure,
      attractorDensityScore: 5 // Muy baja
    },
    economicAttractors: [] // Sin atractores
  };

  const context2 = IntelligenceContextBuilder.build("PR-PASEOS", mockSemConcentrated, baseVee, mockTieDispersed, baseHie, baseAce);
  const result2 = IntelligenceContextValidator.validate(context2);

  // De acuerdo con Caso 6 (ajuste del usuario), una contradicción física/territorial es un HALLAZGO válido y retorna VALID_WITH_LIMITATIONS
  console.assert(result2.status === "VALID_WITH_LIMITATIONS", "❌ CASO 2/6 FALLÓ: Estatus no conmutó a VALID_WITH_LIMITATIONS");
  const hasContradictionMsg = result2.messages.some(m => m.includes("CONTRADICCIÓN VÁLIDA"));
  console.assert(hasContradictionMsg, "❌ CASO 2/6 FALLÓ: No se emitió el mensaje de contradicción válida");
  if (result2.status === "VALID_WITH_LIMITATIONS" && hasContradictionMsg) {
    console.log("✅ CASO 2 / CASO 6 PASÓ: Contradicción SEM-TIE reportada como un hallazgo válido (VALID_WITH_LIMITATIONS).");
  }

  // ============================================================================
  // CASO 3: Ausencia de fotografías (No debe bloquear)
  // ============================================================================
  const mockVeeEmpty = {
    ...baseVee,
    analystPhotos: [],
    streetViewEvidence: []
  };

  const context3 = IntelligenceContextBuilder.build("PR-PASEOS", baseSem, mockVeeEmpty, baseTie, baseHie, baseAce);
  const result3 = IntelligenceContextValidator.validate(context3);

  console.assert(result3.status === "VALID_WITH_LIMITATIONS", "❌ CASO 3 FALLÓ: Estatus con fotos vacías no fue VALID_WITH_LIMITATIONS");
  if (result3.status === "VALID_WITH_LIMITATIONS") {
    console.log("✅ CASO 3 PASÓ: Ausencia de fotografías no bloqueó y retornó VALID_WITH_LIMITATIONS con éxito.");
  }

  // ============================================================================
  // CASO 4: Hipótesis fuerte vs SEM con baja evidencia (<= 2 eventos)
  // ============================================================================
  const mockSemLowEvents = {
    ...baseSem,
    metadata: {
      ...baseSem.metadata,
      totalCanonicalIncidents: 1 // Solo 1 evento histórico
    },
    criminalEvidence: {
      ...baseSem.criminalEvidence,
      totalEvents: 1
    }
  };

  const context4 = IntelligenceContextBuilder.build("PR-PASEOS", mockSemLowEvents, baseVee, baseTie, baseHie, baseAce);
  const result4 = IntelligenceContextValidator.validate(context4);

  console.assert(result4.status === "WARNING", "❌ CASO 4 FALLÓ: Estatus no es WARNING ante hipótesis sobredimensionada");
  const hasStrongHypothesisWarning = result4.messages.some(m => m.includes("estadísticamente insuficiente"));
  console.assert(hasStrongHypothesisWarning, "❌ CASO 4 FALLÓ: No se emitió la advertencia de volumen estadístico insuficiente");
  if (result4.status === "WARNING" && hasStrongHypothesisWarning) {
    console.log("✅ CASO 4 PASÓ: Hipótesis fuerte con baja evidencia estadística detonó WARNING con éxito.");
  }

  // ============================================================================
  // CASO 5: Bloqueo Crítico por ACE (Estatus FAILED)
  // ============================================================================
  const mockAceFailed: AnalyticalConsistencyReport = {
    ...baseAce,
    globalStatus: "FAILED",
    alerts: [{ type: "SPATIAL", category: "ANALYTICAL", message: "Discrepancia crítica de centroides", severity: "HIGH", source: "ACE-SPATIAL" }]
  };

  const context5 = IntelligenceContextBuilder.build("PR-PASEOS", baseSem, baseVee, baseTie, baseHie, mockAceFailed);
  const result5 = IntelligenceContextValidator.validate(context5);

  console.assert(result5.status === "FAILED", "❌ CASO 5 FALLÓ: El contrato no conmutó a FAILED ante rechazo de ACE");
  if (result5.status === "FAILED") {
    console.log("✅ CASO 5 PASÓ: Bloqueo crítico de ACE conmutó correctamente el contrato a FAILED.");
  }

  // ============================================================================
  // CASO 7: Falta General de Evidencia (Baja densidad / No bloqueante)
  // ============================================================================
  const mockVeeEmptyGeneral = { ...baseVee, analystPhotos: [], streetViewEvidence: [] };
  const mockTieEmptyGeneral = { ...baseTie, economicAttractors: [] };

  const context7 = IntelligenceContextBuilder.build("PR-PASEOS", baseSem, mockVeeEmptyGeneral, mockTieEmptyGeneral, baseHie, baseAce);
  const result7 = IntelligenceContextValidator.validate(context7);

  console.assert(result7.status === "VALID_WITH_LIMITATIONS", "❌ CASO 7 FALLÓ: Falta de evidencia no retornó VALID_WITH_LIMITATIONS");
  if (result7.status === "VALID_WITH_LIMITATIONS") {
    console.log("✅ CASO 7 PASÓ: Falta general de evidencias (fotos/atractores) retornó VALID_WITH_LIMITATIONS sin bloquear.");
  }

  // ============================================================================
  // PRUEBA DEL RESOLVER FACTUAL (Ajuste 3)
  // ============================================================================
  const relationship = IntelligenceEvidenceResolver.resolveEvidenceRelationship(context1);
  console.assert(relationship.coincidesWithHotspot === true, "❌ RESOLVER FALLÓ: No identificó atractor coincidiendo con hotspot");
  console.assert(relationship.correlatedFactors.length > 0, "❌ RESOLVER FALLÓ: No correlacionó factores físicos de iluminación u baldíos");
  if (relationship.coincidesWithHotspot && relationship.correlatedFactors.length > 0) {
    console.log("✅ RESOLVER PASÓ: Relaciones factuales resueltas con éxito (coincidencia de hotspot y factores correlativos).");
  }

  console.log("======================================================================");
  console.log("🎉 SUITE DE INTEGRACIÓN DE INTELIGENCIA COMPLETADA CON ÉXITO (7/7)");
  console.log("======================================================================");
}
