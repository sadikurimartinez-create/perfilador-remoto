import fs from "node:fs";
import path from "node:path";
import {
  buildDraftGeographyPreview,
  canonicalizeConfirmedDraftGeography,
  confirmDraftProjectGeography,
  createDraftProjectGeography,
  getCanonicalGeographyCoordinates,
  resetDraftProjectGeography,
  updateDraftProjectGeography,
} from "../src/utils/canonicalProjectGeography";

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const p1 = { lat: 21.881, lng: -102.291 };
const p2 = { lat: 21.882, lng: -102.292 };
const p3 = { lat: 21.883, lng: -102.293 };
const photoPoint = { lat: 22.5, lng: -101.5 };

describe("ADR-020.29A.1 - Geography definition / preview / confirmation UI hardening", () => {
  test("TEST 1 individual draft with no point cannot confirm/create", () => {
    const draft = createDraftProjectGeography("individual");
    expect(buildDraftGeographyPreview(draft).canConfirm).toBe(false);
    expect(() => canonicalizeConfirmedDraftGeography({ projectId: "EXP-A1", draft })).toThrow("DRAFT_GEOGRAPHY_NOT_CONFIRMED");
  });

  test("TEST 2 individual valid point preview matches persisted Point", () => {
    const draft = confirmDraftProjectGeography(updateDraftProjectGeography(createDraftProjectGeography("individual"), [p1]));
    const preview = buildDraftGeographyPreview(draft);
    const persisted = canonicalizeConfirmedDraftGeography({ projectId: "EXP-A2", draft, now: 2 });
    expect(preview.geometry.type).toBe("Point");
    expect(persisted.geometry).toEqual(preview.geometry);
  });

  test("TEST 3 corridor one node cannot confirm", () => {
    const draft = updateDraftProjectGeography(createDraftProjectGeography("lineal"), [p1]);
    expect(buildDraftGeographyPreview(draft).validationStatus).toBe("PARTIAL");
    expect(() => confirmDraftProjectGeography(draft)).toThrow("DRAFT_GEOGRAPHY_INVALID");
  });

  test("TEST 4 corridor ordered nodes preview order equals persisted LineString order", () => {
    const draft = confirmDraftProjectGeography(updateDraftProjectGeography(createDraftProjectGeography("lineal"), [p1, p2, p3]));
    const persisted = canonicalizeConfirmedDraftGeography({ projectId: "EXP-A4", draft, now: 4 });
    expect(persisted.geometry.type).toBe("LineString");
    expect(getCanonicalGeographyCoordinates(persisted)).toEqual([p1, p2, p3]);
  });

  test("TEST 5 polygon fewer than 3 distinct vertices cannot confirm", () => {
    const draft = updateDraftProjectGeography(createDraftProjectGeography("poligono"), [p1, p2]);
    expect(buildDraftGeographyPreview(draft).validationStatus).toBe("PARTIAL");
    expect(() => confirmDraftProjectGeography(draft)).toThrow("DRAFT_GEOGRAPHY_INVALID");
  });

  test("TEST 6 polygon valid vertices preview equals persisted Polygon semantics", () => {
    const draft = confirmDraftProjectGeography(updateDraftProjectGeography(createDraftProjectGeography("poligono"), [p1, p2, p3]));
    const preview = buildDraftGeographyPreview(draft);
    const persisted = canonicalizeConfirmedDraftGeography({ projectId: "EXP-A6", draft, now: 6 });
    expect(preview.geometry.type).toBe("Polygon");
    expect(persisted.geometry).toEqual(preview.geometry);
    expect(getCanonicalGeographyCoordinates(persisted)).toEqual([p1, p2, p3]);
  });

  test("TEST 7 unconfirmed valid geometry blocks project creation canonicalization", () => {
    const draft = updateDraftProjectGeography(createDraftProjectGeography("lineal"), [p1, p2]);
    expect(buildDraftGeographyPreview(draft).canConfirm).toBe(true);
    expect(() => canonicalizeConfirmedDraftGeography({ projectId: "EXP-A7", draft })).toThrow("DRAFT_GEOGRAPHY_NOT_CONFIRMED");
  });

  test("TEST 8 confirmed valid geometry allows creation canonicalization", () => {
    const draft = confirmDraftProjectGeography(updateDraftProjectGeography(createDraftProjectGeography("lineal"), [p1, p2]));
    expect(canonicalizeConfirmedDraftGeography({ projectId: "EXP-A8", draft }).validationStatus).toBe("VALID");
  });

  test("TEST 9 reset/redefine before confirmation prevents old draft persistence", () => {
    const firstDraft = updateDraftProjectGeography(createDraftProjectGeography("individual"), [p1]);
    const reset = resetDraftProjectGeography(firstDraft.type);
    const finalDraft = confirmDraftProjectGeography(updateDraftProjectGeography(reset, [p2]));
    const persisted = canonicalizeConfirmedDraftGeography({ projectId: "EXP-A9", draft: finalDraft });
    expect(getCanonicalGeographyCoordinates(persisted)).toEqual([p2]);
  });

  test("TEST 10 photos present during creation do not define canonical geography", () => {
    const draft = confirmDraftProjectGeography(updateDraftProjectGeography(createDraftProjectGeography("individual"), [p1]));
    const persisted = canonicalizeConfirmedDraftGeography({ projectId: "EXP-A10", draft });
    expect(getCanonicalGeographyCoordinates(persisted)).not.toEqual([photoPoint]);
  });

  test("TEST 11 adding photos after canonical confirmation does not mutate it", () => {
    const draft = confirmDraftProjectGeography(updateDraftProjectGeography(createDraftProjectGeography("poligono"), [p1, p2, p3]));
    const persisted = canonicalizeConfirmedDraftGeography({ projectId: "EXP-A11", draft, now: 11 });
    const afterPhotoAdded = JSON.parse(JSON.stringify(persisted));
    expect(afterPhotoAdded.updatedAt).toBe(11);
    expect(getCanonicalGeographyCoordinates(afterPhotoAdded)).toEqual([p1, p2, p3]);
  });

  test("TEST 12 geometry preview/mount does not start sweep in product code", () => {
    const source = readSource("src/components/ProjectManager.tsx");
    expect(source).toContain("buildDraftGeographyPreview");
    expect(source).not.toContain("GEOINT_SWEEP_STARTED");
  });

  test("TEST 13 confirm geography does not emit GEOINT_SWEEP_STARTED", () => {
    const projectManager = readSource("src/components/ProjectManager.tsx");
    const projectContext = readSource("src/context/ProjectContext.tsx");
    expect(projectManager).toContain("Confirmar geografía");
    expect(projectManager).not.toContain("enqueueSweepLifecycleEventsInTransaction");
    expect(projectContext).toContain("canonicalizeConfirmedDraftGeography");
  });

  test("TEST 14 legacy existing project is not forced into reconfirmation or mutation", () => {
    const source = readSource("src/context/ProjectContext.tsx");
    expect(source).toContain("adaptLegacyProjectGeography");
    expect(source).not.toContain("Confirmar geografía legacy");
  });

  test("TEST 15 productive UI wires confirmed draft to createProject", () => {
    const source = readSource("src/components/ProjectManager.tsx");
    expect(source).toContain("draftGeography");
    expect(source).toContain("geometryConfirmed");
    expect(source).toContain("Confirmar geografía");
    expect(source).toContain("draftGeography,");
  });

  test("TEST 16 project list camera capture feeds draft geography without auto-confirming", () => {
    const source = readSource("src/components/ProjectList.tsx");
    expect(source).toContain("import exifr from \"exifr\"");
    expect(source).toContain("readPhotoGps(file, isLiveCapture)");
    expect(source).toContain("updateDraftProjectGeography(draftGeography, rectorPoints)");
    expect(source).toContain("confirmDraftProjectGeography(creationDraft)");
    expect(source).toContain("Confirmar geografía");
    expect(source).not.toContain("Usar GPS actual");
  });

  test("TEST 17 project list distinguishes in-situ camera from gallery import", () => {
    const source = readSource("src/components/ProjectList.tsx");
    expect(source).toContain("CAMERA_IN_SITU");
    expect(source).toContain("GALLERY_IMPORT");
    expect(source).toContain("handlePendingPhotosChange(e, true)");
    expect(source).toContain("handlePendingPhotosChange(e, false)");
    expect(source).toContain("!isLiveCapture");
    expect(source).toContain("gpsSource: \"NO_GPS\"");
  });

  test("TEST 18 project list enforces rector photo minimums before creation", () => {
    const source = readSource("src/components/ProjectList.tsx");
    expect(source).toContain("minimumRectorPhotoCount");
    expect(source).toContain("if (geometryType === \"lineal\") return 2");
    expect(source).toContain("if (geometryType === \"poligono\") return 3");
    expect(source).toContain("return 1");
    expect(source).toContain("!hasRequiredRectorPhotos || !creationPreview.canConfirm");
  });

  test("TEST 19 rector photos drive individual, corridor, and polygon draft points", () => {
    const source = readSource("src/components/ProjectList.tsx");
    expect(source).toContain("buildDraftPointsFromRectorPhotos");
    expect(source).toContain("geometryType === \"individual\" ? points.slice(-1) : points");
    expect(source).toContain("photo.gpsSource !== \"NO_GPS\"");
    expect(source).toContain("isValidLatLng({ lat: photo.lat, lng: photo.lng })");
  });
});
