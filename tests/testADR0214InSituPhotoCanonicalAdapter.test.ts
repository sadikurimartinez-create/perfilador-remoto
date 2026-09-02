import {
  deriveInSituPhotoCanonicalEvidence,
  deriveInSituPhotoOrchestrationItem,
  isExplicitInSituPhoto,
} from "../src/services/geoint/inSituPhotoCanonicalAdapter";
import { classifySourceDependency } from "../src/services/geoint/multisourceOrchestrationService";

describe("ADR-021.4D-1C in-situ photo canonical adapter", () => {
  test("uses real photo id as native evidence identity", () => {
    const ref = deriveInSituPhotoCanonicalEvidence({
      expedienteId: "EXP-1",
      photoId: "photo-real-1",
      sourceEvidenceId: "source-photo-1",
      geographyId: "geo-1",
    });
    expect(ref?.nativeEvidenceId).toBe("photo-real-1");
    expect(ref?.sourceId).toBe("source-photo-1");
    expect(ref?.nativeType).toBe("FIELD_PHOTO_EVIDENCE");
    expect(ref?.sourceType).toBe("FIELD_PHOTO");
  });

  test("missing source evidence remains legacy partial and is not fabricated", () => {
    const ref = deriveInSituPhotoCanonicalEvidence({
      expedienteId: "EXP-1",
      photoId: "photo-real-2",
      sourceEvidenceId: null,
      geographyId: "geo-1",
    });
    expect(ref?.nativeEvidenceId).toBe("photo-real-2");
    expect(ref?.sourceId).toBeUndefined();
    expect(ref?.lineageStatus).toBe("LEGACY_PARTIAL");
  });

  test("does not reuse evidenceId as sourceEvidenceId", () => {
    const ref = deriveInSituPhotoCanonicalEvidence({
      expedienteId: "EXP-1",
      photoId: "photo-real-3",
      evidenceId: "institutional-evidence-label",
      sourceEvidenceId: null,
    });
    expect(ref?.sourceId).toBeUndefined();
  });

  test("validated legacy-partial photo cannot become fully orchestration eligible", () => {
    const item = deriveInSituPhotoOrchestrationItem({
      expedienteId: "EXP-1",
      photoId: "photo-legacy-partial",
      sourceEvidenceId: null,
      geographyId: "geo-1",
      gpsSource: "SOLO_EXIF_GPS",
      validado: true,
    });

    expect(item?.evidenceRef?.lineageStatus).toBe("LEGACY_PARTIAL");
    expect(item?.source.integrityClassification).toBe("READY_WITH_LIMITATIONS");
    expect(item?.eligibility).toBe("LIMITED");
  });

  test("missing photo id produces no canonical evidence", () => {
    const ref = deriveInSituPhotoCanonicalEvidence({
      expedienteId: "EXP-1",
      photoId: "   ",
    });
    expect(ref).toBeNull();
  });

  test("validated field photo is orchestration eligible", () => {
    const item = deriveInSituPhotoOrchestrationItem({
      expedienteId: "EXP-1",
      photoId: "photo-real-4",
      sourceEvidenceId: "source-real-4",
      gpsSource: "SOLO_EXIF_GPS",
      validado: true,
    });
    expect(item?.eligibility).toBe("ELIGIBLE");
    expect(item?.source.integrityClassification).toBe("VERIFIED");
  });

  test("unvalidated field photo is limited, not fully eligible", () => {
    const item = deriveInSituPhotoOrchestrationItem({
      expedienteId: "EXP-1",
      photoId: "photo-real-5",
      sourceEvidenceId: "source-real-5",
      validado: false,
    });
    expect(item?.eligibility).toBe("LIMITED");
    expect(item?.source.integrityClassification).toBe("READY_WITH_LIMITATIONS");
  });

  test("adapter never generates random or temporal provenance", () => {
    const item = deriveInSituPhotoOrchestrationItem({
      expedienteId: "EXP-1",
      photoId: "photo-real-6",
      sourceEvidenceId: null,
    });
    expect(item?.source.rawSourceReference).toBe("photo-real-6");
    expect(item?.source.sourceId).toBeUndefined();
  });

  test("gps validation method is not provider identity or proof of source independence", () => {
    const left = deriveInSituPhotoOrchestrationItem({
      expedienteId: "EXP-1",
      photoId: "photo-left",
      sourceEvidenceId: "source-left",
      gpsSource: "SOLO_EXIF_GPS",
      validado: true,
    });

    const right = deriveInSituPhotoOrchestrationItem({
      expedienteId: "EXP-1",
      photoId: "photo-right",
      sourceEvidenceId: "source-right",
      gpsSource: "SOLO_DEVICE_GPS",
      validado: true,
    });

    expect(left).not.toBeNull();
    expect(right).not.toBeNull();
    expect(left?.source.providerId).toBeUndefined();
    expect(right?.source.providerId).toBeUndefined();
    expect(classifySourceDependency(left!, right!)).toBe("UNKNOWN_DEPENDENCY");
  });

  test("explicit GPS/EXIF/manual capture methods classify as field photos", () => {
    for (const gpsSource of [
      "VALIDACION_CRUZADA_DEVICE_PRIORITY",
      "VALIDACION_CRUZADA_EXIF_PRIORITY",
      "DISCREPANCIA_DEVICE_PRIORITY",
      "DISCREPANCIA_EXIF_PRIORITY",
      "SOLO_DEVICE_GPS",
      "SOLO_EXIF_GPS",
      "MANUAL",
    ]) {
      expect(isExplicitInSituPhoto({ gpsSource })).toBe(true);
    }
  });

  test("street view album records never classify as field photos", () => {
    expect(isExplicitInSituPhoto({ gpsSource: "STREET_VIEW" })).toBe(false);
    expect(isExplicitInSituPhoto({ tipo: "STREET_VIEW", gpsSource: "SOLO_EXIF_GPS" })).toBe(false);
    expect(isExplicitInSituPhoto({ analysisType: "STREET_VIEW", gpsSource: "SOLO_DEVICE_GPS" })).toBe(false);
    expect(isExplicitInSituPhoto({ streetViewSource: "Google Street View", gpsSource: "MANUAL" })).toBe(false);
  });

  test("geographic vectors never classify as field photos", () => {
    expect(isExplicitInSituPhoto({
      evidenceType: "GEOGRAPHIC_VECTOR",
      gpsSource: "MANUAL",
    })).toBe(false);
  });

  test("unknown album origin is not silently promoted to field photo", () => {
    expect(isExplicitInSituPhoto({})).toBe(false);
    expect(isExplicitInSituPhoto({ gpsSource: "UNAVAILABLE" })).toBe(false);
  });
});
