import { AnalyticalConsistencyEngine } from "../analyticalConsistencyEngine";
import { ACEPayload } from "../models/aceTypes";

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

// Base payload compatible
const baseConsistentPayload: ACEPayload = {
  projectId: "EXP-2026-PASEOS", // Prefijo oficial EXP- para forzar modo informe institucional
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

const adr02029ApprovedGimFields = {
  sourceIntegrityStatus: "VERIFIED" as const,
  authorityClassification: "AUTHORITATIVE" as const,
  nonAuthoritativeSourcesCount: 0,
  humanValidationStatus: "APPROVED" as const,
  validatedByUserId: "ace-gim-test-user",
  humanValidatedAt: "2026-08-30T12:00:00.000Z",
  lineage: {
    evidenceIds: ["gim-evidence-1"],
    findingIds: ["gim-finding-1"],
    analysisIds: ["gim-analysis-1"],
    providerProvenance: ["GIM_TEST_FIXTURE"]
  }
};

export function runAceGimTests(): { passedCount: number; failedCount: number } {
  console.log("=== INICIANDO SUITE DE PRUEBAS DE INTEGRACIÓN GIM → ACE (ADR-008.8.2) ===");
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
    // TEST-ACE-GIM-001: GIM válido, lenguaje neutral, trazabilidad completa (PASS)
    // =========================================================================
    const payload1 = {
      ...baseConsistentPayload,
      gimContext: {
        ...adr02029ApprovedGimFields,
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
    assertTest(report1.globalStatus === "PASS", "TEST-ACE-GIM-001: GIM válido con lenguaje institucional neutro califica como PASS global.");

    // =========================================================================
    // TEST-ACE-GIM-002: Grafiti aislado + lenguaje de control territorial (FAILED)
    // =========================================================================
    const payload2 = {
      ...baseConsistentPayload,
      gimContext: {
        ...adr02029ApprovedGimFields,
        confidenceScore: 90,
        limitationsCount: 0,
        hasTraceability: true,
        contradictoryEvidenceCount: 0,
        evidenceCount: { graffiti: 1, osintEvents: 0 },
        evidenceDescriptions: ["Grafiti con simbología asociada: Letra M"],
        analyticalObservations: ["Influencia de tipo TERRITORIAL con control absoluto de zona"]
      }
    };

    const report2 = AnalyticalConsistencyEngine.audit(payload2, "EXPORT");
    assertTest(
      report2.globalStatus === "FAILED" && 
      report2.alerts.some(a => a.message.includes("Falta de proporcionalidad analítica")),
      "TEST-ACE-GIM-002: Grafiti aislado interpretado con afirmación de 'control absoluto' bloquea el expediente como FAILED."
    );

    // =========================================================================
    // TEST-ACE-GIM-003: Lenguaje incriminatorio 'miembro confirmado' (FAILED)
    // =========================================================================
    const payload3 = {
      ...baseConsistentPayload,
      gimContext: {
        ...adr02029ApprovedGimFields,
        confidenceScore: 90,
        limitationsCount: 0,
        hasTraceability: true,
        contradictoryEvidenceCount: 0,
        evidenceCount: { graffiti: 4, osintEvents: 2 },
        evidenceDescriptions: ["Grafiti con simbología asociada: Número 18"],
        analyticalObservations: ["Se reporta un miembro confirmado de grupo local en el baricentro"]
      }
    };

    const report3 = AnalyticalConsistencyEngine.audit(payload3, "EXPORT");
    assertTest(
      report3.globalStatus === "FAILED" &&
      report3.alerts.some(a => a.message.includes("Violación de neutralidad lingüística")),
      "TEST-ACE-GIM-003: El uso de jerga incriminatoria ('miembro confirmado') detiene la readiness con estatus FAILED."
    );

    // =========================================================================
    // TEST-ACE-GIM-004: Confianza baja (60) sin limitaciones (WARNING)
    // =========================================================================
    const payload4 = {
      ...baseConsistentPayload,
      gimContext: {
        ...adr02029ApprovedGimFields,
        confidenceScore: 60,
        limitationsCount: 0,
        hasTraceability: true,
        contradictoryEvidenceCount: 0,
        evidenceCount: { graffiti: 3, osintEvents: 1 },
        evidenceDescriptions: ["Grafiti con simbología asociada: Tag genérico"],
        analyticalObservations: ["Influencia de tipo PASSIVE con nivel de actividad LOW"]
      }
    };

    const report4 = AnalyticalConsistencyEngine.audit(payload4, "EXPORT");
    assertTest(
      report4.globalStatus === "WARNING" &&
      report4.alerts.some(a => a.message.includes("Falta de calibración epistémica")),
      "TEST-ACE-GIM-004: Confianza baja de datos sin declarar limitaciones metodológicas genera alerta WARNING."
    );

    // =========================================================================
    // TEST-ACE-GIM-005: Sin trazabilidad (FAILED en modo institucional, WARNING en exploratorio)
    // =========================================================================
    const payload5Inst = {
      ...baseConsistentPayload, // Prefijo EXP-
      gimContext: {
        ...adr02029ApprovedGimFields,
        confidenceScore: 90,
        limitationsCount: 0,
        hasTraceability: false,
        contradictoryEvidenceCount: 0,
        evidenceCount: { graffiti: 4, osintEvents: 2 },
        evidenceDescriptions: ["Grafiti con simbología asociada: Número 13"],
        analyticalObservations: ["Influencia de tipo SYMBOLIC"]
      }
    };

    const payload5Expl = {
      ...baseConsistentPayload,
      projectId: "PR-2026-EXPLORATORIO", // Sin prefijo EXP-
      gimContext: {
        ...adr02029ApprovedGimFields,
        confidenceScore: 90,
        limitationsCount: 0,
        hasTraceability: false,
        contradictoryEvidenceCount: 0,
        evidenceCount: { graffiti: 4, osintEvents: 2 },
        evidenceDescriptions: ["Grafiti con simbología asociada: Número 13"],
        analyticalObservations: ["Influencia de tipo SYMBOLIC"]
      }
    };

    const report5Inst = AnalyticalConsistencyEngine.audit(payload5Inst, "EXPORT");
    const report5Expl = AnalyticalConsistencyEngine.audit(payload5Expl, "VALIDATE");

    assertTest(
      report5Inst.globalStatus === "FAILED" && 
      report5Expl.globalStatus === "WARNING" &&
      report5Inst.alerts.some(a => a.message.includes("Falta de trazabilidad")) &&
      report5Expl.alerts.some(a => a.message.includes("Trazabilidad ausente en modo exploratorio")),
      "TEST-ACE-GIM-005: La falta de trazabilidad bloquea expedientes oficiales como FAILED, pero emite advertencia WARNING en modo exploratorio."
    );

    // =========================================================================
    // TEST-ACE-GIM-006: Expediente histórico sin GIM (PASS sin regresión)
    // =========================================================================
    const payload6 = {
      ...baseConsistentPayload,
      gimContext: null // Expediente histórico sin GIM
    };

    const report6 = AnalyticalConsistencyEngine.audit(payload6, "EXPORT");
    assertTest(
      report6.globalStatus === "PASS" && report6.overallConfidence === 100,
      "TEST-ACE-GIM-006: Expedientes históricos sin módulo de pandillas continúan operando con PASS al 100% de confianza."
    );

    // =========================================================================
    // TEST-ACE-GIM-007: ACE mantiene fallo cuantitativo propio con GIM válido
    // =========================================================================
    const payload7 = {
      ...baseConsistentPayload,
      sieEventsCount: 500, // Discrepancia cuantitativa drástica para inducir fallo propio de ACE
      gimContext: {
        ...adr02029ApprovedGimFields,
        confidenceScore: 90,
        limitationsCount: 0,
        hasTraceability: true,
        contradictoryEvidenceCount: 0,
        evidenceCount: { graffiti: 5, osintEvents: 3 },
        evidenceDescriptions: ["Grafiti con simbología asociada: Número 13"],
        analyticalObservations: ["Influencia de tipo SYMBOLIC con nivel de actividad MEDIUM"]
      }
    };

    const report7 = AnalyticalConsistencyEngine.audit(payload7, "EXPORT");
    assertTest(
      report7.globalStatus === "FAILED" && 
      report7.alerts.some(a => a.type === "QUANTITATIVE"),
      "TEST-ACE-GIM-007: ACE mantiene de forma soberana sus fallos cuantitativos propios aun cuando los datos del GIM local sean válidos."
    );

  } catch (error: any) {
    console.error("Fallo inesperado al ejecutar las pruebas de integración GIM-ACE:", error);
    failedCount++;
  }

  console.log(`=== FIN DE PRUEBAS GIM → ACE: PASADAS: ${passedCount}, FALLADAS: ${failedCount} ===`);
  return { passedCount, failedCount };
}
