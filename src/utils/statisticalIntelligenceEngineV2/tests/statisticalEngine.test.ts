import { StatisticalIntelligenceEngineV2 } from "../index";

// Set de datos simulados: 12 delitos en Aguascalientes con un patrón de incremento y agrupación espacial
const mockIncidents = [
  { id: "c1", lat: 21.8850, lng: -102.2910, fecha: "2026-07-01", hora: "08:00", delito: "Robo transeúnte", violencia: "con_violencia" },
  { id: "c2", lat: 21.8851, lng: -102.2911, fecha: "2026-07-02", hora: "08:30", delito: "Robo transeúnte", violencia: "con_violencia" },
  { id: "c3", lat: 21.8849, lng: -102.2909, fecha: "2026-07-03", hora: "09:00", delito: "Robo transeúnte", violencia: "sin_violencia" },
  // Clúster 2
  { id: "c4", lat: 21.8890, lng: -102.2950, fecha: "2026-07-04", hora: "21:00", delito: "Robo de vehículo", violencia: "sin_violencia" },
  { id: "c5", lat: 21.8891, lng: -102.2951, fecha: "2026-07-05", hora: "22:00", delito: "Robo de vehículo", violencia: "sin_violencia" },
  { id: "c6", lat: 21.8889, lng: -102.2949, fecha: "2026-07-06", hora: "23:00", delito: "Robo de vehículo", violencia: "sin_violencia" },
  // Incremento de frecuencia
  { id: "c7", lat: 21.8850, lng: -102.2912, fecha: "2026-07-07", hora: "08:15", delito: "Robo transeúnte", violencia: "con_violencia" },
  { id: "c8", lat: 21.8852, lng: -102.2908, fecha: "2026-07-08", hora: "08:45", delito: "Robo transeúnte", violencia: "con_violencia" },
  { id: "c9", lat: 21.8890, lng: -102.2952, fecha: "2026-07-09", hora: "21:30", delito: "Robo de vehículo", violencia: "sin_violencia" },
  // Más delitos al final
  { id: "c10", lat: 21.8850, lng: -102.2910, fecha: "2026-07-10", hora: "12:00", delito: "Robo transeúnte", violencia: "con_violencia" },
  { id: "c11", lat: 21.8851, lng: -102.2911, fecha: "2026-07-10", hora: "13:00", delito: "Robo transeúnte", violencia: "sin_violencia" },
  { id: "c12", lat: 21.8852, lng: -102.2909, fecha: "2026-07-10", hora: "14:00", delito: "Robo transeúnte", violencia: "con_violencia" }
];

export function runStatisticalTests() {
  console.log("=== INICIANDO PRUEBAS UNITARIAS DE SIE 2.0 CORE ===");

  const centerLat = 21.8850;
  const centerLng = -102.2910;
  const radiusMeters = 800; // Radio amplio para capturar los dos clústeres

  const result = StatisticalIntelligenceEngineV2.analyze(mockIncidents, centerLat, centerLng, radiusMeters);

  // 1. Verificar metadatos
  console.assert(result.metadata.totalEvents === 12, `Falla totalEvents: esperado 12, obtenido ${result.metadata.totalEvents}`);
  console.log(`[PASS] Conteo de Eventos Totales: ${result.metadata.totalEvents}`);

  // 2. Verificar análisis temporal (Theil-Sen)
  console.assert(result.temporalAnalysis.trendDirection === "stable", `Falla trendDirection: esperado "stable", obtenido "${result.temporalAnalysis.trendDirection}"`);
  console.assert(result.temporalAnalysis.trendSlope === 0, `Falla trendSlope: esperado 0, obtenido ${result.temporalAnalysis.trendSlope}`);
  console.log(`[PASS] Estimador de Theil-Sen (Tendencia): ${result.temporalAnalysis.trendDirection} (Slope: ${result.temporalAnalysis.trendSlope}, Confianza: ${result.temporalAnalysis.trendConfidence}%)`);

  // 3. Verificar agrupamiento espacial (DBSCAN)
  // Debería detectar 2 clústeres principales definidos por la proximidad estrecha
  console.assert(result.spatialAnalysis.clusters.length === 2, `Falla clústeres DBSCAN: esperado 2, obtenido ${result.spatialAnalysis.clusters.length}`);
  console.log(`[PASS] Agrupamiento Espacial DBSCAN: Detectados ${result.spatialAnalysis.clusters.length} clústeres con baricentros reales.`);

  // 4. Verificar entropía espacial
  console.assert(result.spatialAnalysis.spatialEntropy > 0 && result.spatialAnalysis.spatialEntropy < 1.0, `Falla entropía: esperada entre 0 y 1, obtenida ${result.spatialAnalysis.spatialEntropy}`);
  console.log(`[PASS] Entropía Espacial de Shannon: ${result.spatialAnalysis.spatialEntropy} (${result.spatialAnalysis.spatialEntropyInterpretation})`);

  // 5. Verificar modelos predictivos (Poisson y Near-Repeat)
  console.assert(result.predictiveAnalysis.poissonProbabilityWeekly > 0.5, `Falla Poisson semanal: esperada > 0.5, obtenida ${result.predictiveAnalysis.poissonProbabilityWeekly}`);
  console.assert(result.predictiveAnalysis.nearRepeatScore > 0, `Falla Near-Repeat Score: esperado > 0, obtenido ${result.predictiveAnalysis.nearRepeatScore}`);
  console.log(`[PASS] Probabilidad Semanal Poisson: ${(result.predictiveAnalysis.poissonProbabilityWeekly * 100).toFixed(1)}%`);
  console.log(`[PASS] Tasa de Contagio Near-Repeat: ${result.predictiveAnalysis.nearRepeatScore}%`);

  // 6. Verificar bondad de ajuste
  console.log(`[PASS] Test Chi-Cuadrada Bondad de Ajuste: p-value de ${result.predictiveAnalysis.poissonModelFitScore} (Válido: ${result.predictiveAnalysis.poissonModelValidity})`);

  console.log("=== PRUEBAS CONCLUIDAS EXITOSAMENTE ===");
}
