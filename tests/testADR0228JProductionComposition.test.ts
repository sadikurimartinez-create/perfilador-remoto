import fs from "node:fs";
import path from "node:path";
import type { CrimeDatasetIdentity } from "../src/types/crimeDatasetIdentity";
import type { CrimeIncidenceFilterState } from "../src/types/crimeIncidenceControlledFilters";
import type { CanonicalProjectGeography } from "../src/utils/canonicalProjectGeography";
import { composeCrimeIncidenceProductionWorkspace } from "../src/utils/crimeIncidenceProductionComposition";

const geometry = { type: "Point" as const, coordinates: [-102.29, 21.88] as [number, number] };
const canonicalGeography: CanonicalProjectGeography = {
  geographyId: "geo-EXP-0228J",
  type: "INDIVIDUAL",
  geometry,
  source: "PROJECT_CREATION",
  validationStatus: "VALID",
  createdAt: 1,
  updatedAt: 1,
};
const lineage = {
  dataset: "incidencia_estadistica",
  querySource: "POSTGIS" as const,
  filters: { radiusMeters: 1000 },
  timeRange: { start: "2026-01-01", end: "2026-08-31", status: "KNOWN" as const },
  geographicFilter: {
    center: { lat: 21.88, lng: -102.29 },
    radiusMeters: 1000,
    coverageStatus: "IN_COVERAGE" as const,
  },
  recordSubset: { totalScanned: 1, matched: 1, excluded: 0, duplicates: 0, returnedRecords: 1 },
};

function datasetIdentity(): CrimeDatasetIdentity {
  return {
    datasetId: "incidencia_estadistica",
    datasetName: "Incidencia delictiva SSPE",
    datasetVersion: "2026.1",
    sourceType: "POSTGIS",
    sourceName: "incidencia_estadistica",
    sourceOrganization: "SSPE Aguascalientes",
    temporalCoverage: { start: "2026-01-01", end: "2026-08-31", status: "KNOWN" },
    geographicCoverage: { status: "IN_COVERAGE", scopeCompatibility: "IN_SCOPE" },
    validationSummary: { status: "SCHEMA_VALID", schemaValid: true, recordCount: 1 },
    lineage,
  };
}

function apiResult(identity: CrimeDatasetIdentity | null = datasetIdentity()) {
  return {
    success: true,
    querySource: "POSTGIS",
    sourceStatus: "POSTGIS_AVAILABLE",
    coverageStatus: "IN_COVERAGE",
    data: [{
      id: "incident-production-1",
      INCIDENTE: "Robo",
      FECHA: "2026-08-01",
      lat: 21.881,
      lng: -102.291,
      originalLat: 21.881,
      originalLng: -102.291,
      coverageStatus: "IN_COVERAGE",
      geoValidationStatus: "VALID_GEOLOCATION",
      fuente: "incidencia_estadistica",
    }],
    bibliografia: "SSPE Aguascalientes",
    lineage,
    ...(identity ? { datasetIdentity: identity } : {}),
  };
}

function fetcher(result = apiResult(), capture?: (body: Record<string, unknown>) => void): typeof fetch {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (capture) capture(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

describe("ADR-022.8J production composition", () => {
  test("runs the productive ADR pipeline and returns a READY binding", async () => {
    const binding = await composeCrimeIncidenceProductionWorkspace({
      expedienteId: "EXP-0228J",
      canonicalGeography,
      radiusMeters: 1000,
      requestedBy: "analyst-1",
      fetcher: fetcher(),
    });
    expect(binding.state).toBe("READY");
    expect(binding.viewModel?.expedienteId).toBe("EXP-0228J");
    expect(binding.viewModel?.incidents.matched[0].id).toBe("incident-production-1");
    expect(binding.viewModel?.exportReference.productClassification).toBe("DESCRIPTIVE_ANALYTICAL_PRODUCT");
  });

  test("sends controlled filters to the productive query boundary", async () => {
    const filters: CrimeIncidenceFilterState = {
      temporal: { start: "2026-08-01", end: "2026-08-31" },
      incidentTypes: ["Robo"],
      geographicCoverage: "IN_COVERAGE",
    };
    let requestBody: Record<string, unknown> = {};
    await composeCrimeIncidenceProductionWorkspace({
      expedienteId: "EXP-0228J",
      canonicalGeography,
      radiusMeters: 1000,
      requestedBy: "analyst-1",
      filters,
      fetcher: fetcher(apiResult(), (body) => { requestBody = body; }),
    });
    expect(requestBody).toMatchObject({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      incidentTypes: ["Robo"],
      requestedCoverage: "IN_COVERAGE",
    });
  });

  test("preserves canonical point geometry and query radius", async () => {
    const before = JSON.stringify(canonicalGeography);
    let requestBody: Record<string, unknown> = {};
    const binding = await composeCrimeIncidenceProductionWorkspace({
      expedienteId: "EXP-0228J",
      canonicalGeography,
      radiusMeters: 1250,
      requestedBy: "analyst-1",
      fetcher: fetcher(apiResult(), (body) => { requestBody = body; }),
    });
    expect(requestBody).toMatchObject({ lat: 21.88, lng: -102.29, radiusMeters: 1250 });
    expect(binding.viewModel?.geographyContext.canonicalGeography).toBe(canonicalGeography);
    expect(JSON.stringify(canonicalGeography)).toBe(before);
  });

  test("fails closed when canonical geography or analyst identity is absent", async () => {
    const noGeography = await composeCrimeIncidenceProductionWorkspace({
      expedienteId: "EXP-0228J", canonicalGeography: null, radiusMeters: 1000, requestedBy: "analyst-1", fetcher: fetcher(),
    });
    const noAnalyst = await composeCrimeIncidenceProductionWorkspace({
      expedienteId: "EXP-0228J", canonicalGeography, radiusMeters: 1000, fetcher: fetcher(),
    });
    expect(noGeography).toMatchObject({ state: "ERROR", error: "CRIME_INCIDENCE_CANONICAL_GEOGRAPHY_REQUIRED" });
    expect(noAnalyst).toMatchObject({ state: "ERROR", error: "CRIME_INCIDENCE_ANALYST_IDENTITY_REQUIRED" });
  });

  test("fails closed when dataset identity is absent or not admitted", async () => {
    const absent = await composeCrimeIncidenceProductionWorkspace({
      expedienteId: "EXP-0228J", canonicalGeography, radiusMeters: 1000, requestedBy: "analyst-1", fetcher: fetcher(apiResult(null)),
    });
    const incompleteIdentity = datasetIdentity();
    incompleteIdentity.datasetVersion = null;
    const rejected = await composeCrimeIncidenceProductionWorkspace({
      expedienteId: "EXP-0228J", canonicalGeography, radiusMeters: 1000, requestedBy: "analyst-1", fetcher: fetcher(apiResult(incompleteIdentity)),
    });
    expect(absent).toMatchObject({ state: "ERROR", error: "CRIME_INCIDENCE_DATASET_IDENTITY_UNAVAILABLE" });
    expect(rejected.state).toBe("ERROR");
    expect(rejected.error).toContain("CRIME_INCIDENCE_DATASET_NOT_ADMITTED");
  });

  test("page supplies the productive workspace composition", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "src/app/project/[id]/page.tsx"), "utf8");
    expect(page).toContain("<CrimeIncidenceProductionWorkspace");
    expect(page).toContain("project={project}");
    expect(page).toContain("requestedBy={user?.username}");
    expect(page).toContain("user={user}");
  });

  test("composition connects binding, governed filters, and existing institutional renderer", () => {
    const component = fs.readFileSync(path.join(process.cwd(), "src/components/crime-incidence/CrimeIncidenceProductionWorkspace.tsx"), "utf8");
    expect(component).toContain("binding={binding}");
    expect(component).toContain("onFilterRequest={handleFilterRequest}");
    expect(component).toContain("onExportProduct={handleExportProduct}");
    expect(component).toContain("exportToWord");
    expect(component).toContain('exportMode: "INSTITUTIONAL"');
  });

  test("production composition contains no mock data, historical arrays, local filtering, or parallel renderer", () => {
    const files = [
      "src/utils/crimeIncidenceProductionComposition.ts",
      "src/components/crime-incidence/CrimeIncidenceProductionWorkspace.tsx",
    ];
    const source = files.map((file) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
    expect(source).not.toMatch(/historicalCrimes|mockData|fixture|\.filter\(/);
    expect(source).not.toMatch(/new jsPDF|new Document|Packer\.toBlob/);
    expect(source).not.toMatch(/calculateDistance|computeDistance|createBuffer|coordinates\s*=/);
  });
});
