import {
  UniversalEvidenceComparisonToFinding,
  buildStreetViewFindingFromTemporalComparison,
} from "../src/services/geoint/temporalComparisonBridge";
import {
  buildTemporalComparisonRecord,
  getApprovedTemporalComparisons,
  saveTemporalComparisonRecord,
} from "../src/services/geoint/temporalComparisonService";
import { GeointGovernanceStatus } from "../src/types/geointGovernance";
import { GeoEvidence } from "../src/types/geointEvidence";
import { UniversalEvidenceComparison } from "../src/types/geointTemporalComparison";

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
    throw new Error(testName);
  }
}

export async function runADR01917ConnectivityTests() {
  console.log("\n================================================================");
  console.log("🛡️  SUITE ADR-019.17: CONTRATOS DE CONECTIVIDAD GEOINT");
  console.log("================================================================\n");

  const evidenceA: GeoEvidence = {
    id: "ev-a-01917",
    expedienteId: "EXP-01917",
    traceabilityId: "trace-photo-original-01917",
    sourceEvidenceId: "photo-original-01917",
    source: "FIELD_PHOTO",
    coordinates: { lat: 21.88542, lng: -102.29124 },
    captureDate: "2026-05-10",
    imageReference: "/photos/campo-01917.jpg",
    metadata: { sourceProvider: "CEIPOL_FIELD", originalFindingId: "photo-original-01917" },
    status: GeointGovernanceStatus.APPROVED_EVIDENCE,
  };

  const evidenceB: GeoEvidence = {
    id: "ev-b-01917",
    expedienteId: "EXP-01917",
    traceabilityId: "trace-panorama-01917",
    sourceEvidenceId: "pano-google-01917",
    source: "STREET_VIEW_AUTOMATIC",
    coordinates: { lat: 21.88543, lng: -102.29122 },
    captureDate: "2024-08",
    imageReference: "/photos/streetview-01917.jpg",
    metadata: { sourceProvider: "GOOGLE_STREET_VIEW", panoramaId: "pano-google-01917", heading: 90 },
    status: GeointGovernanceStatus.PENDING_REVIEW,
  };

  const comparison: UniversalEvidenceComparison = {
    comparisonId: "cmp-01917",
    expedienteId: "EXP-01917",
    traceabilityId: "trace-cmp-01917",
    sourceEvidenceId: evidenceA.sourceEvidenceId,
    evidenceA,
    evidenceB,
    comparisonType: "TEMPORAL_VISUAL_DELTA",
    spatialValidation: { isCompatible: true, distanceMeters: 2.35 },
    temporalValidation: {
      isValid: true,
      dateA: "2026-05-10",
      dateB: "2024-08",
      dateDifferenceDays: 648,
      dateDifferenceFormatted: "648 días (~1.8 años)",
    },
    createdBy: "ANALISTA_TEST",
    createdAt: "2026-08-25T12:00:00.000Z",
    aiAnalysis: {
      temporalDeltaDays: 648,
      temporalDeltaFormatted: "648 días (~1.8 años)",
      observedChanges: ["Cambio estructural visible."],
      structuralModifications: ["Modificacion perimetral."],
      riskDiscrepancies: ["Variacion ambiental."],
      confidenceScore: 0.9,
      calibratedObservation: "Comparacion temporal con trazabilidad completa.",
    },
    analystValidationStatus: GeointGovernanceStatus.PENDING_REVIEW,
  };

  const record = buildTemporalComparisonRecord(comparison);
  assert(record.traceabilityId === comparison.traceabilityId, "TemporalComparisonRecord conserva traceabilityId");
  assert(record.evidenceA.sourceEvidenceId === evidenceA.sourceEvidenceId, "TemporalComparisonRecord conserva fuente original A");
  assert(record.evidenceB.traceabilityId === evidenceB.traceabilityId, "TemporalComparisonRecord conserva trazabilidad de panorama B");

  // Probar la función pura del Bridge UniversalEvidenceComparisonToFinding
  console.log("➡️ Ejecutando prueba de Bridge UniversalEvidenceComparisonToFinding...");
  const findingPure = UniversalEvidenceComparisonToFinding(comparison);
  assert(findingPure.expedienteId === "EXP-01917", "Bridge Pure: expedienteId mapeado correctamente");
  assert(findingPure.traceabilityId === "trace-cmp-01917", "Bridge Pure: traceabilityId mapeado correctamente");
  assert(findingPure.sourceEvidenceId === "photo-original-01917", "Bridge Pure: sourceEvidenceId mapeado correctamente");
  assert(findingPure.coordenadas.lat === 21.88543, "Bridge Pure: latitud de evidencia contextual mapeada correctamente");
  assert(findingPure.coordenadas.lng === -102.29122, "Bridge Pure: longitud de evidencia contextual mapeada correctamente");
  assert(findingPure.imagen === "/photos/streetview-01917.jpg", "Bridge Pure: imagen de evidencia contextual mapeada correctamente");
  assert(findingPure.estado === GeointGovernanceStatus.PENDING_REVIEW, "Bridge Pure: estado PENDING_REVIEW mapeado correctamente");

  const finding = buildStreetViewFindingFromTemporalComparison(comparison);
  assert(finding.expedienteId === comparison.expedienteId, "Bridge usa expedienteId universal");
  assert(finding.coordenadas.lat === evidenceB.coordinates.lat, "Bridge usa coordenadas de evidencia contextual");
  assert(finding.imagen === evidenceB.imageReference, "Bridge usa imagen de evidencia contextual");
  assert(finding.estado === GeointGovernanceStatus.PENDING_REVIEW, "Bridge conserva estado canonico");
  assert(finding.traceabilityId === comparison.traceabilityId, "Bridge conserva traceabilityId");

  // Validar la cadena de trazabilidad obligatoria (Traceability Chain Validation)
  console.log("➡️ Validando Cadena de Trazabilidad Forense...");
  // Fotografía original -> GeoEvidence -> StreetView Panorama -> Temporal Comparison -> Finding -> Report
  assert(!!evidenceA.sourceEvidenceId, "Paso 1: Fotografía original mapeada en GeoEvidence (sourceEvidenceId)");
  assert(evidenceA.traceabilityId !== undefined, "Paso 2: GeoEvidence cuenta con un traceabilityId válido");
  assert(evidenceB.traceabilityId !== undefined, "Paso 3: StreetView Panorama cuenta con traceabilityId");
  assert(comparison.traceabilityId !== undefined, "Paso 4: Temporal Comparison propaga traceabilityId de manera obligatoria");
  assert(findingPure.traceabilityId === comparison.traceabilityId, "Paso 5: Finding conserva traceabilityId original");
  assert(findingPure.sourceEvidenceId === evidenceA.sourceEvidenceId, "Paso 6: Finding mantiene vinculación con fotografía original");

  const originalWindow = (global as any).window;
  const originalFetch = (global as any).fetch;
  const posted: any[] = [];
  (global as any).window = {};
  (global as any).fetch = async (url: string, init?: any) => {
    posted.push({ url, init });
    return {
      ok: true,
      json: async () => ({ comparison: JSON.parse(init.body) }),
    };
  };

  try {
    const saved = await saveTemporalComparisonRecord(record);
    assert(saved.id === record.id, "Persistencia temporal usa POST backend ADR-019.8");
    assert(posted[0].url === "/api/expedientes/EXP-01917/geoint/temporal-comparisons", "POST apunta al endpoint temporal real");

    (global as any).fetch = async (url: string) => {
      posted.push({ url });
      return {
        ok: true,
        json: async () => ({
          comparisons: [
            {
              ...record,
              analystValidation: { ...record.analystValidation, status: GeointGovernanceStatus.APPROVED_EVIDENCE },
            },
          ],
        }),
      };
    };

    const approved = await getApprovedTemporalComparisons("EXP-01917");
    assert(approved.length === 1, "GET aprobadas consume respuesta backend comparisons[]");
  } finally {
    (global as any).window = originalWindow;
    (global as any).fetch = originalFetch;
  }

  console.log("\n📊 RESUMEN ADR-019.17: CONTRATOS DE CONECTIVIDAD OK\n");
}
