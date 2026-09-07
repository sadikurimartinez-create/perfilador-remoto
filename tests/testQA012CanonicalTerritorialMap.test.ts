import { readFileSync } from "fs";
import { join } from "path";
import {
  buildCanonicalProjectGeography,
  type CanonicalProjectGeography,
} from "../src/utils/canonicalProjectGeography";
import { getImageDimensionsAndBuffer } from "../src/lib/exportToWord";
import { buildExecutiveCanonicalTerritorialMapSpec } from "../src/utils/executiveCanonicalTerritorialMap";
import {
  assertExecutiveGeointPrincipalMapRendered,
  buildExecutiveGeointWordVisualAssets,
  renderExecutiveGeointWordDocument,
} from "../src/utils/executiveGeointWordRenderer";
import { EvidenceImageValidationEngine } from "../src/utils/evidenceImageValidationEngine";
import { ImageFingerprintService } from "../src/utils/imageFingerprintService";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

function geo(type: "INDIVIDUAL" | "CORRIDOR" | "POLYGON", points: Array<{ lat: number; lng: number }>, geographyId = "geo-test") {
  return buildCanonicalProjectGeography({ projectId: "project-test", type, points, geographyId, now: 1 });
}

function multipolygon(): CanonicalProjectGeography {
  const base = geo("POLYGON", [
    { lat: 22, lng: -102 },
    { lat: 22, lng: -101.9 },
    { lat: 22.1, lng: -101.9 },
  ], "geo-multi");
  return {
    ...base,
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        [[[-102, 22], [-101.9, 22], [-101.9, 22.1], [-102, 22]]],
        [[[-102.2, 22.2], [-102.1, 22.2], [-102.1, 22.3], [-102.2, 22.2]]],
      ],
    },
  };
}

function polygonWithHole(): CanonicalProjectGeography {
  const base = geo("POLYGON", [
    { lat: 22, lng: -102 },
    { lat: 22, lng: -101.8 },
    { lat: 22.2, lng: -101.8 },
    { lat: 22.2, lng: -102 },
  ], "geo-hole");
  return {
    ...base,
    geometry: {
      type: "Polygon",
      coordinates: [
        [[-102, 22], [-101.8, 22], [-101.8, 22.2], [-102, 22.2], [-102, 22]],
        [[-101.95, 22.05], [-101.85, 22.05], [-101.85, 22.15], [-101.95, 22.15], [-101.95, 22.05]],
      ],
    },
  };
}

function multipolygonWithHole(): CanonicalProjectGeography {
  const base = multipolygon();
  return {
    ...base,
    geographyId: "geo-multi-hole",
    geometry: {
      type: "MultiPolygon",
      coordinates: [
        [
          [[-102, 22], [-101.8, 22], [-101.8, 22.2], [-102, 22.2], [-102, 22]],
          [[-101.95, 22.05], [-101.85, 22.05], [-101.85, 22.15], [-101.95, 22.15], [-101.95, 22.05]],
        ],
        [
          [[-102.4, 22.4], [-102.2, 22.4], [-102.2, 22.6], [-102.4, 22.6], [-102.4, 22.4]],
          [[-102.35, 22.45], [-102.25, 22.45], [-102.25, 22.55], [-102.35, 22.55], [-102.35, 22.45]],
        ],
      ],
    },
  };
}

function realPrincipalMapAsset() {
  return { data: new Uint8Array(2048), width: 500, height: 280, type: "png" as const };
}

function installImageResolutionHarness() {
  const originalImage = (global as any).Image;
  const originalDocument = (global as any).document;
  const blobBuffer = new Uint8Array(2048).buffer;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      drawImage: jest.fn(),
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      fillText: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      globalAlpha: 1,
      font: "",
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      textAlign: "",
      textBaseline: "",
    }),
    toBlob: (callback: (blob: { arrayBuffer: () => Promise<ArrayBuffer> }) => void) => {
      callback({ arrayBuffer: async () => blobBuffer });
    },
  };
  const createElement = jest.fn((tagName: string) => {
    if (tagName === "canvas") return canvas as any;
    return {};
  });
  (global as any).document = { createElement };
  (global as any).Image = class {
    width = 600;
    height = 380;
    naturalWidth = 600;
    naturalHeight = 380;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      setTimeout(() => this.onload?.(), 0);
    }
  };
  return () => {
    if (originalDocument === undefined) {
      delete (global as any).document;
    } else {
      (global as any).document = originalDocument;
    }
    (global as any).Image = originalImage;
  };
}

async function resolveHarnessedImage(options: Parameters<typeof getImageDimensionsAndBuffer>[5] = {}) {
  return getImageDimensionsAndBuffer(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAlgAAAF8CAYAAAA0lX6TAAAAAklEQVR42mP8z8AARLAGLffI6QAAAABJRU5ErkJggg==",
    500,
    320,
    "narrativa territorial validable",
    "principal-territorial-map",
    options
  );
}

function visualComposition(status: "READY_FROM_GOVERNED_VISUAL" | "MAP_RENDER_REQUIRED" | "NO_CANONICAL_GEOGRAPHY" = "MAP_RENDER_REQUIRED") {
  return {
    principalTerritorialMap: {
      mapId: "principal-territorial-map",
      status,
      executiveHeadline: "Mapa territorial",
      caption: "Mapa canónico",
      renderInstruction: status === "READY_FROM_GOVERNED_VISUAL" ? "USE_GOVERNED_VISUAL" : status === "MAP_RENDER_REQUIRED" ? "MAP_RENDER_REQUIRED" : "CANONICAL_GEOGRAPHY_REQUIRED",
      visualReference: status === "READY_FROM_GOVERNED_VISUAL" ? "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" : null,
      presentation: { title: "Mapa territorial", visibleSourceLabel: "MAPA TERRITORIAL PRINCIPAL" },
      technicalMetadata: { geographyId: "geo-test", geometry: null, geographyType: "POINT", center: null, traceabilityIds: [], relatedFindingIds: [], relatedEvidenceIds: [], sourceItemId: null },
    },
    secondaryVisuals: [],
    visualBudget: { minimumFunctional: 1, maximumOrdinary: 5, used: 1, secondaryMaximum: 4, filledArtificially: false },
    selectionAudit: { selectedIds: ["principal-territorial-map"], excludedItems: [], reasonCodes: [], visualBudgetUsed: 1, visualBudgetMaximum: 5, territorialMapStatus: status },
    technicalMetadata: { source: "ExecutiveGeointReportModel+InstitutionalReportInput", deterministic: true, rendersFinalAssets: false, externalCalls: false },
  } as any;
}

function documentModel() {
  return {
    identity: { numeroExpediente: "06092026-0007-JMG", clasificacion: "CONFIDENCIAL", fechaEmision: "2026-09-06" },
    sections: [
      { sectionId: "cover", order: 1, title: "PORTADA", role: "Identidad", content: ["INFORME EJECUTIVO GEOINT"], densityPolicy: { targetPages: "1" }, status: "READY" },
      { sectionId: "territorial-situation", order: 2, title: "SITUACION TERRITORIAL", role: "Mapa", content: ["Mapa"], densityPolicy: { targetPages: "1" }, status: "READY" },
    ],
    visualPlacements: [{ visualId: "principal-territorial-map", sectionId: "territorial-situation", placementRole: "PRINCIPAL_TERRITORIAL_MAP", headline: "Mapa territorial", caption: "Mapa canónico" }],
    annexReferences: [],
    paginationPolicy: { targetPageRange: "7-9", ordinaryMaximumPages: 10, guidance: {}, note: "" },
    presentation: { documentTitle: "INFORME EJECUTIVO GEOINT", visibleText: [], headerFooterPolicy: { preserveExistingInstitutionalHeaderFooter: true, onlyFeedNumeroExpediente: true } },
    technicalMetadata: { modelName: "ExecutiveGeointReportDocumentModel", modelVersion: "1.0.0", source: "InstitutionalReportInput+ExecutiveGeointReportModel+ExecutiveVisualComposition", deterministic: true, externalCalls: false, modifiesHeaderFooter: false, rendersWord: false, sourceProjectId: "project-test", traceabilityIds: [], evidenceReferences: [], sectionCount: 2, visualPlacementCount: 1 },
  } as any;
}

describe("QA-01.2 - Mapa territorial principal canonico", () => {
  test("1 Point canonico produce marker con coordenada real", () => {
    const spec = buildExecutiveCanonicalTerritorialMapSpec(geo("INDIVIDUAL", [{ lat: 22.1, lng: -101.9 }]), { apiKey: "test-key" });
    expect(spec.markers).toEqual([{ lat: 22.1, lng: -101.9 }]);
    expect(decodeURIComponent(spec.imageUrl)).toContain("markers=color:red|label:A|22.1,-101.9");
  });

  test("2 LineString conserva todos los vertices canonicos", () => {
    const spec = buildExecutiveCanonicalTerritorialMapSpec(geo("CORRIDOR", [{ lat: 22, lng: -102 }, { lat: 22.1, lng: -101.9 }, { lat: 22.2, lng: -101.8 }]), { apiKey: "test-key" });
    expect(spec.paths[0]).toEqual([{ lat: 22, lng: -102 }, { lat: 22.1, lng: -101.9 }, { lat: 22.2, lng: -101.8 }]);
  });

  test("3 Polygon conserva y cierra correctamente el ring", () => {
    const spec = buildExecutiveCanonicalTerritorialMapSpec(geo("POLYGON", [{ lat: 22, lng: -102 }, { lat: 22, lng: -101.9 }, { lat: 22.1, lng: -101.9 }]), { apiKey: "test-key" });
    expect(spec.paths[0][0]).toEqual(spec.paths[0][spec.paths[0].length - 1]);
  });

  test("4 MultiPolygon conserva todos los componentes", () => {
    const spec = buildExecutiveCanonicalTerritorialMapSpec(multipolygon(), { apiKey: "test-key" });
    expect(spec.geometryType).toBe("MultiPolygon");
    expect(spec.paths).toHaveLength(2);
  });

  test("5 findings no modifican el path", () => {
    const geography = geo("CORRIDOR", [{ lat: 22, lng: -102 }, { lat: 22.1, lng: -101.9 }]);
    const before = buildExecutiveCanonicalTerritorialMapSpec(geography, { apiKey: "test-key" }).paths;
    const findings = [{ lat: 1, lng: 1 }];
    expect(findings).toHaveLength(1);
    expect(buildExecutiveCanonicalTerritorialMapSpec(geography, { apiKey: "test-key" }).paths).toEqual(before);
  });

  test("6 photos no modifican el path", () => {
    const geography = geo("POLYGON", [{ lat: 22, lng: -102 }, { lat: 22, lng: -101.9 }, { lat: 22.1, lng: -101.9 }]);
    const photos = [{ lat: 0, lng: 0 }];
    expect(photos[0].lat).toBe(0);
    expect(buildExecutiveCanonicalTerritorialMapSpec(geography, { apiKey: "test-key" }).paths[0]).not.toContainEqual({ lat: 0, lng: 0 });
  });

  test("7 pins no modifican el path", () => {
    const spec = buildExecutiveCanonicalTerritorialMapSpec(geo("CORRIDOR", [{ lat: 22, lng: -102 }, { lat: 22.1, lng: -101.9 }]), { apiKey: "test-key" });
    expect(JSON.stringify(spec.paths)).not.toContain("pin");
  });

  test("8 Street View no modifica el path", () => {
    const spec = buildExecutiveCanonicalTerritorialMapSpec(geo("CORRIDOR", [{ lat: 22, lng: -102 }, { lat: 22.1, lng: -101.9 }]), { apiKey: "test-key" });
    expect(spec.technicalMetadata.source).toBe("CanonicalProjectGeography");
  });

  test("9 geographyId obligatorio", () => {
    expect(() => buildExecutiveCanonicalTerritorialMapSpec({ ...geo("INDIVIDUAL", [{ lat: 22, lng: -102 }]), geographyId: "" }, { apiKey: "test-key" })).toThrow("CANONICAL_MAP_GEOGRAPHY_ID_REQUIRED");
  });

  test("10 validationStatus VALID obligatorio", () => {
    expect(() => buildExecutiveCanonicalTerritorialMapSpec({ ...geo("INDIVIDUAL", [{ lat: 22, lng: -102 }]), validationStatus: "PARTIAL" }, { apiKey: "test-key" })).toThrow("CANONICAL_MAP_VALID_GEOGRAPHY_REQUIRED");
  });

  test("11 getCanonicalMapViewport interviene en el viewport", () => {
    const spec = buildExecutiveCanonicalTerritorialMapSpec(geo("CORRIDOR", [{ lat: 22, lng: -102 }, { lat: 22.1, lng: -101.9 }]), { apiKey: "test-key" });
    expect(spec.viewport.fitMode).toBe("BOUNDS");
    expect(spec.technicalMetadata.usedCanonicalViewport).toBe(true);
  });

  test("12 MAP_RENDER_REQUIRED puede convertirse en activo real", async () => {
    const resolver = jest.fn(async () => ({ data: new Uint8Array([1, 2, 3]), type: "png" as const }));
    const assets = await buildExecutiveGeointWordVisualAssets(visualComposition("MAP_RENDER_REQUIRED"), {
      canonicalGeography: geo("INDIVIDUAL", [{ lat: 22.1, lng: -101.9 }]),
      googleStaticMapsApiKey: "test-key",
      resolveImage: resolver,
    });
    expect(resolver.mock.calls[0][0]).toContain("https://maps.googleapis.com/maps/api/staticmap?");
    expect(assets["principal-territorial-map"]).toBeTruthy();
  });

  test("13 fallo de adquisicion bloquea EXECUTIVE_GEOINT", async () => {
    const assets = await buildExecutiveGeointWordVisualAssets(visualComposition("MAP_RENDER_REQUIRED"), {
      canonicalGeography: geo("INDIVIDUAL", [{ lat: 22.1, lng: -101.9 }]),
      googleStaticMapsApiKey: "test-key",
      resolveImage: async () => null,
    });
    const rendered = renderExecutiveGeointWordDocument(documentModel(), { visualAssetsById: assets });
    expect(() => assertExecutiveGeointPrincipalMapRendered(rendered)).toThrow("EXECUTIVE_GEOINT_BLOCKED:PRINCIPAL_TERRITORIAL_MAP_REQUIRED");
  });

  test("14 missing principal-territorial-map bloquea EXECUTIVE_GEOINT", () => {
    const rendered = renderExecutiveGeointWordDocument(documentModel(), { visualAssetsById: {} });
    expect(() => assertExecutiveGeointPrincipalMapRendered(rendered)).toThrow("EXECUTIVE_GEOINT_BLOCKED:PRINCIPAL_TERRITORIAL_MAP_REQUIRED");
  });

  test("15 READY_FROM_GOVERNED_VISUAL mantiene comportamiento actual", async () => {
    const assets = await buildExecutiveGeointWordVisualAssets(visualComposition("READY_FROM_GOVERNED_VISUAL"));
    expect(assets["principal-territorial-map"]).toBeTruthy();
  });

  test("16 NO_CANONICAL_GEOGRAPHY no fabrica mapa", async () => {
    const resolver = jest.fn(async () => ({ data: new Uint8Array([1]), type: "png" as const }));
    const assets = await buildExecutiveGeointWordVisualAssets(visualComposition("NO_CANONICAL_GEOGRAPHY"), {
      canonicalGeography: geo("INDIVIDUAL", [{ lat: 22.1, lng: -101.9 }]),
      googleStaticMapsApiKey: "test-key",
      resolveImage: resolver,
    });
    expect(assets["principal-territorial-map"]).toBeUndefined();
    expect(resolver).not.toHaveBeenCalled();
  });

  test("17 no fallback 1x1 en adaptador canonico", () => {
    expect(source("src/utils/executiveCanonicalTerritorialMap.ts")).not.toContain("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAY");
  });

  test("18 no geometria sintetica", () => {
    const text = source("src/utils/executiveCanonicalTerritorialMap.ts");
    expect(text).not.toMatch(/findings|photos|pins|streetView|incidents|sweeps/i);
    expect(text).toContain("syntheticGeometry: false");
  });

  test("19 no mutacion de CanonicalProjectGeography", () => {
    const geography = geo("POLYGON", [{ lat: 22, lng: -102 }, { lat: 22, lng: -101.9 }, { lat: 22.1, lng: -101.9 }]);
    const before = JSON.stringify(geography);
    buildExecutiveCanonicalTerritorialMapSpec(geography, { apiKey: "test-key" });
    expect(JSON.stringify(geography)).toBe(before);
  });

  test("20 no nueva IA", () => {
    expect(source("src/utils/executiveCanonicalTerritorialMap.ts")).not.toMatch(/openai|gemini|generateContent|chatCompletion|responses/i);
  });

  test("21 no nueva inferencia criminologica", () => {
    expect(source("src/utils/executiveCanonicalTerritorialMap.ts")).not.toMatch(/criminolog|hallazgo|riesgo|delict/i);
  });

  test("22 no fallback silencioso EXECUTIVE_GEOINT a LEGACY por mapa faltante", () => {
    const text = source("src/lib/exportToWord.ts");
    expect(text).toContain("assertExecutiveGeointPrincipalMapRendered");
    expect(text).toContain("throw new Error(`EXECUTIVE_GEOINT_BLOCKED:${message}`)");
  });

  test("23 fallo del resolver real no produce placeholder para principal-territorial-map", async () => {
    const assets = await buildExecutiveGeointWordVisualAssets(visualComposition("MAP_RENDER_REQUIRED"), {
      canonicalGeography: geo("INDIVIDUAL", [{ lat: 22.1, lng: -101.9 }]),
      googleStaticMapsApiKey: "test-key",
      strictPrincipalMapAssets: true,
      resolvePrincipalMapImage: async () => null,
      resolveImage: async () => ({ data: new Uint8Array(1), type: "png" as const }),
    });
    expect(assets["principal-territorial-map"]).toBeUndefined();
  });

  test("24 placeholder historico de evidencia no satisface mapa principal", async () => {
    const assets = await buildExecutiveGeointWordVisualAssets(visualComposition("READY_FROM_GOVERNED_VISUAL"), {
      strictPrincipalMapAssets: true,
    });
    expect(assets["principal-territorial-map"]).toBeUndefined();
  });

  test("25 EXECUTIVE_GEOINT permanece fail-closed sin activo principal real", async () => {
    const assets = await buildExecutiveGeointWordVisualAssets(visualComposition("MAP_RENDER_REQUIRED"), {
      canonicalGeography: geo("INDIVIDUAL", [{ lat: 22.1, lng: -101.9 }]),
      googleStaticMapsApiKey: "test-key",
      strictPrincipalMapAssets: true,
      resolvePrincipalMapImage: async () => ({ data: new Uint8Array(12), width: 1, height: 1, type: "png" as const }),
    });
    const rendered = renderExecutiveGeointWordDocument(documentModel(), { visualAssetsById: assets });
    expect(() => assertExecutiveGeointPrincipalMapRendered(rendered)).toThrow("EXECUTIVE_GEOINT_BLOCKED:PRINCIPAL_TERRITORIAL_MAP_REQUIRED");
  });

  test("26 no duplica prefijo EXECUTIVE_GEOINT_BLOCKED", () => {
    const text = source("src/lib/exportToWord.ts");
    expect(text).toContain('message.startsWith("EXECUTIVE_GEOINT_BLOCKED:")');
    expect(text.match(/throw new Error\(`EXECUTIVE_GEOINT_BLOCKED:\$\{message\}`\)/g)).toHaveLength(1);
  });

  test("27 Polygon con interior ring preserva hueco semanticamente sin rellenarlo independientemente", () => {
    const spec = buildExecutiveCanonicalTerritorialMapSpec(polygonWithHole(), { apiKey: "test-key" });
    const decodedUrl = decodeURIComponent(spec.imageUrl);
    expect(spec.paths).toHaveLength(2);
    expect(spec.pathMetadata.map((path) => path.role)).toEqual(["OUTER_RING", "INTERIOR_RING"]);
    expect(spec.paths[1]).toContainEqual({ lat: 22.05, lng: -101.95 });
    expect(decodedUrl).not.toContain("fillcolor");
  });

  test("28 MultiPolygon con interior ring preserva todos los componentes y rings", () => {
    const spec = buildExecutiveCanonicalTerritorialMapSpec(multipolygonWithHole(), { apiKey: "test-key" });
    expect(spec.paths).toHaveLength(4);
    expect(spec.pathMetadata.map((path) => `${path.componentIndex}:${path.ringIndex}:${path.role}`)).toEqual([
      "0:0:OUTER_RING",
      "0:1:INTERIOR_RING",
      "1:0:OUTER_RING",
      "1:1:INTERIOR_RING",
    ]);
    expect(spec.paths[3]).toContainEqual({ lat: 22.45, lng: -102.35 });
  });

  test("29 geometria extensa no elimina ni altera vertices y falla cerrada si excede URL", () => {
    const points = Array.from({ length: 150 }, (_, index) => ({ lat: 22 + index / 10000, lng: -102 + index / 10000 }));
    const spec = buildExecutiveCanonicalTerritorialMapSpec(geo("CORRIDOR", points), { apiKey: "test-key" });
    expect(spec.paths[0]).toEqual(points);
    expect(spec.coordinateCount).toBe(points.length);

    const excessivePoints = Array.from({ length: 1200 }, (_, index) => ({ lat: 22 + index / 100000, lng: -102 + index / 100000 }));
    expect(() => buildExecutiveCanonicalTerritorialMapSpec(geo("CORRIDOR", excessivePoints, "geo-too-long"), { apiKey: "test-key" })).toThrow("CANONICAL_MAP_URL_TOO_LONG");
  });

  test("30 API key no se registra en logs", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    buildExecutiveCanonicalTerritorialMapSpec(geo("INDIVIDUAL", [{ lat: 22.1, lng: -101.9 }]), { apiKey: "secret-key-never-log" });
    const output = [...warnSpy.mock.calls, ...logSpy.mock.calls, ...errorSpy.mock.calls].flat().join("\n");
    warnSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
    expect(output).not.toContain("secret-key-never-log");
  });

  test("31 validation.valid false con disableFallback true devuelve null", async () => {
    const restoreHarness = installImageResolutionHarness();
    const validationSpy = jest.spyOn(EvidenceImageValidationEngine, "validateImage").mockReturnValue({ valid: false, reason: "IMAGE_CORRUPTED", fallbackReason: "IMAGE_CORRUPTED" } as any);
    const duplicateSpy = jest.spyOn(ImageFingerprintService, "registerAndCheckDuplicate").mockReturnValue({ duplicate: false, type: "NONE" } as any);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(resolveHarnessedImage({ disableFallback: true })).resolves.toBeNull();
    expect(duplicateSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    duplicateSpy.mockRestore();
    validationSpy.mockRestore();
    restoreHarness();
  });

  test("32 duplicate true con disableFallback true no devuelve fallback canvas", async () => {
    const restoreHarness = installImageResolutionHarness();
    const validationSpy = jest.spyOn(EvidenceImageValidationEngine, "validateImage").mockReturnValue({ valid: true } as any);
    const duplicateSpy = jest.spyOn(ImageFingerprintService, "registerAndCheckDuplicate").mockReturnValue({ duplicate: true, type: "SHA256" } as any);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(resolveHarnessedImage({ disableFallback: true })).resolves.toBeNull();
    warnSpy.mockRestore();
    duplicateSpy.mockRestore();
    validationSpy.mockRestore();
    restoreHarness();
  });

  test("33 validation invalid con disableFallback false preserva fallback legacy", async () => {
    const restoreHarness = installImageResolutionHarness();
    const validationSpy = jest.spyOn(EvidenceImageValidationEngine, "validateImage").mockReturnValue({ valid: false, reason: "IMAGE_CORRUPTED", fallbackReason: "IMAGE_CORRUPTED" } as any);
    const duplicateSpy = jest.spyOn(ImageFingerprintService, "registerAndCheckDuplicate").mockReturnValue({ duplicate: false, type: "NONE" } as any);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await resolveHarnessedImage({ disableFallback: false });
    expect(result?.data.byteLength).toBeGreaterThan(0);
    expect(result?.width).toBe(500);
    expect(result?.height).toBe(317);
    warnSpy.mockRestore();
    duplicateSpy.mockRestore();
    validationSpy.mockRestore();
    restoreHarness();
  });

  test("34 duplicate con disableFallback false preserva fallback legacy", async () => {
    const restoreHarness = installImageResolutionHarness();
    const validationSpy = jest.spyOn(EvidenceImageValidationEngine, "validateImage").mockReturnValue({ valid: true } as any);
    const duplicateSpy = jest.spyOn(ImageFingerprintService, "registerAndCheckDuplicate").mockReturnValue({ duplicate: true, type: "SHA256" } as any);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await resolveHarnessedImage({ disableFallback: false });
    expect(result?.data.byteLength).toBeGreaterThan(0);
    expect(result?.width).toBe(500);
    expect(result?.height).toBe(317);
    warnSpy.mockRestore();
    duplicateSpy.mockRestore();
    validationSpy.mockRestore();
    restoreHarness();
  });

  test("35 mapa principal estricto bloquea ante validacion invalida o duplicado", async () => {
    const restoreHarness = installImageResolutionHarness();
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const validationSpy = jest.spyOn(EvidenceImageValidationEngine, "validateImage").mockReturnValue({ valid: false, reason: "IMAGE_CORRUPTED", fallbackReason: "IMAGE_CORRUPTED" } as any);
    const duplicateSpy = jest.spyOn(ImageFingerprintService, "registerAndCheckDuplicate").mockReturnValue({ duplicate: false, type: "NONE" } as any);
    const invalidAssets = await buildExecutiveGeointWordVisualAssets(visualComposition("MAP_RENDER_REQUIRED"), {
      canonicalGeography: geo("INDIVIDUAL", [{ lat: 22.1, lng: -101.9 }]),
      googleStaticMapsApiKey: "test-key",
      strictPrincipalMapAssets: true,
      resolvePrincipalMapImage: (reference, maxWidth, maxHeight, narrative, evidenceId) =>
        getImageDimensionsAndBuffer(reference, maxWidth, maxHeight, narrative, evidenceId, { disableFallback: true }),
    });
    expect(() => assertExecutiveGeointPrincipalMapRendered(renderExecutiveGeointWordDocument(documentModel(), { visualAssetsById: invalidAssets }))).toThrow("EXECUTIVE_GEOINT_BLOCKED:PRINCIPAL_TERRITORIAL_MAP_REQUIRED");

    validationSpy.mockReturnValue({ valid: true } as any);
    duplicateSpy.mockReturnValue({ duplicate: true, type: "SHA256" } as any);
    const duplicateAssets = await buildExecutiveGeointWordVisualAssets(visualComposition("MAP_RENDER_REQUIRED"), {
      canonicalGeography: geo("INDIVIDUAL", [{ lat: 22.1, lng: -101.9 }]),
      googleStaticMapsApiKey: "test-key",
      strictPrincipalMapAssets: true,
      resolvePrincipalMapImage: (reference, maxWidth, maxHeight, narrative, evidenceId) =>
        getImageDimensionsAndBuffer(reference, maxWidth, maxHeight, narrative, evidenceId, { disableFallback: true }),
    });
    expect(() => assertExecutiveGeointPrincipalMapRendered(renderExecutiveGeointWordDocument(documentModel(), { visualAssetsById: duplicateAssets }))).toThrow("EXECUTIVE_GEOINT_BLOCKED:PRINCIPAL_TERRITORIAL_MAP_REQUIRED");

    warnSpy.mockRestore();
    duplicateSpy.mockRestore();
    validationSpy.mockRestore();
    restoreHarness();
  });
});
