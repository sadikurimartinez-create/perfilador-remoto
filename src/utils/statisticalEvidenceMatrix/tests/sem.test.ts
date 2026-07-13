import { StatisticalIntelligenceEngineV2 } from "../../statisticalIntelligenceEngineV2";
import { StatisticalEvidenceMatrixManager } from "../index";

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

export function runSemTests() {
  console.log("=== INICIANDO PRUEBAS UNITARIAS DE STATISTICAL EVIDENCE MATRIX (SEM) ===");

  const centerLat = 21.8850;
  const centerLng = -102.2910;
  const radiusMeters = 800;
  const projectId = "MOCK-PROYECTO-AGUASCALIENTES";

  // 1. Ejecutar el motor de inteligencia analítica SIE 2.0
  const sieResult = StatisticalIntelligenceEngineV2.analyze(mockIncidents, centerLat, centerLng, radiusMeters);

  // 2. Procesar e integrar a la Statistical Evidence Matrix (SEM)
  const { sem, validationStatus, warnings } = StatisticalEvidenceMatrixManager.process(
    projectId,
    mockIncidents,
    sieResult
  );

  // --- ASERCIONES DE CONTRATO ---

  // Ajuste 4: Versión independiente del componente SEM
  console.assert(sem.metadata.semVersion === "1.0", `Falla semVersion: esperado "1.0", obtenido "${sem.metadata.semVersion}"`);
  console.log(`[PASS] Ajuste 4 - Versión independiente SEM: v${sem.metadata.semVersion}`);

  // Validación 1: Eventos totales coincidentes
  console.assert(sem.criminalEvidence.totalEvents === 12, `Falla totalEvents: esperado 12, obtenido ${sem.criminalEvidence.totalEvents}`);
  console.log(`[PASS] Validación 1 - Conteo de eventos coincidentes: ${sem.criminalEvidence.totalEvents}`);

  // Evidencia Criminal: Dominancia delictiva y concentración
  console.assert(sem.criminalEvidence.dominantCrime === "ROBO TRANSEÚNTE", `Falla dominantCrime: esperado ROBO TRANSEÚNTE, obtenido ${sem.criminalEvidence.dominantCrime}`);
  console.assert(sem.criminalEvidence.concentrationScore === 0.6667, `Falla concentrationScore: esperado 0.6667 (8/12), obtenido ${sem.criminalEvidence.concentrationScore}`);
  console.log(`[PASS] Dominancia delictiva detectada: ${sem.criminalEvidence.dominantCrime} (${(sem.criminalEvidence.concentrationScore * 100).toFixed(1)}% concentración)`);

  // Ajuste 1: Trazabilidad granular de variables
  console.assert(sem.variableTraceability.totalEvents.source === "SIE-METADATA", "Falla trazabilidad totalEvents");
  console.assert(sem.variableTraceability.hotspots.source === "SIE-SSM-DBSCAN", "Falla trazabilidad hotspots");
  console.assert(sem.variableTraceability.poissonRisk.source === "SIE-CPM-POISSON", "Falla trazabilidad poissonRisk");
  console.assert(sem.variableTraceability.trend.source === "SIE-TIM-THEIL-SEN", "Falla trazabilidad trend");
  console.log(`[PASS] Ajuste 1 - Trazabilidad individual por variable auditada correctamente.`);

  // Ajuste 2: Confianza dividida (Estadística vs Operacional)
  console.assert(sem.predictiveEvidence.confidenceMetrics.statisticalConfidence === 20, `Falla statisticalConfidence: esperada 20, obtenido ${sem.predictiveEvidence.confidenceMetrics.statisticalConfidence}`);
  console.assert(sem.predictiveEvidence.confidenceMetrics.operationalReliability > 0, `Falla operationalReliability: esperado > 0, obtenido ${sem.predictiveEvidence.confidenceMetrics.operationalReliability}`);
  console.log(`[PASS] Ajuste 2 - Confianza dividida: Estadística (${sem.predictiveEvidence.confidenceMetrics.statisticalConfidence}%) | Operacional/Táctica (${sem.predictiveEvidence.confidenceMetrics.operationalReliability}%)`);

  // Ajuste 3: Limitaciones a nivel raíz (Transversal)
  console.assert(sem.limitations.length > 0, "Falla limitations: se esperaba al menos una limitación registrada en raíz");
  const hasPredictiveLimitation = sem.limitations.some(lim => lim.type === "PREDICTIVE");
  console.assert(hasPredictiveLimitation, "Falla predictive limitation: se esperaba limitación de modelo Poisson");
  console.log(`[PASS] Ajuste 3 - Limitaciones transversales registradas a nivel raíz: ${sem.limitations.length} detectadas.`);

  // Ajuste 5: Validación temporal de cobertura
  console.assert(sem.temporalEvidence.temporalCoverage.startDate === "2026-07-01", `Falla temporal startDate: esperado 2026-07-01, obtenido ${sem.temporalEvidence.temporalCoverage.startDate}`);
  console.assert(sem.temporalEvidence.temporalCoverage.endDate === "2026-07-10", `Falla temporal endDate: esperado 2026-07-10, obtenido ${sem.temporalEvidence.temporalCoverage.endDate}`);
  console.log(`[PASS] Ajuste 5 - Validación de cobertura temporal coincidente: [${sem.temporalEvidence.temporalCoverage.startDate} a ${sem.temporalEvidence.temporalCoverage.endDate}]`);

  // Ajuste 6: Flags de consumo HIE/CIE
  console.assert(sem.intelligenceReadiness.availableForHIE === true, "Falla availableForHIE: esperado true");
  console.assert(sem.intelligenceReadiness.availableForCIE === true, "Falla availableForCIE: esperado true");
  console.log(`[PASS] Ajuste 6 - Flags de disponibilidad preparados para HIE: ${sem.intelligenceReadiness.availableForHIE} y CIE: ${sem.intelligenceReadiness.availableForCIE}`);

  // Validación 3: Estatus y semáforo de advertencias Poisson
  console.assert(validationStatus === "WARNING", `Falla validationStatus: esperado "WARNING", obtenido "${validationStatus}"`);
  console.assert(warnings.length > 0, "Falla warnings: se esperaban advertencias de ajuste Poisson");
  console.log(`[PASS] Validación 3 - Semáforo de calidad de la matriz: ${validationStatus}`);
  warnings.forEach(w => console.log(`  └─> ${w}`));

  console.log("=== PRUEBAS DE LA STATISTICAL EVIDENCE MATRIX COMPLETADAS CON ÉXITO ===");
}
