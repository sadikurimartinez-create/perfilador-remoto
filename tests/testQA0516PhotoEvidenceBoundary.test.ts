import {
  isReportEngineEvidenceEligible,
  isReportEnginePhotoEvidenceEligible,
} from "../src/lib/reportEngine";

describe("QA-05.16 - Photo evidence boundary", () => {
  test("TEST 1 legacy/raw photo with identity remains eligible as source evidence", () => {
    expect(
      isReportEnginePhotoEvidenceEligible({
        id: "legacy-photo-1",
        previewUrl: "data:image/jpeg;base64,abc",
        validado: true,
      })
    ).toBe(true);
  });

  test("TEST 2 evidenceId alone satisfies source evidence identity", () => {
    expect(
      isReportEnginePhotoEvidenceEligible({
        evidenceId: "evidence-photo-2",
      })
    ).toBe(true);
  });

  test("TEST 3 rejected photo is excluded", () => {
    expect(
      isReportEnginePhotoEvidenceEligible({
        id: "rejected-photo",
        humanValidationStatus: "REJECTED",
      })
    ).toBe(false);
  });

  test("TEST 4 returned-for-reanalysis photo is excluded", () => {
    expect(
      isReportEnginePhotoEvidenceEligible({
        id: "returned-photo",
        humanValidationStatus: "RETURNED_FOR_REANALYSIS",
      })
    ).toBe(false);
  });

  test.each([
    "SIMULATED",
    "MOCK",
    "TEST",
    "CONNECTIVITY_ONLY",
  ])("TEST 5 acquisitionMode %s is excluded", (acquisitionMode) => {
    expect(
      isReportEnginePhotoEvidenceEligible({
        id: `photo-${acquisitionMode}`,
        epistemicIntegrity: {
          acquisitionMode,
        },
      })
    ).toBe(false);
  });

  test("TEST 6 explicit simulated boolean is excluded", () => {
    expect(
      isReportEnginePhotoEvidenceEligible({
        id: "simulated-boolean",
        isSimulated: true,
      })
    ).toBe(false);

    expect(
      isReportEnginePhotoEvidenceEligible({
        id: "simulated-epistemic",
        epistemicIntegrity: {
          isSimulated: true,
        },
      })
    ).toBe(false);
  });

  test("TEST 7 connectivity-only boolean is excluded", () => {
    expect(
      isReportEnginePhotoEvidenceEligible({
        id: "connectivity-boolean",
        isConnectivityOnly: true,
      })
    ).toBe(false);
  });

  test("TEST 8 item without evidence identity is excluded", () => {
    expect(
      isReportEnginePhotoEvidenceEligible({
        previewUrl: "data:image/jpeg;base64,abc",
      })
    ).toBe(false);
  });

  test("TEST 9 photo boundary does not weaken strict intelligence firewall", () => {
    const rawPhoto = {
      id: "raw-photo",
    };

    expect(isReportEnginePhotoEvidenceEligible(rawPhoto)).toBe(true);
    expect(isReportEngineEvidenceEligible(rawPhoto)).toBe(false);
  });

  test("TEST 10 approved observed intelligence remains report eligible", () => {
    expect(
      isReportEngineEvidenceEligible({
        id: "approved-intelligence",
        epistemicIntegrity: {
          acquisitionMode: "OBSERVED",
          acquisitionStatus: "ACQUIRED",
          validationStatus: "APPROVED",
          semanticRole: "SOURCE_FACT",
          traceabilityId: "trace-approved-intelligence",
        },
      })
    ).toBe(true);
  });
});
