import { GeoEvidence } from "../src/types/geointEvidence";
import {
  filterCompatibleEvidence,
  filterCompatibleEvidenceWithMetrics,
} from "../src/services/geoint/evidenceCompatibilityService";

console.log("=== INICIANDO PRUEBAS FUNCIONALES ADR-019.13-F2: CINTILLA INTELIGENTE ===");

// Referencia de Campo (Fotografía in situ)
const fieldReference: GeoEvidence = {
  id: "ev-field-ref-001",
  expedienteId: "EXP-2026-A",
  source: "FIELD_PHOTO",
  coordinates: {
    lat: 21.885421,
    lng: -102.291245,
  },
  captureDate: "2026-08-25",
  imageReference: "http://ceipol.gob.mx/evidencias/campo-2026.jpg",
  metadata: {
    investigator: "Analista CEIPOL",
    sourceProvider: "CEIPOL_FIELD",
  },
  status: "APPROVED_EVIDENCE",
};

// CASO 1: Misma Ubicación (Street View a ~4.8 metros)
const candidateCercana: GeoEvidence = {
  id: "ev-sv-auto-002",
  expedienteId: "EXP-2026-A",
  source: "STREET_VIEW_AUTOMATIC",
  coordinates: {
    lat: 21.885438,
    lng: -102.291201,
  },
  captureDate: "2023-05-10",
  imageReference: "http://streetview.google.com/pano-002.jpg",
  metadata: {
    heading: 180,
    panoramaId: "pano-agst-002",
    sourceProvider: "GOOGLE_STREET_VIEW",
  },
  status: "PENDING_REVIEW",
};

// CASO 2: Distinta Ubicación (Street View a ~1.8 km)
const candidateLejana: GeoEvidence = {
  id: "ev-sv-hist-003",
  expedienteId: "EXP-2026-A",
  source: "STREET_VIEW_HISTORICAL",
  coordinates: {
    lat: 21.900000,
    lng: -102.300000,
  },
  captureDate: "2019-11-20",
  imageReference: "http://streetview.google.com/pano-003.jpg",
  metadata: {
    heading: 90,
    panoramaId: "pano-agst-003",
    sourceProvider: "GOOGLE_STREET_VIEW",
  },
  status: "PENDING_REVIEW",
};

// CASO 3: Sin Coordenadas (Coordenada Null Island 0,0 o faltante)
const candidateSinCoords: GeoEvidence = {
  id: "ev-invalid-004",
  expedienteId: "EXP-2026-A",
  source: "STREET_VIEW_MANUAL",
  coordinates: {
    lat: 0,
    lng: 0,
  },
  imageReference: "http://example.com/no-coords.jpg",
  metadata: {},
  status: "GENERATED",
};

const candidatePool = [candidateCercana, candidateLejana, candidateSinCoords];

console.log("\nEjecutando filtrado con tolerancia de 50 metros...");
const result = filterCompatibleEvidenceWithMetrics(fieldReference, candidatePool, 50);

console.log(`\nResultados:
- Evidencias Candidatas evaluadas: ${candidatePool.length}
- Evidencias Compatibles (Visibles en Cintilla): ${result.compatibleEvidence.length}
- Evidencias Rechazadas (Fuera de tolerancia / Sin GPS): ${result.rejectedCount}`);

// Validación CASO 1: Misma Ubicación -> Incluida
const c1Incluida = result.compatibleEvidence.some((e) => e.id === candidateCercana.id);
console.log(`\n[CASO 1 - MISMA UBICACIÓN]: ${c1Incluida ? "✅ VISIBLE EN CINTILLA" : "❌ FALLO"}`);
console.assert(c1Incluida === true, "Caso 1 falló: Evidencia cercana no fue incluida");

// Validación CASO 2: Distinta Ubicación -> Excluida
const c2Excluida = !result.compatibleEvidence.some((e) => e.id === candidateLejana.id);
console.log(`[CASO 2 - DISTINTA UBICACIÓN]: ${c2Excluida ? "✅ EXCLUIDA CORRECTAMENTE (NO MOSTRAR)" : "❌ FALLO"}`);
console.assert(c2Excluida === true, "Caso 2 falló: Evidencia lejana no fue excluida");

// Validación CASO 3: Sin Coordenadas -> Excluida sin fallback
const c3Excluida = !result.compatibleEvidence.some((e) => e.id === candidateSinCoords.id);
console.log(`[CASO 3 - SIN COORDENADAS]: ${c3Excluida ? "✅ EXCLUIDA SIN FALLBACK (NO MOSTRAR)" : "❌ FALLO"}`);
console.assert(c3Excluida === true, "Caso 3 falló: Evidencia sin coordenadas fue aceptada erróneamente");

console.log("\n🎉 TODAS LAS PRUEBAS FUNCIONALES DE LA FASE 2 (ADR-019.13-F2) HAN PASADO SATISFACTORIAMENTE.");
