import assert from "assert";
import { ReportEngineKernelClass } from "../src/lib/reportEngine";
import { IntelligenceContextBuilder } from "../src/utils/intelligenceIntegrationContract/intelligenceContextBuilder";

// Mock data generator for tests
function createMockSem(totalEvents: number) {
  return {
    metadata: {
      projectId: "TEST_PROJ",
      analysisDate: "2026-07-14",
      sieVersion: "2.0.0",
      semVersion: "1.0.0",
      totalCanonicalIncidents: totalEvents,
      analysisRadiusMeters: 1000,
      centerLat: 21.88,
      centerLng: -102.29
    },
    criminalEvidence: {
      totalEvents,
      crimeTypes: [{ type: "Robo con Violencia", count: totalEvents }],
      dominantCrime: "Robo con Violencia",
      concentrationScore: 100
    },
    temporalEvidence: {
      trendDirection: "stable" as const,
      trendSlope: 0,
      seasonalityIndex: 1.0,
      criticalPeriods: ["18:00-22:00"],
      anomalies: [],
      temporalCoverage: {
        startDate: "2026-01-01",
        endDate: "2026-06-01"
      }
    },
    spatialEvidence: {
      hotspots: [
        { id: "h1", center: { lat: 21.88, lng: -102.29 }, events: totalEvents, densityScore: 0.95 }
      ],
      clusterCount: 1,
      centerOfGravity: { lat: 21.88, lng: -102.29 },
      dispersionMeters: 100,
      entropy: 0.5,
      spatialPattern: "Alta Concentración"
    },
    predictiveEvidence: {
      poissonProbability: 0.85,
      nearRepeatRisk: 0.90,
      modelFit: true,
      confidenceMetrics: {
        statisticalConfidence: 95,
        operationalReliability: 90
      }
    },
    qualityEvidence: {
      dataCompleteness: 100,
      statisticalValidity: true,
      warnings: [],
      validationStatus: "VALIDATED" as const
    },
    limitations: [],
    variableTraceability: {
      totalEvents: { source: "test", engine: "test", version: "1.0", timestamp: "now" },
      hotspots: { source: "test", engine: "test", version: "1.0", timestamp: "now" },
      poissonRisk: { source: "test", engine: "test", version: "1.0", timestamp: "now" },
      trend: { source: "test", engine: "test", version: "1.0", timestamp: "now" }
    },
    intelligenceReadiness: {
      availableForHIE: true,
      availableForCIE: true,
      availableForReport: true
    },
    traceability: {
      source: "historicalIncidents" as const,
      sieVersion: "2.0.0",
      semVersion: "1.0.0",
      methodsUsed: ["DBSCAN"],
      generatedAt: "2026-07-14"
    }
  };
}

function createMockAceReport(status: "PASS" | "WARNING" | "FAILED", reasonMessage = "Test blockage reason") {
  return {
    globalStatus: status,
    overallConfidence: status === "PASS" ? 95 : (status === "WARNING" ? 80 : 40),
    alerts: status !== "PASS" ? [
      { module: "ACE", variable: "status", expected: "PASS/WARNING", received: status, severity: "HIGH" as const, message: reasonMessage }
    ] : [],
    blockingReason: status === "FAILED" ? [
      { module: "ACE", variable: "status", expected: "PASS/WARNING", received: "FAILED", message: reasonMessage }
    ] : undefined,
    metadata: { auditedAt: new Date().toISOString() }
  };
}

export async function runMigrationTests() {
  console.log("======================================================================");
  console.log("🏁 INICIANDO SUITE DE REGRESIÓN: MIGRACIÓN REPORT ENGINE HACIA IIC");
  console.log("======================================================================");

  const visualEvidence = {
    projectId: "TEST_PROJ",
    overallVisualConfidence: 90,
    analystPhotos: [
      { image: "img1", title: "Graffiti", description: "Graffiti en pared", finding: "Marcaje de territorio", operationalImpact: "Presencia de pandilla" }
    ],
    streetViewEvidence: [
      { image: "img2", title: "StreetView", description: "Cámara", finding: "Poca iluminación", operationalImpact: "Oportunidad de robo" }
    ],
    graffitiEvidence: [],
    territorialFindings: {
      criticalVulnerabilityCount: 2,
      primaryRiskFactor: "Falta de alumbrado",
      impactAreaSqm: 500
    },
    executiveAbstract: "Resumen visual",
    matrix56: []
  };

  const territorialEvidence = {
    projectId: "TEST_PROJ",
    projectName: "Proyecto Test",
    temVersion: "1.0.0",
    territorialContext: {
      tipologyName: "Residencial",
      areaSizeMeters: 5000,
      description: "Zona residencial"
    },
    urbanStructure: {
      landUse: "Residencial",
      streetGridType: "GRID" as const,
      vesselVulnerability: "MEDIUM" as const,
      permeabilityScore: 80
    },
    economicAttractors: [
      { id: "a1", name: "Cantina Test", activityCode: "123", category: "PUNTO_REUNION" as const, address: "Calle 1", lat: 21.88, lng: -102.29, distanceToHotspotMeters: 50, situationalInfluenceLevel: "HIGH" as const, criminologicalRole: "Concentración" }
    ],
    mobilityFactors: {
      transportNodeCount: 2,
      mainAccessPoints: ["Av. Principal"],
      vulnerabilityDescription: "Alta movilidad",
      pedestrianExposure: "HIGH" as const
    },
    environmentalRiskFactors: {
      lightingScore: "DEFICIENT" as const,
      visibilityObstructions: ["vegetación"],
      abandonedLotsCount: 1,
      structuralDeterioration: "MEDIUM" as const
    },
    territorialPressure: {
      hotspotProximityScore: 75,
      attractorDensityScore: 60,
      mobilityExposureScore: 80,
      environmentalVulnerabilityScore: 70
    },
    operationalImplications: [
      { directiveType: "PATROL_INCREASE" as const, locationReference: "Esquina 1", rationale: "Mayor frecuencia de delitos" }
    ],
    traceability: {
      variablesQueried: ["denue"],
      denueVersion: "2025",
      queryTimestamp: new Date().toISOString()
    },
    confidence: {
      operationalConfidence: 90,
      evidenceSupportCount: 5
    },
    validationStatus: "VALIDATED" as const
  };

  // Mock inputs matching ReportQualityGate expectations (requires maps, graphs, street view)
  const commonLockInput = {
    project: {
      id: "TEST_PROJ",
      nombre: "Proyecto Test",
      lat: 21.88,
      lng: -102.29,
      analysisRadius: 1000,
      geometryType: "polygon",
      historicalIncidents: []
    },
    content: `# 1. RESUMEN EJECUTIVO\nResumen de ejemplo.\n\n## 2. CONTEXTO TERRITORIAL\nContexto de ejemplo.\n\n## 3. HIPÓTESIS PRINCIPAL\nHipótesis de ejemplo.\n\n## 4. ANÁLISIS CARTOGRÁFICO\nMAPA 1\nInterpretación del mapa 1.\n\n## 5. MODELOS ANALÍTICOS Y ESTADÍSTICOS\nModelos de ejemplo.\n\n## 6. EVIDENCIA FOTOGRÁFICA\nEvidencia de ejemplo.\n\n## 7. ANÁLISIS VISUAL STREET VIEW\nStreet view de ejemplo.\n\n## 8. SÍNTESIS OSINT\nOSINT de ejemplo.\n\n## 9. ANÁLISIS DE PANDILLAS\nPandillas de ejemplo.\n\n## 10. HIPOTHESIS INTELLIGENCE GRAPH\nGrafo de ejemplo.\n\n## 11. CONCLUSIONES Y RECOMENDACIONES\nConclusiones de ejemplo.`,
    album: [
      { id: "img-1", url: "https://example.com/img1.jpg", previewUrl: "https://example.com/img1.jpg", comentario: "Falta de alumbrado publico en baricentro delictivo", riskLevel: "alto" }
    ],
    mapSnapshots: [
      { title: "Densidad de Calor", dataUrl: "data:image/png;base64,mock" }
    ],
    sweeps: [
      { engine: "REPUVE", source: "Registro de Vehiculos", data: "Sin incidencias", context: "Radio de analisis" }
    ],
    selectedAnnexes: {}
  };

  // --- CASO 1: Expediente completo ---
  console.log("\n🧪 Caso 1: Expediente completo (Debe ser READY_WITH_LIMITATIONS y validar con éxito debido a módulos futuros)");
  try {
    const sem = createMockSem(10);
    const aceReport = createMockAceReport("PASS");

    const iic = IntelligenceContextBuilder.build(
      "TEST_PROJ",
      sem as any,
      visualEvidence as any,
      territorialEvidence as any,
      { isHypothesisCriminologicalValid: true } as any,
      aceReport as any,
      { mapCount: 3 } as any
    );

    assert.strictEqual(iic.analysisReadiness, "READY_WITH_LIMITATIONS", "IIC should be READY_WITH_LIMITATIONS when future optional components are not yet integrated.");

    const kernel = new ReportEngineKernelClass();
    const executionId = "exec-test-1";

    await kernel.dispatch("INIT_KERNEL", { executionId });
    await kernel.dispatch("LOCK_INPUT", {
      ...commonLockInput,
      intelligenceContext: iic
    });

    await kernel.dispatch("APPLY_POWERUPS", {});
    await kernel.dispatch("DERIVE_LAYOUT", { executionId });
    await kernel.dispatch("VALIDATE_KERNEL", { executionId });

    assert.strictEqual(kernel.getState(), "VALIDATED", "Kernel state should transition to VALIDATED.");
    console.log("✅ CASO 1 COMPLETADO: Expediente READY transitó exitosamente a VALIDATED.");
  } catch (err: any) {
    console.error("❌ Falló el Caso 1:", err);
    throw err;
  }

  // --- CASO 2: Sin evidencia visual (READY_WITH_LIMITATIONS) ---
  console.log("\n🧪 Caso 2: Sin evidencia visual (Debe ser READY_WITH_LIMITATIONS y validar con éxito)");
  try {
    const sem = createMockSem(10);
    const aceReport = createMockAceReport("WARNING", "Faltan fotografías en terreno");

    const iic = IntelligenceContextBuilder.build(
      "TEST_PROJ",
      sem as any,
      null, // Sin evidencia visual
      territorialEvidence as any,
      { isHypothesisCriminologicalValid: true } as any,
      aceReport as any,
      { mapCount: 3 } as any
    );

    assert.strictEqual(iic.analysisReadiness, "READY_WITH_LIMITATIONS", "IIC should be READY_WITH_LIMITATIONS when photos are missing.");

    const kernel = new ReportEngineKernelClass();
    const executionId = "exec-test-2";

    await kernel.dispatch("INIT_KERNEL", { executionId });
    await kernel.dispatch("LOCK_INPUT", {
      ...commonLockInput,
      intelligenceContext: iic
    });

    await kernel.dispatch("APPLY_POWERUPS", {});
    await kernel.dispatch("DERIVE_LAYOUT", { executionId });
    await kernel.dispatch("VALIDATE_KERNEL", { executionId });

    assert.strictEqual(kernel.getState(), "VALIDATED", "Kernel state should transition to VALIDATED despite limitations.");
    console.log("✅ CASO 2 COMPLETADO: READY_WITH_LIMITATIONS sin fotos validó exitosamente.");
  } catch (err: any) {
    console.error("❌ Falló el Caso 2:", err);
    throw err;
  }

  // --- CASO 3: Sin OSINT ni pandillas (READY_WITH_LIMITATIONS) ---
  console.log("\n🧪 Caso 3: Sin OSINT ni pandillas (Debe ser READY_WITH_LIMITATIONS y validar con éxito)");
  try {
    const sem = createMockSem(10);
    const aceReport = createMockAceReport("PASS");

    // Pasamos un TIE válido pero con atractores vacíos para evitar 'isIntegrityBroken' (que requiere atractores si hay hotspots)
    const iic = IntelligenceContextBuilder.build(
      "TEST_PROJ",
      sem as any,
      visualEvidence as any,
      {
        ...territorialEvidence,
        economicAttractors: [] // Vacío pero no nulo, lo cual mantiene la integridad estructural del contrato
      } as any,
      { isHypothesisCriminologicalValid: true } as any,
      aceReport as any,
      { mapCount: 3 } as any
    );

    assert.strictEqual(iic.analysisReadiness, "READY_WITH_LIMITATIONS", "IIC should be READY_WITH_LIMITATIONS when territorial/OSINT evidence has limitations.");

    const kernel = new ReportEngineKernelClass();
    const executionId = "exec-test-3";

    await kernel.dispatch("INIT_KERNEL", { executionId });
    await kernel.dispatch("LOCK_INPUT", {
      ...commonLockInput,
      intelligenceContext: iic
    });

    await kernel.dispatch("APPLY_POWERUPS", {});
    await kernel.dispatch("DERIVE_LAYOUT", { executionId });
    await kernel.dispatch("VALIDATE_KERNEL", { executionId });

    assert.strictEqual(kernel.getState(), "VALIDATED", "Kernel state should transition to VALIDATED despite limitations.");
    console.log("✅ CASO 3 COMPLETADO: READY_WITH_LIMITATIONS sin OSINT/pandillas validó exitosamente.");
  } catch (err: any) {
    console.error("❌ Falló el Caso 3:", err);
    throw err;
  }

  // --- CASO 4: ACE FAILED (NOT_READY y bloqueo duro) ---
  console.log("\n🧪 Caso 4: ACE FAILED (Debe arrojar bloqueo estricto en VALIDATE_KERNEL)");
  try {
    const sem = createMockSem(10);
    const aceReport = createMockAceReport("FAILED", "Inconsistencia crítica detectada entre SEM y HIE");

    const iic = IntelligenceContextBuilder.build(
      "TEST_PROJ",
      sem as any,
      null,
      null,
      { isHypothesisCriminologicalValid: false } as any,
      aceReport as any,
      { mapCount: 1 } as any
    );

    assert.strictEqual(iic.analysisReadiness, "NOT_READY", "IIC should be NOT_READY when ACE status is FAILED.");

    const kernel = new ReportEngineKernelClass();
    const executionId = "exec-test-4";

    await kernel.dispatch("INIT_KERNEL", { executionId });
    await kernel.dispatch("LOCK_INPUT", {
      ...commonLockInput,
      intelligenceContext: iic
    });

    await kernel.dispatch("APPLY_POWERUPS", {});
    await kernel.dispatch("DERIVE_LAYOUT", { executionId });

    let thrown = false;
    try {
      await kernel.dispatch("VALIDATE_KERNEL", { executionId });
    } catch (err: any) {
      thrown = true;
      assert.ok(err.message.includes("BLOQUEO DE SEGURIDAD (NOT_READY)"), "Blockage message must match 'BLOQUEO DE SEGURIDAD (NOT_READY)'.");
      console.log(`✅ Bloqueo capturado exitosamente: "${err.message}"`);
    }

    assert.ok(thrown, "VALIDATE_KERNEL must throw an error when IIC status is NOT_READY.");
    console.log("✅ CASO 4 COMPLETADO: Bloqueo estricto por ACE FAILED validado.");
  } catch (err: any) {
    console.error("❌ Falló el Caso 4:", err);
    throw err;
  }

  // --- CASO 5: Bloqueo de acceso legacy (IIC ausente) ---
  console.log("\n🧪 Caso 5: Bloqueo de acceso legacy (Debe arrojar bloqueo estricto si falta el IIC)");
  try {
    const kernel = new ReportEngineKernelClass();
    const executionId = "exec-test-5";

    await kernel.dispatch("INIT_KERNEL", { executionId });
    await kernel.dispatch("LOCK_INPUT", {
      ...commonLockInput,
      intelligenceContext: null // IIC ausente
    });

    await kernel.dispatch("APPLY_POWERUPS", {});
    await kernel.dispatch("DERIVE_LAYOUT", { executionId });

    let thrown = false;
    try {
      await kernel.dispatch("VALIDATE_KERNEL", { executionId });
    } catch (err: any) {
      thrown = true;
      assert.ok(err.message.includes("MIGRATION_BLOCKAGE"), "Blockage message must match 'MIGRATION_BLOCKAGE'.");
      console.log(`✅ Bloqueo legacy capturado exitosamente: "${err.message}"`);
    }

    assert.ok(thrown, "VALIDATE_KERNEL must throw an error when IIC is missing.");
    console.log("✅ CASO 5 COMPLETADO: Bloqueo de acceso legacy validado.");
  } catch (err: any) {
    console.error("❌ Falló el Caso 5:", err);
    throw err;
  }

  console.log("\n======================================================================");
  console.log("🎉 ¡TODAS LAS PRUEBAS DE REGRESIÓN DE LA MIGRACIÓN PASARON CON ÉXITO! 🎉");
  console.log("======================================================================");
}
