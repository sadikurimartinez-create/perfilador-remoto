import fs from "node:fs";
import path from "node:path";
import {
  adaptPandillasCanonicalInput,
  derivePandillasStreetViewOrchestrationItem,
} from "../src/services/geoint/pandillasCanonicalInputAdapter";
import { buildCanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";

const projectId = "project-adr02037";
const canonicalGeography = buildCanonicalProjectGeography({
  projectId,
  type: "INDIVIDUAL",
  points: [{ lat: 21.8818, lng: -102.2913 }],
  now: 1,
});

const streetViewInput = {
  id: "street-view-adr02037",
  evidenceId: "street-view-evidence-adr02037",
  sourceEvidenceId: "source-street-view-adr02037",
  evidenceType: "VIRTUAL_STREET_VIEW",
  sourceProvider: "GOOGLE_STREET_VIEW",
  validado: true,
};

describe("ADR-020.37 Pandillas territorial fail-closed integrity", () => {
  test("TEST A Street View without geographyId inherits canonical geography", () => {
    const item = derivePandillasStreetViewOrchestrationItem(projectId, canonicalGeography, streetViewInput);

    expect(item?.evidenceRef.geographyId).toBe(canonicalGeography.geographyId);
  });

  test("TEST B matching Street View geographyId is accepted", () => {
    const item = derivePandillasStreetViewOrchestrationItem(projectId, canonicalGeography, {
      ...streetViewInput,
      geographyId: canonicalGeography.geographyId,
    });

    expect(item?.evidenceRef.geographyId).toBe(canonicalGeography.geographyId);
  });

  test("TEST C mismatched Street View geographyId fails closed", () => {
    expect(() => derivePandillasStreetViewOrchestrationItem(projectId, canonicalGeography, {
      ...streetViewInput,
      geographyId: "geo-other-project",
    })).toThrow("PANDILLAS_STREET_VIEW_GEOGRAPHY_MISMATCH");
  });

  test("TEST D missing canonical geography keeps required error", () => {
    expect(() => adaptPandillasCanonicalInput({
      projectId,
      canonicalGeography: null,
    })).toThrow("PANDILLAS_CANONICAL_GEOGRAPHY_REQUIRED");
  });

  test("TEST E invalid canonical geography keeps validation error", () => {
    expect(() => adaptPandillasCanonicalInput({
      projectId,
      canonicalGeography: { ...canonicalGeography, validationStatus: "INVALID" },
    })).toThrow("PANDILLAS_CANONICAL_GEOGRAPHY_NOT_VALID");
  });

  test("UI autoselection requires canonical coordinates, a gang point and the one-kilometer threshold", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/modules/pandillas/pandillas.ui.tsx"), "utf8");

    expect(source).not.toContain("dist <= 1000 || !projectLat");
    expect(source).toMatch(/projectLat != null\s*&&\s*projectLng != null\s*&&\s*firstPt\s*&&\s*dist <= 1000/);
  });

  test("selected gang centroid does not derive from an empty geometry", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src/modules/pandillas/pandillas.ui.tsx"), "utf8");

    expect(source).toMatch(/g\.geometrias\[0\]\.puntos\.length > 0[\s\S]*?calculateCentroid\(g\.geometrias\[0\]\.puntos\)/);
  });
});
