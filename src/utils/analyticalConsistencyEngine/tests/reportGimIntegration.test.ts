import { AnalyticalConsistencyEngine } from "../analyticalConsistencyEngine";
import { buildIntelligenceBriefing } from "../../intelligenceLayoutEngine";
import { ACEPayload } from "../models/aceTypes";
import { GimReportGeoSanitizer } from "../../gangIntelligenceEngine/sanitizers/gimReportGeoSanitizer";

// Mock de la SEM de Paseos como base sólida certificada
const mockPaseosSem: any = {
  metadata: {
    projectId: "Lwh3M1QJGc9HucZTwtWo",
    analysisDate: "2026-07-13T12:00:00Z",
    sieVersion: "2.0",
    semVersion: "1.0",
    totalCanonicalIncidents: 1368,
    analysisRadiusMeters: 1000,
    centerLat: 21.80929,
    centerLng: -102.26964
  },
  criminalEvidence: {
    totalEvents: 1368,
    crimeTypes: [{ type: "ROBO TRANSEÚNTE", count: 1368 }],
    dominantCrime: "ROBO TRANSEÚNTE",
    concentrationScore: 1.0
  },
  temporalEvidence: {
    trendDirection: "stable",
    trendSlope: 0,
    seasonalityIndex: 0.85,
    criticalPeriods: ["Lunes"],
    anomalies: [],
    temporalCoverage: {
      startDate: "2018-01-01",
      endDate: "2025-12-31"
    }
  },
  spatialEvidence: {
    hotspots: [{ id: "h1", center: { lat: 21.80929, lng: -102.26964 }, events: 450, densityScore: 0.8 }],
    clusterCount: 3,
    centerOfGravity: { lat: 21.80929, lng: -102.26964 },
    dispersionMeters: 250,
    entropy: 0.31,
    spatialPattern: "CONCENTRACIÓN ESPACIAL CRÍTICA (HIPER-HOTSPOTS)"
  },
  predictiveEvidence: {
    poissonProbability: 0.92,
    nearRepeatRisk: 0.8,
    modelFit: true,
    confidenceMetrics: {
      statisticalConfidence: 95,
      operationalReliability: 90
    }
  },
  qualityEvidence: {
    dataCompleteness: 98,
    statisticalValidity: true,
    warnings: [],
    validationStatus: "VALIDATED"
  },
  limitations: []
};

// Base payload compatible de entrada para ACE
const baseConsistentPayload: ACEPayload = {
  projectId: "EXP-2026-PASEOS", // Prefijo EXP-
  tceContext: {
    centroid: { lat: 21.80929, lng: -102.26964 },
    radiusMeters: 1000,
    startDate: "2018-01-01",
    endDate: "2025-12-31"
  },
  sieEventsCount: 1368,
  semContext: mockPaseosSem,
  cieContext: {
    centroid: { lat: 21.80929, lng: -102.26964 },
    radiusMeters: 1000,
    eventsCount: 1368,
    hotspotsCount: 1
  },
  hieContext: {
    validationVector: {
      spatialPattern: "CONCENTRATED",
      temporalPattern: "SEASONAL",
      criticalOpportunity: "HIGH"
    }
  },
  reportContext: {
    mapCount: 2,
    chartsCount: 3,
    startDate: "2018-01-01",
    endDate: "2025-12-31",
    eventsCount: 1368
  }
};

// Base del Report Payload (Salida editorial cruda de Gemini)
const baseEditorialPayload: any = {
  projectName: "Paseos de Aguascalientes",
  projectId: "EXP-2026-PASEOS",
  date: "14/07/2026",
  analyst: "Analista Táctico",
  geometryType: "polygon",
  areaGeografica: "Aguascalientes, México",
  contextoTerritorial: "Contexto general...",
  hipotesisPrincipal: "Hipótesis...",
  valoracionOperacional: "Valoración...",
  trazabilidadMatrix: [],
  maps: [],
  graphs: [],
  photoEvidence: [],
  streetViewAnalysis: [],
  hypothesisGraph: { title: "Grafo HIG", dataUrl: "data:", interpretation: "Grafo..." },
  osintSynthesized: "OSINT...",
  pandillasAnalysis: "Análisis crudo legado de pandillas.", // Fallback por defecto
  sweepsData: [],
  conclusiones: { hallazgosCriticos: [], riesgosInmediatos: [], escenariosFuturos: [], recomendacionesTacticas: [], recomendacionesEstrategicas: [] },
  executiveSummary: "Resumen...",
  finalHypothesis: "Hipótesis..."
};

export function runReportGimTests(): { passedCount: number; failedCount: number } {
  console.log("=== INICIANDO SUITE DE PRUEBAS DE INTEGRACIÓN EDITORIAL ACE → REPORT (ADR-008.8.3) ===");
  let passedCount = 0;
  let failedCount = 0;

  function assertTest(condition: boolean, msg: string) {
    if (condition) {
      console.log(`✅ [PASS] ${msg}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${msg}`);
      failedCount++;
    }
  }

  try {
    // =========================================================================
    // TEST-REPORT-GIM-001: GIM certificado (PASS) -> Genera bloque editorial
    // =========================================================================
    const payload1 = {
      ...baseConsistentPayload,
      gimContext: {
        confidenceScore: 90,
        limitationsCount: 0,
        hasTraceability: true,
        contradictoryEvidenceCount: 0,
        evidenceCount: { graffiti: 5, osintEvents: 3 },
        evidenceDescriptions: ["Grafiti con simbología asociada: Número 13"],
        analyticalObservations: ["Influencia de tipo SYMBOLIC con nivel de actividad MEDIUM"]
      }
    };

    const report1 = AnalyticalConsistencyEngine.audit(payload1, "EXPORT");
    
    // Inyectamos el contexto de consistencia unificado en el payload editorial
    const editorialPayload1 = {
      ...baseEditorialPayload,
      intelligenceContext: { aceReport: report1 }
    };

    const briefing1 = buildIntelligenceBriefing({ findings: [] } as any, editorialPayload1);
    const pagePandillas1 = briefing1.pages.find(p => p.id === "page-pandillas");

    assertTest(
      pagePandillas1 !== undefined &&
      !!pagePandillas1.interpretation?.includes("HALLAZGO") &&
      !!pagePandillas1.interpretation?.includes("CERT-GIM-2026-EXP2026PASEOS") &&
      !!pagePandillas1.interpretation?.includes("ANÁLISIS"),
      "TEST-REPORT-GIM-001: El payload de GIM certificado genera la estructura de 5 secciones con hash de trazabilidad."
    );

    // =========================================================================
    // TEST-REPORT-GIM-002: GIM certificado con limitaciones -> Genera limitaciones
    // =========================================================================
    const payload2 = {
      ...baseConsistentPayload,
      gimContext: {
        confidenceScore: 60, // Confianza baja (<80) genera advertencia metodológica automática
        limitationsCount: 2,
        hasTraceability: true,
        contradictoryEvidenceCount: 0,
        evidenceCount: { graffiti: 3, osintEvents: 0 },
        evidenceDescriptions: ["Grafiti localizado"],
        analyticalObservations: ["Influencia simbólica de baja actividad"]
      }
    };

    const report2 = AnalyticalConsistencyEngine.audit(payload2, "EXPORT");
    const editorialPayload2 = {
      ...baseEditorialPayload,
      intelligenceContext: { aceReport: report2 }
    };

    const briefing2 = buildIntelligenceBriefing({ findings: [] } as any, editorialPayload2);
    const pagePandillas2 = briefing2.pages.find(p => p.id === "page-pandillas");

    assertTest(
      pagePandillas2 !== undefined &&
      !!pagePandillas2.interpretation?.includes("limitaciones metodológicas") &&
      !!pagePandillas2.interpretation?.includes("confianza cualitativa inicial moderada"),
      "TEST-REPORT-GIM-002: El reporte con baja confianza inyecta de forma obligatoria el bloque de Limitaciones Metodológicas."
    );

    // =========================================================================
    // TEST-REPORT-GIM-003: Bloqueo de GEM Cruda directa sin pasar por ACE (BLOCKED)
    // =========================================================================
    // El motor de maquetación lee de aceReport.certifiedGimOutput. Si no está presente pero
    // hay un intento de saltarse el control inyectando datos GEM directo, el sistema no dibuja
    // el formato certificado.
    const editorialPayload3 = {
      ...baseEditorialPayload,
      intelligenceContext: {
        rawGemDirectAttempt: { confidenceScore: 100 } // Intento de inyección cruda bypass
      }
    };

    const briefing3 = buildIntelligenceBriefing({ findings: [] } as any, editorialPayload3);
    const pagePandillas3 = briefing3.pages.find(p => p.id === "page-pandillas");

    assertTest(
      pagePandillas3 !== undefined &&
      pagePandillas3.interpretation === baseEditorialPayload.pandillasAnalysis,
      "TEST-REPORT-GIM-003: El motor ignora inyecciones directas de GEM que hagan bypass de ACE, aplicando el fallback legado seguro."
    );

    // =========================================================================
    // TEST-REPORT-GIM-004: Sanitización de Coordenadas Tácticas (PASS)
    // =========================================================================
    const sanitizedText1 = GimReportGeoSanitizer.approximateLocation(21.8152, -102.2601);
    const rawDescription = "Se identificaron marcas en lat: 21.80929, longitude: -102.26964 del sector.";
    const sanitizedDescription = GimReportGeoSanitizer.sanitizeDescription(rawDescription);

    assertTest(
      sanitizedText1.includes("Cuadrante analítico") &&
      sanitizedDescription.includes("[Ubicación Sanitizada]") || sanitizedDescription.includes("[Coordenadas Sanitizadas]"),
      "TEST-REPORT-GIM-004: El Sanitizer geoespacial convierte de forma exitosa coordenadas numéricas exactas en sectores textuales agregados."
    );

    // =========================================================================
    // TEST-REPORT-GIM-005: Expediente histórico legado sin GIM (PASS sin regresión)
    // =========================================================================
    const editorialPayload5 = {
      ...baseEditorialPayload,
      intelligenceContext: null // Histórico puro sin GIM ni ACE audit
    };

    const briefing5 = buildIntelligenceBriefing({ findings: [] } as any, editorialPayload5);
    const pagePandillas5 = briefing5.pages.find(p => p.id === "page-pandillas");

    assertTest(
      pagePandillas5 !== undefined &&
      pagePandillas5.interpretation === baseEditorialPayload.pandillasAnalysis,
      "TEST-REPORT-GIM-005: Los expedientes legados sin contexto GIM se procesan sin errores, utilizando el fallback textual estándar."
    );

    // =========================================================================
    // TEST-REPORT-GIM-006: Dictamen de ACE is FAILED -> Descarte Institucional (PASS)
    // =========================================================================
    const payload6 = {
      ...baseConsistentPayload,
      gimContext: {
        confidenceScore: 95,
        limitationsCount: 0,
        hasTraceability: true,
        contradictoryEvidenceCount: 0,
        evidenceCount: { graffiti: 1, osintEvents: 0 },
        evidenceDescriptions: ["Grafiti aislado"],
        analyticalObservations: ["Se reporta un miembro confirmado de grupo local en el baricentro"] // Inyecta término prohibido -> FAILED
      }
    };

    const report6 = AnalyticalConsistencyEngine.audit(payload6, "EXPORT");
    const editorialPayload6 = {
      ...baseEditorialPayload,
      intelligenceContext: { aceReport: report6 }
    };

    const briefing6 = buildIntelligenceBriefing({ findings: [] } as any, editorialPayload6);
    const pagePandillas6 = briefing6.pages.find(p => p.id === "page-pandillas");

    assertTest(
      pagePandillas6 !== undefined &&
      !!pagePandillas6.interpretation?.includes("RECOMENDACIÓN INSTITUCIONAL DE DESCARTE") &&
      !!pagePandillas6.interpretation?.includes("ha sido SUSPENDIDO de forma oficial"),
      "TEST-REPORT-GIM-006: Si la consistencia de ACE es FAILED, el Report Engine suspende la página publicando el dictamen oficial de descarte."
    );

  } catch (error: any) {
    console.error("Fallo inesperado al ejecutar las pruebas de integración Report-GIM:", error);
    failedCount++;
  }

  console.log(`=== FIN DE PRUEBAS REPORT-GIM: PASADAS: ${passedCount}, FALLADAS: ${failedCount} ===`);
  return { passedCount, failedCount };
}
