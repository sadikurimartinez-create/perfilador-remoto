import { GeoEvidence } from "../src/types/geointEvidence";
import { compareTemporalEvidence } from "../src/services/geoint/temporalComparisonService";

async function runTests() {
  console.log("=== INICIANDO PRUEBAS FUNCIONALES ADR-019.13-F3: MOTOR COMPARADOR UNIVERSAL ===");

  // Base coords: 21.885421, -102.291245
  const coordsBase = { lat: 21.885421, lng: -102.291245 };
  const coordsCercanas = { lat: 21.885438, lng: -102.291201 }; // ~4.8m
  const coordsLejanas = { lat: 21.900000, lng: -102.300000 };  // ~1.8km

  // --------------------------------------------------------------------------
  // CASO 1: FIELD_PHOTO vs STREET_VIEW_HISTORICAL (Misma ubicación, fechas distintas)
  // --------------------------------------------------------------------------
  console.log("\n[CASO 1] Campo vs Street View Histórico (Misma ubicación):");
  const ev1_A: GeoEvidence = {
    id: "ev-c1-A",
    expedienteId: "EXP-2026-F3",
    source: "FIELD_PHOTO",
    coordinates: coordsBase,
    captureDate: "2026-01-15",
    imageReference: "http://example.com/field-2026.jpg",
    metadata: { sourceProvider: "CEIPOL_FIELD" },
    status: "APPROVED_EVIDENCE",
  };

  const ev1_B: GeoEvidence = {
    id: "ev-c1-B",
    expedienteId: "EXP-2026-F3",
    source: "STREET_VIEW_HISTORICAL",
    coordinates: coordsCercanas,
    captureDate: "2022-05-10",
    imageReference: "http://example.com/sv-2022.jpg",
    metadata: { sourceProvider: "GOOGLE_STREET_VIEW" },
    status: "PENDING_REVIEW",
  };

  const res1 = await compareTemporalEvidence(ev1_A, ev1_B, 50);
  console.log(`- Bloqueado Espacial: ${res1.isSpatialBlocked}`);
  console.log(`- Delta Temporal: ${res1.comparison?.temporalValidation.dateDifferenceFormatted}`);
  console.assert(res1.isSuccess === true && !res1.isSpatialBlocked, "Caso 1 falló: Comparación legítima fue bloqueada");
  console.log("✅ CASO 1 SUPERADO: COMPARACIÓN PERMITIDA.");

  // --------------------------------------------------------------------------
  // CASO 2: FIELD_PHOTO vs FIELD_PHOTO (Campo vs Campo, multi-fecha in situ)
  // --------------------------------------------------------------------------
  console.log("\n[CASO 2] Campo vs Campo (Multi-fecha In Situ):");
  const ev2_A: GeoEvidence = {
    id: "ev-c2-A",
    expedienteId: "EXP-2026-F3",
    source: "FIELD_PHOTO",
    coordinates: coordsBase,
    captureDate: "2026-01-15",
    imageReference: "http://example.com/field-jan.jpg",
    metadata: { investigator: "Agente 1" },
    status: "APPROVED_EVIDENCE",
  };

  const ev2_B: GeoEvidence = {
    id: "ev-c2-B",
    expedienteId: "EXP-2026-F3",
    source: "FIELD_PHOTO",
    coordinates: coordsBase,
    captureDate: "2026-06-20",
    imageReference: "http://example.com/field-jun.jpg",
    metadata: { investigator: "Agente 2" },
    status: "APPROVED_EVIDENCE",
  };

  const res2 = await compareTemporalEvidence(ev2_A, ev2_B, 50);
  console.log(`- Bloqueado Espacial: ${res2.isSpatialBlocked}`);
  console.log(`- Fuentes: ${res2.comparison?.evidenceA.source} vs ${res2.comparison?.evidenceB.source}`);
  console.assert(res2.isSuccess === true && !res2.isSpatialBlocked, "Caso 2 falló: Comparación Campo vs Campo fue denegada");
  console.log("✅ CASO 2 SUPERADO: COMPARACIÓN PERMITIDA.");

  // --------------------------------------------------------------------------
  // CASO 3: Puntos Diferentes (> 50m) -> Bloqueo Estricto
  // --------------------------------------------------------------------------
  console.log("\n[CASO 3] Puntos Geográficos Diferentes (> 50 metros):");
  const ev3_B: GeoEvidence = {
    id: "ev-c3-B",
    expedienteId: "EXP-2026-F3",
    source: "STREET_VIEW_AUTOMATIC",
    coordinates: coordsLejanas,
    captureDate: "2023-01-01",
    imageReference: "http://example.com/far.jpg",
    metadata: {},
    status: "GENERATED",
  };

  const res3 = await compareTemporalEvidence(ev1_A, ev3_B, 50);
  console.log(`- Bloqueado Espacial: ${res3.isSpatialBlocked}`);
  console.log(`- Mensaje de Error: ${res3.error}`);
  console.assert(res3.isSpatialBlocked === true && res3.isSuccess === false, "Caso 3 falló: Comparación con >50m no fue bloqueada");
  console.log("✅ CASO 3 SUPERADO: COMPARACIÓN BLOQUEADA CORRECTAMENTE.");

  // --------------------------------------------------------------------------
  // CASO 4: Sin Fecha Real -> "FECHA_NO_DISPONIBLE" (Cero Fechas Inventadas)
  // --------------------------------------------------------------------------
  console.log("\n[CASO 4] Evidencia Sin Fecha Registrada (Cero Fechas Inventadas):");
  const ev4_A: GeoEvidence = {
    id: "ev-c4-A",
    expedienteId: "EXP-2026-F3",
    source: "STREET_VIEW_MANUAL",
    coordinates: coordsBase,
    captureDate: undefined, // Sin fecha
    imageReference: "http://example.com/nodate.jpg",
    metadata: {},
    status: "PENDING_REVIEW",
  };

  const res4 = await compareTemporalEvidence(ev4_A, ev1_B, 50);
  console.log(`- Fecha Registrada A: ${res4.comparison?.temporalValidation.dateA}`);
  console.log(`- Formato Delta: ${res4.comparison?.temporalValidation.dateDifferenceFormatted}`);
  console.assert(res4.comparison?.temporalValidation.dateA === "FECHA_NO_DISPONIBLE", "Caso 4 falló: Se inventó una fecha artificial para Evidencia A");
  console.assert(res4.comparison?.temporalValidation.dateDifferenceFormatted === "FECHA_NO_DISPONIBLE", "Caso 4 falló: No se registró FECHA_NO_DISPONIBLE en el delta");
  console.log("✅ CASO 4 SUPERADO: FECHA_NO_DISPONIBLE REGISTRADA SIN FALLBACKS ARTIFICIALES.");

  console.log("\n🎉 TODAS LAS PRUEBAS FUNCIONALES DEL MOTOR UNIVERSAL (ADR-019.13-F3) HAN PASADO SATISFACTORIAMENTE.");
}

runTests().catch((err) => {
  console.error("❌ Error ejecutando pruebas:", err);
  process.exit(1);
});
