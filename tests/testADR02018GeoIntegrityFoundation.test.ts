import { validateGeoIntegrity } from "../src/utils/geoIntegrityEngine";
import { resolveProjectGeolocationForReport } from "../src/utils/intelligenceLayoutEngine";
import { runOSINTScan } from "../src/utils/osintEngine";

describe("ADR-020.18 Fase 1 - GeoIntegrity foundation", () => {
  test("TEST 1 real valid coordinates with legitimate source are valid geolocation", () => {
    const result = validateGeoIntegrity({
      latitude: 21.8818,
      longitude: -102.2916,
      source: "EXIF_GPS",
      precision: 8,
      observedAt: "2026-08-28T00:00:00.000Z",
      sourceReference: "photo.exif",
    });

    expect(result.geolocationStatus).toBe("VALID_GEOLOCATION");
    expect(result.confidence).toBe("VERIFIED");
    expect(result.source).toBe("EXIF_GPS");
    expect(result.reportableAsObservedGeoint).toBe(true);
  });

  test("TEST 2 zero-zero fallback is invalid and not georeferenced", () => {
    const result = validateGeoIntegrity({ latitude: 0, longitude: 0, source: "DEFAULT" });

    expect(result.latitude).toBeNull();
    expect(result.longitude).toBeNull();
    expect(result.geolocationStatus).toBe("INVALID");
    expect(result.reportableAsObservedGeoint).toBe(false);
  });

  test("TEST 3 NaN and malformed coordinates are invalid", () => {
    const nanResult = validateGeoIntegrity({ latitude: Number.NaN, longitude: -102.2916, source: "EXIF_GPS" });
    const malformedResult = validateGeoIntegrity({ latitude: "21.88", longitude: "not-a-number", source: "EXIF_GPS" });

    expect(nanResult.geolocationStatus).toBe("NOT_GEOREFERENCED");
    expect(malformedResult.geolocationStatus).toBe("NOT_GEOREFERENCED");
    expect(malformedResult.reportableAsObservedGeoint).toBe(false);
  });

  test("TEST 4 out-of-range latitude or longitude is invalid", () => {
    const badLat = validateGeoIntegrity({ latitude: 91, longitude: -102.2916, source: "SOURCE_RECORD" });
    const badLng = validateGeoIntegrity({ latitude: 21.8818, longitude: -181, source: "SOURCE_RECORD" });

    expect(badLat.geolocationStatus).toBe("INVALID");
    expect(badLng.geolocationStatus).toBe("INVALID");
    expect(badLat.reportableAsObservedGeoint).toBe(false);
    expect(badLng.reportableAsObservedGeoint).toBe(false);
  });

  test("TEST 5 synthetic random jitter source cannot qualify as observed geolocation", () => {
    for (const source of ["SYNTHETIC", "RANDOM", "JITTER", "AI_GENERATED"] as const) {
      const result = validateGeoIntegrity({ latitude: 21.8818, longitude: -102.2916, source });

      expect(result.geolocationStatus).toBe("INVALID");
      expect(result.isSynthetic).toBe(true);
      expect(result.reportableAsObservedGeoint).toBe(false);
    }
  });

  test("TEST 6 legacy coordinate without known provenance is preserved but not promoted to verified GPS", () => {
    const result = validateGeoIntegrity({
      latitude: 21.8818,
      longitude: -102.2916,
      source: "LEGACY_UNCLASSIFIED",
      sourceReference: "legacy.case.coordinate",
    });

    expect(result.latitude).toBe(21.8818);
    expect(result.longitude).toBe(-102.2916);
    expect(result.geolocationStatus).toBe("PRESERVED_UNVERIFIED");
    expect(result.confidence).toBe("UNKNOWN");
    expect(result.source).not.toBe("GPS");
    expect(result.reportableAsObservedGeoint).toBe(false);
  });

  test("TEST 7 selected synthetic jitter OSINT producer no longer emits reportable observed coordinates", async () => {
    const result = await runOSINTScan({
      locationName: "Sector sin coordenada certificada",
      latitude: 21.8818,
      longitude: -102.2916,
      geolocationSource: "PROJECT_GEOMETRY",
    });

    expect(result.epistemicIntegrity.geolocationSource).toBe("SYNTHETIC_POINT");
    expect(result.denue[0].lat).toBeNull();
    expect(result.denue[0].lng).toBeNull();
    expect(result.denue[0].geolocationIntegrity.source).toBe("JITTER");
    expect(result.denue[0].geolocationIntegrity.reportableAsObservedGeoint).toBe(false);
    expect(result.googlePlaces[0].geolocationIntegrity.reportableAsObservedGeoint).toBe(false);
  });

  test("TEST 8 real Street View panorama coordinates remain valid", () => {
    const result = validateGeoIntegrity({
      latitude: 21.8851,
      longitude: -102.2911,
      source: "STREET_VIEW_PANORAMA",
      precision: 15,
      observedAt: "2026-08-28T00:00:00.000Z",
      sourceReference: "streetView.panorama",
    });

    expect(result.geolocationStatus).toBe("VALID_GEOLOCATION");
    expect(result.source).toBe("STREET_VIEW_PANORAMA");
    expect(result.reportableAsObservedGeoint).toBe(true);
  });

  test("TEST 9 missing Report/Layout coordinates do not become zero-zero or default Aguascalientes analytical coordinates", () => {
    const missing = resolveProjectGeolocationForReport({});
    const zeroZero = resolveProjectGeolocationForReport({ latitude: 0, longitude: 0, geolocationSource: "DEFAULT" });
    const defaultAgs = resolveProjectGeolocationForReport({
      latitude: 21.8853,
      longitude: -102.2916,
      geolocationSource: "PROJECT_GEOMETRY",
    });

    expect(missing.latitude).toBeNull();
    expect(missing.longitude).toBeNull();
    expect(zeroZero.latitude).toBeNull();
    expect(zeroZero.longitude).toBeNull();
    expect(defaultAgs.latitude).toBeNull();
    expect(defaultAgs.longitude).toBeNull();
  });
});
