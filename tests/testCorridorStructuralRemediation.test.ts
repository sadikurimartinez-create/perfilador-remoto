import fs from "node:fs";
import path from "node:path";
import {
  CORRIDOR_REQUIRES_TERRITORIAL_RECONCILIATION,
  assessCorridorIntegrity,
  canonicalizeConfirmedDraftGeography,
  confirmDraftProjectGeography,
  createDraftProjectGeography,
  getCanonicalGeographyCoordinates,
  rehydrateCanonicalProjectGeography,
  updateDraftProjectGeography,
  type CanonicalProjectGeography,
} from "../src/utils/canonicalProjectGeography";

const A = { lat: 21.805111111111113, lng: -102.27056944444445 };
const B = { lat: 21.805330555555557, lng: -102.27055555555556 };
const C = { lat: 21.8056, lng: -102.2704 };

const projectListSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/ProjectList.tsx"),
  "utf8"
);
const projectContextSource = fs.readFileSync(
  path.join(process.cwd(), "src/context/ProjectContext.tsx"),
  "utf8"
);

describe("CORRIDOR structural remediation", () => {
  test("case 1: START A and END B produce a minimal valid LineString", () => {
    const draft = confirmDraftProjectGeography(
      updateDraftProjectGeography(createDraftProjectGeography("lineal"), [A, B])
    );
    const geography = canonicalizeConfirmedDraftGeography({ projectId: "corridor-minimal", draft, now: 1 });

    expect(geography.validationStatus).toBe("VALID");
    expect(getCanonicalGeographyCoordinates(geography)).toEqual([A, B]);
  });

  test("case 2: duplicated photo positions never generate A,A,A,B,B,B automatically", () => {
    expect(projectListSource).not.toContain("buildDraftPointsFromRectorPhotos");
    expect(projectListSource).not.toContain("validRectorPhotoCount");
    expect(projectListSource).toContain("No modifica los nodos territoriales del expediente.");
    expect(projectListSource).toContain("if (!geometryConfirmed || !creationPreview.canConfirm)");
  });

  test("case 3: START and END at the same position are invalid", () => {
    const directDuplicate = assessCorridorIntegrity([A, A]);
    const closedCorridor = assessCorridorIntegrity([A, B, A]);
    const draft = updateDraftProjectGeography(createDraftProjectGeography("lineal"), [A, A]);

    expect(directDuplicate.isValid).toBe(false);
    expect(directDuplicate.requiresReconciliation).toBe(true);
    expect(closedCorridor.hasDistinctStartAndEnd).toBe(false);
    expect(closedCorridor.isValid).toBe(false);
    expect(closedCorridor.requiresReconciliation).toBe(true);
    expect(() => confirmDraftProjectGeography(draft)).toThrow("DRAFT_GEOGRAPHY_INVALID");
  });

  test("case 4: START A, INTERMEDIATE B, END C preserve territorial order", () => {
    const draft = confirmDraftProjectGeography(
      updateDraftProjectGeography(createDraftProjectGeography("lineal"), [A, B, C])
    );
    const geography = canonicalizeConfirmedDraftGeography({ projectId: "corridor-intermediate", draft, now: 2 });

    expect(getCanonicalGeographyCoordinates(geography)).toEqual([A, B, C]);
  });

  test("case 5: additional photos are explicitly non-geometric", () => {
    expect(projectContextSource).toContain("geometryRole: NON_GEOMETRIC_PHOTO_ROLE");
    expect(projectContextSource).toContain("isGeometry: false");
    expect(projectListSource).toContain("Evidencia fotográfica (no modifica nodos territoriales)");
  });

  test("case 6: historical A,A,A,B,B,B is flagged without rewriting coordinates", () => {
    const coordinates = [A, A, A, B, B, B];
    const persisted: CanonicalProjectGeography = {
      geographyId: "geo-historical-corridor",
      type: "CORRIDOR",
      geometry: { type: "LineString", coordinates: coordinates.map((point) => [point.lng, point.lat]) },
      source: "PROJECT_CREATION",
      validationStatus: "VALID",
      createdAt: 1,
      updatedAt: 1,
    };

    const rehydrated = rehydrateCanonicalProjectGeography(persisted)!;
    expect(getCanonicalGeographyCoordinates(rehydrated)).toEqual(coordinates);
    expect(rehydrated.validationStatus).toBe("PARTIAL");
    expect(rehydrated.limitations).toContain(CORRIDOR_REQUIRES_TERRITORIAL_RECONCILIATION);
  });
});
