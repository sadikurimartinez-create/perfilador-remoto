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

export function runAceTests() {
  console.log("=== INICIANDO SUITE DE PRUEBAS DEL ANALYTICAL CONSISTENCY ENGINE (ACE) ===");

  // =========================================================================
  // PRUEBA 1: Datos Consistentes (PASS esperado)
  // =========================================================================
  const consistentPayload: ACEPayload = {
    projectId: "Lwh3M1QJGc9HucZTwtWo",
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

  const report1 = AnalyticalConsistencyEngine.audit(consistentPayload, "EXPORT");
  console.assert(report1.globalStatus === "PASS", `Prueba 1 falló. Esperado "PASS", obtenido "${report1.globalStatus}"`);
  console.assert(report1.overallConfidence === 100, `Prueba 1 falló. Confianza esperada 100, obtenida ${report1.overallConfidence}`);
  console.log(`[PASS] Prueba 1: Auditoría de consistencia PASS y confianza al ${report1.overallConfidence}%`);

  // =========================================================================
  // PRUEBA 2: Inconsistencia Cuantitativa Artificial (FAILED cuantitativo esperado)
  // =========================================================================
  const inconsistentQuantPayload: ACEPayload = {
    ...consistentPayload,
    cieContext: {
      ...consistentPayload.cieContext,
      eventsCount: 1200 // Modificado de 1368 a 1200 (desviación > 10%)
    }
  };

  const report2 = AnalyticalConsistencyEngine.audit(inconsistentQuantPayload, "EXPORT");
  console.assert(report2.globalStatus === "FAILED", `Prueba 2 falló. Esperado "FAILED", obtenido "${report2.globalStatus}"`);
  console.assert(report2.blockingReason !== undefined, "Prueba 2 falló. Se esperaba un blockingReason estructurado.");
  console.assert(report2.blockingReason!.some(r => r.module === "QUANTITATIVE"), "Prueba 2 falló. No se encontró la causa de bloqueo cuantitativa.");
  console.log(`[PASS] Prueba 2: Bloqueo de exportación cuantitativa crítico detectado.`);
  console.log(`  └─> Motivo: ${report2.blockingReason![0].message}`);

  // =========================================================================
  // PRUEBA 3: Desplazamiento Geográfico del Centroide (FAILED espacial esperado)
  // =========================================================================
  const inconsistentSpatialPayload: ACEPayload = {
    ...consistentPayload,
    tceContext: {
      ...consistentPayload.tceContext,
      centroid: { lat: 21.81500, lng: -102.26964 } // Desplazamiento de ~630m (> 100m de tolerancia)
    }
  };

  const report3 = AnalyticalConsistencyEngine.audit(inconsistentSpatialPayload, "EXPORT");
  console.assert(report3.globalStatus === "FAILED", `Prueba 3 falló. Esperado "FAILED", obtenido "${report3.globalStatus}"`);
  console.assert(report3.blockingReason !== undefined, "Prueba 3 falló. Se esperaba un blockingReason estructurado.");
  console.assert(report3.blockingReason!.some(r => r.module === "SPATIAL"), "Prueba 3 falló. No se encontró la causa de bloqueo espacial.");
  console.log(`[PASS] Prueba 3: Bloqueo de exportación por desplazamiento geográfico crítico detectado.`);
  console.log(`  └─> Motivo: ${report3.blockingReason![0].message}`);

  // =========================================================================
  // PRUEBA 4: Hipótesis Contradictoria (WARNING analítico esperado)
  // =========================================================================
  const contradictoryHypothesisPayload: ACEPayload = {
    ...consistentPayload,
    hieContext: {
      validationVector: {
        spatialPattern: "DISPERSED", // Contradicción con patrón "CONCENTRADO" de la SEM
        temporalPattern: "SEASONAL",
        criticalOpportunity: "HIGH"
      }
    }
  };

  const report4 = AnalyticalConsistencyEngine.audit(contradictoryHypothesisPayload, "EXPORT");
  console.assert(report4.globalStatus === "WARNING", `Prueba 4 falló. Esperado "WARNING", obtenido "${report4.globalStatus}"`);
  console.assert(report4.criminologicalConsistency.status === "WARNING", "Prueba 4 falló. Se esperaba WARNING en la validación criminológica.");
  console.assert(report4.alerts.some(a => a.category === "ANALYTICAL"), "Prueba 4 falló. Se esperaba una alerta de categoría analítica.");
  console.log(`[PASS] Prueba 4: Advertencia analítica por contradicción criminológica detectada.`);
  console.log(`  └─> Alerta: ${report4.alerts.find(a => a.type === "CRIMINOLOGICAL")!.message}`);

  // =========================================================================
  // PRUEBA 5: Diferencia Temporal de Cobertura (FAILED temporal esperado)
  // =========================================================================
  const inconsistentTimePayload: ACEPayload = {
    ...consistentPayload,
    reportContext: {
      ...consistentPayload.reportContext,
      startDate: "2020-01-01" // SEM abarca de 2018-01-01 a 2025-12-31
    }
  };

  const report5 = AnalyticalConsistencyEngine.audit(inconsistentTimePayload, "EXPORT");
  console.assert(report5.globalStatus === "FAILED", `Prueba 5 falló. Esperado "FAILED", obtenido "${report5.globalStatus}"`);
  console.assert(report5.blockingReason !== undefined, "Prueba 5 falló. Se esperaba un blockingReason estructurado.");
  console.assert(report5.blockingReason!.some(r => r.module === "TEMPORAL"), "Prueba 5 falló. No se encontró la causa de bloqueo temporal.");
  console.log(`[PASS] Prueba 5: Bloqueo de exportación por inconsistencia temporal detectado.`);
  console.log(`  └─> Motivo: ${report5.blockingReason![0].message}`);

  // =========================================================================
  // PRUEBA 6: Pérdida Documental de Mapas (FAILED documental esperado)
  // =========================================================================
  const inconsistentDocumentPayload: ACEPayload = {
    ...consistentPayload,
    reportContext: {
      ...consistentPayload.reportContext,
      mapCount: 0 // SEM registra hotspots pero el reporte tiene 0 mapas insertados
    }
  };

  const report6 = AnalyticalConsistencyEngine.audit(inconsistentDocumentPayload, "EXPORT");
  console.assert(report6.globalStatus === "FAILED", `Prueba 6 falló. Esperado "FAILED", obtenido "${report6.globalStatus}"`);
  console.assert(report6.blockingReason !== undefined, "Prueba 6 falló. Se esperaba un blockingReason estructurado.");
  console.assert(report6.blockingReason!.some(r => r.module === "DOCUMENT"), "Prueba 6 falló. No se encontró la causa de bloqueo documental.");
  console.log(`[PASS] Prueba 6: Bloqueo de exportación por pérdida documental de mapas detectado.`);
  console.log(`  └─> Motivo: ${report6.blockingReason![0].message}`);

  // =========================================================================
  // PRUEBA 7: Contradicción Predictiva (WARNING predictivo esperado)
  // =========================================================================
  const predictiveWarningPayload: ACEPayload = {
    ...consistentPayload,
    semContext: {
      ...mockPaseosSem,
      predictiveEvidence: {
        ...mockPaseosSem.predictiveEvidence,
        poissonProbability: 0.15 // Probabilidad baja (< 0.30)
      }
    },
    hieContext: {
      validationVector: {
        spatialPattern: "CONCENTRATED",
        temporalPattern: "SEASONAL",
        criticalOpportunity: "HIGH" // Contradicción: oportunidad ALTA pero probabilidad BAJA
      }
    }
  };

  const report7 = AnalyticalConsistencyEngine.audit(predictiveWarningPayload, "EXPORT");
  console.assert(report7.globalStatus === "WARNING", `Prueba 7 falló. Esperado "WARNING", obtenido "${report7.globalStatus}"`);
  console.assert(report7.criminologicalConsistency.status === "WARNING", "Prueba 7 falló. Se esperaba WARNING en validación predictiva/criminológica.");
  console.assert(report7.alerts.some(a => a.source === "HIE-SEM-PREDICTIVE-CROSS"), "Prueba 7 falló. Se esperaba una alerta de contradicción predictiva.");
  console.log(`[PASS] Prueba 7: Advertencia analítica por contradicción predictiva detectada.`);
  console.log(`  └─> Alerta: ${report7.alerts.find(a => a.source === "HIE-SEM-PREDICTIVE-CROSS")!.message}`);

  // =========================================================================
  // AUDITORÍA HISTÓRICA: Verificar registro de historial (Ajuste 5)
  // =========================================================================
  const lastReport = report6;
  console.assert(lastReport.auditHistory !== undefined, "Falla historial de auditoría: no se generó.");
  console.assert(lastReport.auditHistory!.length > 1, "Falla historial de auditoría: se esperaba acumulación de ejecuciones.");
  console.log(`[PASS] Historial de Auditoría ACE: ${lastReport.auditHistory!.length} ejecuciones guardadas en archivo.`);

  console.log("=== PRUEBAS DEL ANALYTICAL CONSISTENCY ENGINE COMPLETADAS CON ÉXITO ===");
}
