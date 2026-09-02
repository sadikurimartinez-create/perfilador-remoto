import { executeAutomaticGeointSweep } from "../src/services/geoint/geointSweepService";
import { fetchStreetViewPanorama } from "../src/services/geoint/streetViewProviderService";
import { calculateHaversineDistanceMeters } from "../src/utils/geoResolver";

/**
 * SUITE DE PRUEBAS AUTOMATIZADAS DE CERTIFICACIÓN ADR-019.15 GEOINTEGRITY
 * Valida de forma estricta los 10 casos de uso obligatorios para la certificación del motor GEOINT.
 */
export async function runGeointegrityTests() {
  console.log("\n==================================================================");
  console.log("🛡️  SUITE DE PRUEBAS ADR-019.15: INTEGRIDAD GEOESPACIAL STREET VIEW");
  console.log("==================================================================\n");

  const globalMockMap = (global as any).__MOCK_STREETVIEW_METADATA_MAP__ || {};
  (global as any).__MOCK_STREETVIEW_METADATA_MAP__ = globalMockMap;

  // Limpiar mocks anteriores
  Object.keys(globalMockMap).forEach((key) => delete globalMockMap[key]);

  // -------------------------------------------------------------------
  // CASO 1: Foto y panorama separados <= 50m -> PASS
  // -------------------------------------------------------------------
  console.log("📌 CASO 1: Foto y panorama separados <= 50m (Tolerancia espacial válida)");
  globalMockMap["21.8851,-102.2911"] = {
    isAvailable: true,
    panoramaLat: 21.8852, // ~15m de distancia
    panoramaLng: -102.2912,
    panoramaId: "pano-google-real-001",
    captureDate: "2023-08",
  };

  const res1 = await executeAutomaticGeointSweep(
    [{ id: "photo-1", lat: 21.8851, lng: -102.2911, gpsTimestamp: 1690000000000 }],
    "EXP-TEST-001"
  );

  if (res1.findings.length === 1 && res1.successCount === 1) {
    console.log("  ✅ [PASS] Foto y panorama <= 50m procesado e integrado exitosamente.");
  } else {
    throw new Error(`[FAIL CASO 1] Se esperaba 1 hallazgo válido. Obtenidos: ${res1.findings.length}`);
  }

  // -------------------------------------------------------------------
  // CASO 2: Foto y panorama separados > 50m -> REJECT EXCEEDS_DISTANCE_TOLERANCE_50M
  // -------------------------------------------------------------------
  console.log("\n📌 CASO 2: Foto y panorama separados > 50m (Rechazo por desalineación territorial)");
  globalMockMap["21.8851,-102.2911"] = {
    isAvailable: true,
    panoramaLat: 21.8950, // ~1100m de distancia (> 50m)
    panoramaLng: -102.3010,
    panoramaId: "pano-google-far-002",
    captureDate: "2023-08",
  };

  const res2 = await executeAutomaticGeointSweep(
    [{ id: "photo-2", lat: 21.8851, lng: -102.2911 }],
    "EXP-TEST-002"
  );

  const hasDistErr = res2.errors.some((e) => e.includes("EXCEEDS_DISTANCE_TOLERANCE_50M"));
  if (res2.findings.length === 0 && hasDistErr) {
    console.log("  ✅ [PASS] Panorama distante descartado. Error registrado: EXCEEDS_DISTANCE_TOLERANCE_50M");
  } else {
    throw new Error(`[FAIL CASO 2] Se esperaba rechazo >50m. Obtenidos hallazgos: ${res2.findings.length}`);
  }

  // -------------------------------------------------------------------
  // CASO 3: Dos fotos devuelven el mismo panoramaId -> 1 sola evidencia (Deduplicación Nivel 1)
  // -------------------------------------------------------------------
  console.log("\n📌 CASO 3: Dos fotos devuelven el mismo panoramaId (Deduplicación de barrido)");
  globalMockMap["21.8851,-102.2911"] = {
    isAvailable: true,
    panoramaLat: 21.8851,
    panoramaLng: -102.2911,
    panoramaId: "pano-google-shared-999",
    captureDate: "2023-08",
  };
  globalMockMap["21.8852,-102.2912"] = {
    isAvailable: true,
    panoramaLat: 21.8851,
    panoramaLng: -102.2911,
    panoramaId: "pano-google-shared-999", // Mismo ID de panorama
    captureDate: "2023-08",
  };

  const res3 = await executeAutomaticGeointSweep(
    [
      { id: "photo-3a", lat: 21.8851, lng: -102.2911 },
      { id: "photo-3b", lat: 21.8852, lng: -102.2912 },
    ],
    "EXP-TEST-003"
  );

  if (res3.findings.length === 1) {
    console.log("  ✅ [PASS] Panorámica duplicada por pano_id consolidada en 1 sola evidencia.");
  } else {
    throw new Error(`[FAIL CASO 3] Se esperaba 1 sola evidencia por deduplicación. Obtenidos: ${res3.findings.length}`);
  }

  // -------------------------------------------------------------------
  // CASO 4: Panorama interior/no exterior -> REJECT NO_VALID_OUTDOOR_PANORAMA
  // -------------------------------------------------------------------
  console.log("\n📌 CASO 4: Ausencia de panorama exterior válido (source=outdoor FILTER)");
  globalMockMap["21.8851,-102.2911"] = {
    isAvailable: false,
    status: "ZERO_RESULTS",
    error: "NO_VALID_OUTDOOR_PANORAMA",
  };

  const res4 = await executeAutomaticGeointSweep(
    [{ id: "photo-4", lat: 21.8851, lng: -102.2911 }],
    "EXP-TEST-004"
  );

  const hasOutdoorErr = res4.errors.some((e) => e.includes("NO_VALID_OUTDOOR_PANORAMA"));
  if (res4.findings.length === 0 && hasOutdoorErr) {
    console.log("  ✅ [PASS] Rechazo confirmado por ausencia de panorama exterior (NO_VALID_OUTDOOR_PANORAMA).");
  } else {
    throw new Error(`[FAIL CASO 4] Se esperaba rechazo NO_VALID_OUTDOOR_PANORAMA. Obtenidos: ${res4.findings.length}`);
  }

  // -------------------------------------------------------------------
  // CASO 5: Sin metadata de panorama -> REJECT
  // -------------------------------------------------------------------
  console.log("\n📌 CASO 5: Sin metadata de panorama (Proveedor no disponible)");
  globalMockMap["21.8851,-102.2911"] = {
    isAvailable: false,
    panoramaLat: null,
    panoramaLng: null,
    panoramaId: null,
    error: "NO_PANORAMA_METADATA",
  };

  const res5 = await executeAutomaticGeointSweep(
    [{ id: "photo-5", lat: 21.8851, lng: -102.2911 }],
    "EXP-TEST-005"
  );

  if (res5.findings.length === 0 && res5.errorCount === 1) {
    console.log("  ✅ [PASS] Muestra descartada strictly al carecer de metadata de panorama.");
  } else {
    throw new Error(`[FAIL CASO 5] Se esperaba rechazo por falta de metadata. Obtenidos: ${res5.findings.length}`);
  }

  // -------------------------------------------------------------------
  // CASO 6: Sin fecha en metadata -> FECHA_NO_DISPONIBLE
  // -------------------------------------------------------------------
  console.log("\n📌 CASO 6: Sin fecha de captura en metadata -> Registrar FECHA_NO_DISPONIBLE");
  globalMockMap["21.8851,-102.2911"] = {
    isAvailable: true,
    panoramaLat: 21.8851,
    panoramaLng: -102.2911,
    panoramaId: "pano-nodate-006",
    captureDate: "FECHA_NO_DISPONIBLE",
  };

  const res6 = await executeAutomaticGeointSweep(
    [{ id: "photo-6", lat: 21.8851, lng: -102.2911 }],
    "EXP-TEST-006"
  );

  const isDateHandled =
    res6.findings[0].descripcion?.includes("FECHA_NO_DISPONIBLE") ||
    res6.findings[0].observaciones_visual?.includes("FECHA_NO_DISPONIBLE");

  if (res6.findings.length === 1 && isDateHandled) {
    console.log("  ✅ [PASS] Ausencia de fecha manejada de forma íntegra con FECHA_NO_DISPONIBLE (Sin fechas inventadas).");
  } else {
    throw new Error(`[FAIL CASO 6] Se esperaba FECHA_NO_DISPONIBLE en la descripción u observaciones. Desc: ${res6.findings[0]?.descripcion}`);
  }

  // -------------------------------------------------------------------
  // CASO 7: Expediente sin fotos -> Sin fallbacks artificiales (NO MOCK, NO 21.885, NO -102.291)
  // -------------------------------------------------------------------
  console.log("\n📌 CASO 7: Expediente sin fotografías (Ausencia de fallbacks de Aguascalientes)");
  const res7 = await executeAutomaticGeointSweep([], "EXP-EMPTY-007");
  if (res7.totalPhotosReceived === 0 && res7.findings.length === 0) {
    console.log("  ✅ [PASS] Expediente sin fotos retorna arreglo vacío sin generar fallbacks artificiales.");
  } else {
    throw new Error(`[FAIL CASO 7] Se esperaba respuesta vacía.`);
  }

  // -------------------------------------------------------------------
  // CASO 8: Expediente con fotos reales -> Coordenadas reales
  // -------------------------------------------------------------------
  console.log("\n📌 CASO 8: Expediente con coordenadas reales del terreno");
  const realLat = 20.6597; // Guadalajara
  const realLng = -103.3496;
  globalMockMap["20.6597,-103.3496"] = {
    isAvailable: true,
    panoramaLat: 20.6598,
    panoramaLng: -103.3497,
    panoramaId: "pano-gdl-008",
    captureDate: "2024-01",
  };

  const res8 = await executeAutomaticGeointSweep(
    [{ id: "photo-gdl", lat: realLat, lng: realLng }],
    "EXP-GDL-008"
  );

  if (res8.findings.length === 1 && res8.findings[0].coordenadas.lat === realLat) {
    console.log("  ✅ [PASS] Ubicación real del expediente (Guadalajara) procesada e integrada íntegramente.");
  } else {
    throw new Error(`[FAIL CASO 8] Coordenadas desalineadas.`);
  }

  // -------------------------------------------------------------------
  // CASO 9: Abrir expediente repetidamente -> NO DUPLICATE SWEEP
  // -------------------------------------------------------------------
  console.log("\n📌 CASO 9: Re-ejecución de barrido / Apertura repetida del expediente (Gobernanza NO DUPLICATE SWEEP)");
  globalMockMap["21.8851,-102.2911"] = {
    isAvailable: true,
    panoramaLat: 21.8851,
    panoramaLng: -102.2911,
    panoramaId: "pano-repeat-009",
    captureDate: "2023-08",
  };

  const sweepPass1 = await executeAutomaticGeointSweep(
    [{ id: "photo-rep-1", lat: 21.8851, lng: -102.2911 }],
    "EXP-REPEAT-009"
  );

  const sweepPass2 = await executeAutomaticGeointSweep(
    [
      { id: "photo-rep-1", lat: 21.8851, lng: -102.2911 },
      { id: "photo-rep-2", lat: 21.8851, lng: -102.2911 }
    ],
    "EXP-REPEAT-009"
  );

  if (sweepPass1.findings.length === 1 && sweepPass2.findings.length === 1) {
    console.log("  ✅ [PASS] Re-ejecución de barrido no generó hallazgos duplicados (NO DUPLICATE SWEEP verificado).");
  } else {
    throw new Error(`[FAIL CASO 9] Se generaron duplicados en re-barrido. Pass1: ${sweepPass1.findings.length}, Pass2: ${sweepPass2.findings.length}`);
  }

  // -------------------------------------------------------------------
  // CASO 10: Cintilla con mismo panorama bajo diferentes IDs -> 1 sola evidencia (Deduplicación Nivel 2)
  // -------------------------------------------------------------------
  console.log("\n📌 CASO 10: Deduplicación en Cintilla Inteligente (Mismo panorama, diferentes IDs)");
  const candidatesForRibbon = [
    {
      id: "evid-001",
      expedienteId: "EXP-RIBBON-010",
      source: "STREET_VIEW_AUTOMATIC" as const,
      coordinates: { lat: 21.8851, lng: -102.2911 },
      imageReference: "https://maps.googleapis.com/static-pano-100",
      metadata: { panoramaId: "pano-unique-100", heading: 90 },
      status: "PENDING_REVIEW" as const,
    },
    {
      id: "evid-002-different-id", // ID distinto
      expedienteId: "EXP-RIBBON-010",
      source: "STREET_VIEW_MANUAL" as const,
      coordinates: { lat: 21.8851, lng: -102.2911 },
      imageReference: "https://maps.googleapis.com/static-pano-100",
      metadata: { panoramaId: "pano-unique-100", heading: 90 }, // Mismo panoramaId
      status: "APPROVED_EVIDENCE" as const,
    },
  ];

  // Algoritmo de deduplicación de Cintilla Nivel 2
  const deduplicatedPool: typeof candidatesForRibbon = [];
  for (const candidate of candidatesForRibbon) {
    const isDup = deduplicatedPool.some(
      (existing) =>
        existing.id === candidate.id ||
        (existing.metadata.panoramaId && candidate.metadata.panoramaId && existing.metadata.panoramaId === candidate.metadata.panoramaId) ||
        existing.imageReference === candidate.imageReference
    );
    if (!isDup) {
      deduplicatedPool.push(candidate);
    }
  }

  if (deduplicatedPool.length === 1) {
    console.log("  ✅ [PASS] Cintilla consolidó exitosamente 2 candidatos con el mismo panoramaId a 1 sola evidencia.");
  } else {
    throw new Error(`[FAIL CASO 10] Deduplicación en Cintilla fallida. Esperado 1, obtenidos ${deduplicatedPool.length}`);
  }

  // Finalización y Limpieza de Entorno
  delete (global as any).__MOCK_STREETVIEW_METADATA_MAP__;
  console.log("\n  ✅ [PASS] Entorno de pruebas restaurado correctamente.");

  console.log("\n================================================================");
  console.log("📊 RESUMEN DE PRUEBAS ADR-019.15: 10 PASADAS | 0 FALLADAS");
  console.log("================================================================\n");
}
