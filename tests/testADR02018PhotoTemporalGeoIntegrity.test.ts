import { buildPhotoEvidenceGeoFields, normalizePhotoEvidenceGeolocation } from "../src/utils/photoEvidenceGeoIntegrity";
import { buildStreetViewFindingFromTemporalComparison } from "../src/services/geoint/temporalComparisonBridge";
import { compareTemporalEvidence, updateComparisonValidationStatus } from "../src/services/geoint/temporalComparisonService";

function makeGeoEvidence(overrides: any = {}) {
  return {
    id: overrides.id || "geo-evidence",
    expedienteId: "EXP-GEO",
    traceabilityId: overrides.traceabilityId || "trace-geo",
    sourceEvidenceId: overrides.sourceEvidenceId || "source-geo",
    source: overrides.source || "FIELD_PHOTO",
    coordinates: overrides.coordinates ?? { lat: 21.8818, lng: -102.2916 },
    captureDate: overrides.captureDate || "2026-08-28",
    imageReference: overrides.imageReference || "image://test",
    metadata: overrides.metadata || {},
    status: overrides.status || "APPROVED_EVIDENCE",
  };
}

describe("ADR-020.18 Fase 2 - Photo evidence and temporal comparison geointegrity", () => {
  test("PHOTO-01 real GPS photo preserves coordinates and is valid geolocation", () => {
    const result = buildPhotoEvidenceGeoFields({
      id: "photo-gps",
      lat: 21.8818,
      lng: -102.2916,
      gpsSource: "DEVICE",
      gpsAccuracy: 6,
      gpsTimestamp: "2026-08-28T00:00:00.000Z",
    });

    expect(result.lat).toBe(21.8818);
    expect(result.lng).toBe(-102.2916);
    expect(result.geolocationSource).toBe("DEVICE_GPS");
    expect(result.geolocationIntegrity.geolocationStatus).toBe("VALID_GEOLOCATION");
    expect(result.geolocationIntegrity.reportableAsObservedGeoint).toBe(true);
  });

  test("PHOTO-02 photo without GPS does not receive project center or defaults", () => {
    const result = buildPhotoEvidenceGeoFields({
      id: "photo-no-gps",
      previewUrl: "blob://photo",
      project: { latitude: 21.8853, longitude: -102.2916 },
    });

    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
    expect(result.geolocationIntegrity.geolocationStatus).toBe("NOT_GEOREFERENCED");
    expect(result.geolocationIntegrity.reportableAsObservedGeoint).toBe(false);
  });

  test("PHOTO-03 Street View with real panorama metadata preserves panorama coordinates", () => {
    const result = normalizePhotoEvidenceGeolocation({
      id: "sv-photo",
      tipo: "REMOTE_STREET_VIEW",
      streetViewMetadata: {
        panoramaId: "pano-real-1",
        panoramaLat: 21.8851,
        panoramaLng: -102.2911,
        heading: 90,
        pitch: 0,
        fov: 80,
      },
    });

    expect(result.latitude).toBe(21.8851);
    expect(result.longitude).toBe(-102.2911);
    expect(result.source).toBe("STREET_VIEW_PANORAMA");
    expect(result.geoIntegrity.reportableAsObservedGeoint).toBe(true);
  });

  test("PHOTO-04 legacy photo coordinates are preserved but not promoted to verified GPS", () => {
    const result = buildPhotoEvidenceGeoFields({
      id: "legacy-photo",
      lat: 21.8818,
      lng: -102.2916,
    });

    expect(result.lat).toBe(21.8818);
    expect(result.lng).toBe(-102.2916);
    expect(result.geolocationSource).toBe("LEGACY_UNCLASSIFIED");
    expect(result.geolocationIntegrity.geolocationStatus).toBe("PRESERVED_UNVERIFIED");
    expect(result.geolocationIntegrity.reportableAsObservedGeoint).toBe(false);
  });

  test("TEMPORAL-01 temporal comparison with real coordinates preserves location", async () => {
    const result = await compareTemporalEvidence(
      makeGeoEvidence({ id: "a", traceabilityId: "trace-a" }),
      makeGeoEvidence({
        id: "b",
        traceabilityId: "trace-b",
        source: "STREET_VIEW_HISTORICAL",
        coordinates: { lat: 21.88181, lng: -102.29161 },
      })
    );

    expect(result.isSuccess).toBe(true);
    expect(result.comparison?.evidenceA.coordinates.lat).toBe(21.8818);
    expect(result.comparison?.evidenceB.coordinates.lng).toBe(-102.29161);
  });

  test("TEMPORAL-02 comparison without coordinates does not produce zero-zero", async () => {
    const syntheticUpdate = await updateComparisonValidationStatus(
      "cmp-without-geo",
      "EXP-GEO",
      "APPROVED_EVIDENCE",
      "reviewed"
    );
    const finding = buildStreetViewFindingFromTemporalComparison({
      comparisonId: "cmp-no-geo-finding",
      expedienteId: "EXP-GEO",
      traceabilityId: "trace-no-geo",
      sourceEvidenceId: "source-no-geo",
      evidenceA: makeGeoEvidence({ coordinates: { lat: null, lng: null } }),
      evidenceB: makeGeoEvidence({ source: "STREET_VIEW_HISTORICAL", coordinates: { lat: null, lng: null } }),
      aiAnalysis: { calibratedObservation: "Sin coordenada real." },
      analystValidationStatus: "APPROVED_EVIDENCE",
      createdAt: "2026-08-28T00:00:00.000Z",
    } as any);

    expect(syntheticUpdate?.evidenceA.coordinates).toEqual({ lat: null, lng: null });
    expect(syntheticUpdate?.evidenceB.coordinates).toEqual({ lat: null, lng: null });
    expect(finding.coordenadas).toEqual({ lat: null, lng: null });
    expect(finding.geolocationIntegrity.reportableAsObservedGeoint).toBe(false);
  });

  test("TEMPORAL-03 invalid temporal coordinate is not georeferenced", () => {
    const finding = buildStreetViewFindingFromTemporalComparison({
      comparisonId: "cmp-invalid-geo",
      expedienteId: "EXP-GEO",
      traceabilityId: "trace-invalid",
      sourceEvidenceId: "source-invalid",
      evidenceA: makeGeoEvidence({ coordinates: { lat: Number.NaN, lng: -102.2916 } }),
      evidenceB: makeGeoEvidence({ source: "STREET_VIEW_HISTORICAL", coordinates: { lat: Number.NaN, lng: -102.2916 } }),
      aiAnalysis: { calibratedObservation: "Coordenada inválida." },
      analystValidationStatus: "APPROVED_EVIDENCE",
      createdAt: "2026-08-28T00:00:00.000Z",
    } as any);

    expect(finding.coordenadas).toEqual({ lat: null, lng: null });
    expect(finding.geolocationIntegrity.geolocationStatus).toBe("NOT_GEOREFERENCED");
    expect(finding.geolocationIntegrity.reportableAsObservedGeoint).toBe(false);
  });
});
