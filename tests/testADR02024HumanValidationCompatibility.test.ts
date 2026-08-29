import fs from "node:fs";
import path from "node:path";
import {
  evaluateHumanValidation,
  applyHumanValidationAction,
} from "../src/utils/humanValidationPolicy";
import {
  createStoredRawMultimodalEvidence,
  markHumanApproved,
  markHumanRejected,
  markReadyForHumanReview,
  markReturnedForReanalysis,
  markAiAnalyzed,
} from "../src/utils/multimodalEvidenceContract";
import {
  classifyLegacyCompatibility,
  evaluateIntelligenceEligibility,
} from "../src/utils/syntheticIntelligenceFirewall";
import { mapStreetViewToAlbumPhoto } from "../src/modules/streetView/streetViewMapper";

describe("ADR-020.24 - Human validation and legacy compatibility", () => {
  test("TEST 1 high AI score does not become APPROVED", () => {
    const evidence = markReadyForHumanReview(
      markAiAnalyzed(
        createStoredRawMultimodalEvidence({
          evidenceId: "ev-ai",
          expedienteId: "exp-ai",
          fileName: "ai.jpg",
          mimeType: "image/jpeg",
          storageReference: "raw/ai.jpg",
          ingestionSource: "USER_UPLOAD",
        }),
        "derived/ai",
        99
      )
    );

    expect(evidence.analysisStatus).toBe("READY_FOR_HUMAN_REVIEW");
    expect(evidence.humanValidationStatus).toBe("PENDING_REVIEW");
    expect(evaluateHumanValidation(evidence).isInstitutionalApproval).toBe(false);
  });

  test("TEST 2 validado:true legacy does not fabricate new approval", () => {
    const result = evaluateHumanValidation({ validado: true });

    expect(result.status).toBe("LEGACY_UNCLASSIFIED");
    expect(result.source).toBe("TECHNICAL_BOOLEAN");
    expect(result.isInstitutionalApproval).toBe(false);
    expect(result.reportEligibilityLabel).toBe("NOT_REPORT_ELIGIBLE");
  });

  test("TEST 3 isAudited:true legacy does not fabricate new approval", () => {
    const result = evaluateHumanValidation({ isAudited: true });

    expect(result.status).toBe("LEGACY_UNCLASSIFIED");
    expect(result.source).toBe("TECHNICAL_BOOLEAN");
    expect(result.isInstitutionalApproval).toBe(false);
  });

  test("TEST 4 human approve is APPROVED and persisted-shaped", () => {
    const evidence = createStoredRawMultimodalEvidence({
      evidenceId: "ev-approve",
      expedienteId: "exp-approve",
      fileName: "approve.pdf",
      mimeType: "application/pdf",
      storageReference: "raw/approve.pdf",
      ingestionSource: "USER_UPLOAD",
    });
    const approved = markHumanApproved(evidence, {
      validatedAt: "2026-08-29T10:00:00.000Z",
      validatedBy: { id: "user-1", username: "validador.real" },
    });

    expect(approved.humanValidationStatus).toBe("APPROVED");
    expect(approved.validationSource).toBe("ADR_020_24_HUMAN_ACTION");
    expect(approved.validatedBy?.username).toBe("validador.real");
    expect(approved.validatedAt).toBe("2026-08-29T10:00:00.000Z");
  });

  test("TEST 5 human reject persists REJECTED and is not report eligible", () => {
    const rejected = markHumanRejected(
      createStoredRawMultimodalEvidence({
        evidenceId: "ev-reject",
        expedienteId: "exp-reject",
        fileName: "reject.pdf",
        mimeType: "application/pdf",
        storageReference: "raw/reject.pdf",
        ingestionSource: "USER_UPLOAD",
      }),
      { validatedAt: "2026-08-29T10:10:00.000Z", validatedBy: { id: "user-2" } }
    );

    expect(rejected.humanValidationStatus).toBe("REJECTED");
    expect(evaluateIntelligenceEligibility({
      acquisitionMode: "OBSERVED",
      validationStatus: rejected.humanValidationStatus,
      semanticRole: "SOURCE_FACT",
    }).eligibleForReport).toBe(false);
  });

  test("TEST 6 return for reanalysis persists RETURNED_FOR_REANALYSIS and is not report eligible", () => {
    const returned = markReturnedForReanalysis(
      createStoredRawMultimodalEvidence({
        evidenceId: "ev-return",
        expedienteId: "exp-return",
        fileName: "return.pdf",
        mimeType: "application/pdf",
        storageReference: "raw/return.pdf",
        ingestionSource: "USER_UPLOAD",
      }),
      { validatedAt: "2026-08-29T10:20:00.000Z", validatedBy: { id: "user-3" } }
    );
    const eligibility = evaluateIntelligenceEligibility({
      acquisitionMode: "OBSERVED",
      validationStatus: returned.humanValidationStatus,
      semanticRole: "SOURCE_FACT",
    });

    expect(returned.humanValidationStatus).toBe("RETURNED_FOR_REANALYSIS");
    expect(eligibility.eligibleForReport).toBe(false);
    expect(eligibility.blockingReasons).toContain("VALIDATION_RETURNED_FOR_REANALYSIS");
  });

  test("TEST 7 SIMULATED plus APPROVED is still not report eligible", () => {
    const eligibility = evaluateIntelligenceEligibility({
      acquisitionMode: "SIMULATED",
      validationStatus: "APPROVED",
      semanticRole: "SOURCE_FACT",
    });

    expect(eligibility.eligibleForReport).toBe(false);
    expect(eligibility.blockingReasons).toContain("SIMULATED_CONTENT_NOT_REPORTABLE");
  });

  test("TEST 8 OBSERVED plus APPROVED may be report eligible", () => {
    const eligibility = evaluateIntelligenceEligibility({
      acquisitionMode: "OBSERVED",
      validationStatus: "APPROVED",
      semanticRole: "SOURCE_FACT",
    });

    expect(eligibility.eligibleForReport).toBe(true);
  });

  test("TEST 9 legacy approved is preserved by compatibility policy and distinguishable from new approval", () => {
    const legacyHuman = evaluateHumanValidation({ status: "APROBADO" });
    const legacyReport = classifyLegacyCompatibility({ status: "APROBADO" });
    const normalized = evaluateIntelligenceEligibility({ status: "APROBADO" });

    expect(legacyHuman.status).toBe("APPROVED");
    expect(legacyHuman.source).toBe("LEGACY_COMPATIBILITY");
    expect(legacyHuman.isInstitutionalApproval).toBe(false);
    expect(legacyHuman.isLegacyCompatibleApproval).toBe(true);
    expect(legacyReport.compatibleForReport).toBe(true);
    expect(normalized.normalizedMetadata.validationStatus).toBe("LEGACY_UNCLASSIFIED");
  });

  test("TEST 10 validatedBy real is preserved and absent user is null, not fabricated", () => {
    const real = applyHumanValidationAction({
      action: "APPROVE",
      validatedAt: "2026-08-29T10:30:00.000Z",
      validatorIdentity: { id: "u-real", username: "persona.real" },
    });
    const absent = applyHumanValidationAction({
      action: "APPROVE",
      validatedAt: "2026-08-29T10:31:00.000Z",
      validatorIdentity: null,
    });

    expect(real.validatedBy).toEqual({ id: "u-real", username: "persona.real" });
    expect(absent.validatedBy).toBeNull();
    expect(JSON.stringify(absent)).not.toContain("admin");
    expect(JSON.stringify(absent)).not.toContain("system");
    expect(JSON.stringify(absent)).not.toContain("analyst");
    expect(JSON.stringify(absent)).not.toContain("unknown-user");
  });

  test("TEST 11 reload recovers persisted human status", () => {
    const persisted = markHumanApproved(
      createStoredRawMultimodalEvidence({
        evidenceId: "ev-reload",
        expedienteId: "exp-reload",
        fileName: "reload.pdf",
        mimeType: "application/pdf",
        storageReference: "raw/reload.pdf",
        ingestionSource: "USER_UPLOAD",
      }),
      { validatedAt: "2026-08-29T10:40:00.000Z", validatedBy: { id: "u-reload" } }
    );
    const rehydrated = JSON.parse(JSON.stringify(persisted));

    expect(evaluateHumanValidation(rehydrated).status).toBe("APPROVED");
    expect(evaluateHumanValidation(rehydrated).isInstitutionalApproval).toBe(true);
    expect(rehydrated.validatedAt).toBe("2026-08-29T10:40:00.000Z");
  });

  test("TEST 12 Street View capture without explicit human approval is not APPROVED automatically", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/modules/streetView/streetViewPanoramaPicker.tsx"),
      "utf8"
    );
    expect(source).not.toContain('estado_revision: "APROBADO"');

    const photo = mapStreetViewToAlbumPhoto({
      dataUrl: "data:image/jpeg;base64,abc",
      poiLat: 21.88,
      poiLng: -102.29,
      panoramaLat: 21.881,
      panoramaLng: -102.291,
      heading: 90,
      pitch: 0,
      fov: 90,
      analystName: "operador.real",
      estado_revision: "PENDIENTE_REVISION",
    });

    expect(photo.validado).toBe(true);
    expect(photo.humanValidationStatus).toBe("PENDING_REVIEW");
    expect(evaluateHumanValidation(photo).isInstitutionalApproval).toBe(false);
  });
});
