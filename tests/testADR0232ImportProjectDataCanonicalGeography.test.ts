import {
  buildImportedProjectCanonicalGeographyPatch,
  deserializeCanonicalGeographyFromFirestore,
  type CanonicalProjectGeography,
} from "../src/utils/canonicalProjectGeography";

const now = 1700000000000;

function expectNoNestedArrays(value: unknown): void {
  if (Array.isArray(value)) {
    expect(value.some(Array.isArray)).toBe(false);
    value.forEach(expectNoNestedArrays);
    return;
  }
  if (typeof value === "object" && value !== null) {
    Object.values(value).forEach(expectNoNestedArrays);
  }
}

function canonical(
  geometry: CanonicalProjectGeography["geometry"],
  overrides: Partial<CanonicalProjectGeography> = {}
): CanonicalProjectGeography {
  return {
    geographyId: "geo-imported-1",
    type: geometry.type === "LineString" ? "CORRIDOR" : geometry.type === "Point" ? "INDIVIDUAL" : "POLYGON",
    geometry,
    source: "PROJECT_CREATION",
    validationStatus: "VALID",
    createdAt: now,
    updatedAt: now,
    derived: {
      closedRing: geometry.type === "Polygon" || geometry.type === "MultiPolygon",
    },
    limitations: [],
    ...overrides,
  };
}

describe("ADR-023.2 - importProjectData canonical geography preservation", () => {
  test("importar POINT canonico valido preserva geographyId y coordenadas", () => {
    const geography = canonical({ type: "Point", coordinates: [-102.291, 21.881] });
    const patch = buildImportedProjectCanonicalGeographyPatch({ id: "exp-1", canonicalGeography: geography });
    const rehydrated = deserializeCanonicalGeographyFromFirestore(patch.canonicalGeography);

    expect(patch.geographyId).toBe("geo-imported-1");
    expect(rehydrated?.geometry).toEqual(geography.geometry);
  });

  test("importar LINESTRING valido preserva nodos y orden", () => {
    const geography = canonical({
      type: "LineString",
      coordinates: [
        [-102.291, 21.881],
        [-102.292, 21.882],
        [-102.293, 21.883],
      ],
    });
    const patch = buildImportedProjectCanonicalGeographyPatch({ id: "exp-1", canonicalGeography: geography });
    const rehydrated = deserializeCanonicalGeographyFromFirestore(patch.canonicalGeography);

    expect(rehydrated?.geometry).toEqual(geography.geometry);
    expect((rehydrated?.geometry as any).coordinates[1]).toEqual([-102.292, 21.882]);
  });

  test("importar POLYGON valido preserva vertices y cierre", () => {
    const geography = canonical({
      type: "Polygon",
      coordinates: [[
        [-102.291, 21.881],
        [-102.292, 21.882],
        [-102.293, 21.881],
        [-102.291, 21.881],
      ]],
    });
    const patch = buildImportedProjectCanonicalGeographyPatch({ id: "exp-1", canonicalGeography: geography });
    const rehydrated = deserializeCanonicalGeographyFromFirestore(patch.canonicalGeography);

    expect(rehydrated?.geometry).toEqual(geography.geometry);
    expect((rehydrated?.geometry as any).coordinates[0][0]).toEqual(
      (rehydrated?.geometry as any).coordinates[0][3]
    );
  });

  test("importar MULTIPOLYGON valido preserva estructura completa sin simplificar", () => {
    const geography = canonical({
      type: "MultiPolygon",
      coordinates: [
        [[
          [-102.291, 21.881],
          [-102.292, 21.882],
          [-102.293, 21.881],
          [-102.291, 21.881],
        ]],
        [[
          [-102.301, 21.891],
          [-102.302, 21.892],
          [-102.303, 21.891],
          [-102.301, 21.891],
        ]],
      ],
    });
    const patch = buildImportedProjectCanonicalGeographyPatch({ id: "exp-1", canonicalGeography: geography });
    const rehydrated = deserializeCanonicalGeographyFromFirestore(patch.canonicalGeography);

    expectNoNestedArrays(patch.canonicalGeography);
    expect(rehydrated?.geometry).toEqual(geography.geometry);
  });

  test("expediente legacy solo con lat/lng/radius no crea Polygon canonico artificial", () => {
    const patch = buildImportedProjectCanonicalGeographyPatch({
      id: "exp-legacy",
      canonicalGeography: null,
      geographyId: null,
      latitude: 21.881,
      longitude: -102.291,
      radius: 500,
    } as any);

    expect(patch.canonicalGeography).toBeNull();
    expect(patch.geographyId).toBeNull();
    expect(patch.geographyValidationStatus).toBe("INVALID");
  });

  test("geographyId valido importado no se reemplaza arbitrariamente", () => {
    const geography = canonical({ type: "Point", coordinates: [-102.291, 21.881] }, { geographyId: "geo-original" });
    const patch = buildImportedProjectCanonicalGeographyPatch({
      id: "exp-1",
      canonicalGeography: geography,
      geographyId: "geo-different-top-level",
    });

    expect(patch.geographyId).toBe("geo-original");
  });

  test("round-trip importacion a payload persistible y rehidratacion conserva identidad y estructura", () => {
    const geography = canonical({
      type: "Polygon",
      coordinates: [[
        [-102.291, 21.881],
        [-102.292, 21.882],
        [-102.293, 21.881],
        [-102.291, 21.881],
      ]],
    }, { geographyId: "geo-roundtrip" });
    const patch = buildImportedProjectCanonicalGeographyPatch({ id: "exp-1", canonicalGeography: geography });
    const rehydrated = deserializeCanonicalGeographyFromFirestore(patch.canonicalGeography);

    expectNoNestedArrays(patch.canonicalGeography);
    expect(rehydrated?.geographyId).toBe("geo-roundtrip");
    expect(rehydrated?.geometry).toEqual(geography.geometry);
  });

  test("payload legacy con documento existente Polygon valido conserva Polygon existente", () => {
    const existing = canonical({
      type: "Polygon",
      coordinates: [[
        [-102.291, 21.881],
        [-102.292, 21.882],
        [-102.293, 21.881],
        [-102.291, 21.881],
      ]],
    }, { geographyId: "geo-existing-polygon" });
    const patch = buildImportedProjectCanonicalGeographyPatch({
      id: "exp-existing",
      canonicalGeography: null,
      existingCanonicalGeography: existing,
    });
    const rehydrated = deserializeCanonicalGeographyFromFirestore(patch.canonicalGeography);

    expect(patch.geographyId).toBe("geo-existing-polygon");
    expect(rehydrated?.geometry).toEqual(existing.geometry);
  });

  test("payload legacy con documento existente MultiPolygon valido conserva MultiPolygon completo", () => {
    const existing = canonical({
      type: "MultiPolygon",
      coordinates: [
        [[
          [-102.291, 21.881],
          [-102.292, 21.882],
          [-102.293, 21.881],
          [-102.291, 21.881],
        ]],
        [[
          [-102.301, 21.891],
          [-102.302, 21.892],
          [-102.303, 21.891],
          [-102.301, 21.891],
        ]],
      ],
    }, { geographyId: "geo-existing-multipolygon" });
    const patch = buildImportedProjectCanonicalGeographyPatch({
      id: "exp-existing",
      canonicalGeography: null,
      existingCanonicalGeography: existing,
    });
    const rehydrated = deserializeCanonicalGeographyFromFirestore(patch.canonicalGeography);

    expect(patch.geographyId).toBe("geo-existing-multipolygon");
    expect(rehydrated?.geometry).toEqual(existing.geometry);
  });

  test("payload legacy sin documento existente canonico permanece null legacy", () => {
    const patch = buildImportedProjectCanonicalGeographyPatch({
      id: "exp-legacy",
      canonicalGeography: null,
      existingCanonicalGeography: null,
    });

    expect(patch.canonicalGeography).toBeNull();
    expect(patch.geographyId).toBeNull();
    expect(patch.geographyValidationStatus).toBe("INVALID");
  });

  test("payload con canonicalGeography valida prevalece sobre geografia existente distinta", () => {
    const imported = canonical({ type: "Point", coordinates: [-102.291, 21.881] }, { geographyId: "geo-imported" });
    const existing = canonical({ type: "Point", coordinates: [-102.299, 21.889] }, { geographyId: "geo-existing" });
    const patch = buildImportedProjectCanonicalGeographyPatch({
      id: "exp-1",
      canonicalGeography: imported,
      existingCanonicalGeography: existing,
    });
    const rehydrated = deserializeCanonicalGeographyFromFirestore(patch.canonicalGeography);

    expect(patch.geographyId).toBe("geo-imported");
    expect(rehydrated?.geometry).toEqual(imported.geometry);
  });

  test("geographyId final coincide con canonicalGeography.geographyId seleccionado", () => {
    const existing = canonical({ type: "Point", coordinates: [-102.291, 21.881] }, { geographyId: "geo-selected" });
    const patch = buildImportedProjectCanonicalGeographyPatch({
      id: "exp-1",
      canonicalGeography: null,
      existingCanonicalGeography: existing,
      geographyId: "geo-divergent",
    });
    const rehydrated = deserializeCanonicalGeographyFromFirestore(patch.canonicalGeography);

    expect(patch.geographyId).toBe(rehydrated?.geographyId);
    expect(patch.geographyId).toBe("geo-selected");
  });
});
